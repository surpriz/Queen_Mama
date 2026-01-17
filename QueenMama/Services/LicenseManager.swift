import Foundation
import Combine

/// Manages license validation and feature gating
@MainActor
final class LicenseManager: ObservableObject {
    static let shared = LicenseManager()

    // MARK: - Published State

    @Published private(set) var currentLicense: License = .free
    @Published private(set) var isValidating: Bool = false
    @Published private(set) var isOffline: Bool = false
    @Published private(set) var lastValidatedAt: Date?

    // MARK: - Usage Tracking

    @Published private(set) var smartModeUsedToday: Int = 0
    @Published private(set) var aiRequestsToday: Int = 0

    // MARK: - Dependencies

    private let api = AuthAPIClient.shared
    private let authManager = AuthenticationManager.shared
    private let deviceInfo = DeviceInfo.current()

    // MARK: - Cache

    private let cacheKey = "cached_license"
    private let cacheExpiryKey = "cached_license_expiry"
    private let usageResetKey = "usage_reset_date"
    private let gracePeriodDays = 7
    private let revalidationIntervalMinutes = 60 // Revalidate every hour

    private var cancellables = Set<AnyCancellable>()
    private var revalidationTimer: Timer?

    private init() {
        // Load cached license
        loadCachedLicense()

        // Reset daily usage if needed
        resetDailyUsageIfNeeded()

        // Subscribe to auth changes
        authManager.$isAuthenticated
            .dropFirst()
            .sink { [weak self] isAuthenticated in
                Task { @MainActor in
                    if isAuthenticated {
                        await self?.revalidate()
                    } else {
                        self?.currentLicense = .free
                        self?.resetUsage()
                    }
                }
            }
            .store(in: &cancellables)

        // Start periodic revalidation timer
        startPeriodicRevalidation()
    }

    // MARK: - Periodic Revalidation

    private func startPeriodicRevalidation() {
        revalidationTimer?.invalidate()
        revalidationTimer = Timer.scheduledTimer(
            withTimeInterval: TimeInterval(revalidationIntervalMinutes * 60),
            repeats: true
        ) { [weak self] _ in
            Task { @MainActor in
                await self?.revalidateIfNeeded()
            }
        }
    }

    /// Revalidate only if authenticated and not recently validated
    private func revalidateIfNeeded() async {
        guard authManager.isAuthenticated else { return }

        // Skip if validated recently (within last 5 minutes)
        if let lastValidated = lastValidatedAt,
           Date().timeIntervalSince(lastValidated) < 300 {
            return
        }

        await revalidate()
    }

    // MARK: - Feature Access

    /// Check if a feature can be used
    /// Returns .blocked for unauthenticated users trying to use features
    func canUse(_ feature: Feature) -> FeatureAccess {
        // Block all features except viewing UI for unauthenticated users
        if !authManager.isAuthenticated {
            // Session sync requires auth specifically
            if case .sessionSync = feature {
                return .requiresAuth
            }
            // All other features are blocked for unauthenticated users
            return .blocked
        }

        let features = currentLicense.features

        switch feature {
        case .smartMode:
            // Smart Mode is Enterprise-only
            if !features.smartModeEnabled {
                return .requiresEnterprise
            }
            if let limit = features.smartModeLimit {
                if smartModeUsedToday >= limit {
                    return .limitReached(used: smartModeUsedToday, limit: limit)
                }
            }
            return .allowed

        case .customModes:
            return features.customModesEnabled ? .allowed : .requiresPro

        case .exportMarkdown:
            return features.exportFormats.contains("markdown") ? .allowed : .requiresPro

        case .exportJson:
            return features.exportFormats.contains("json") ? .allowed : .requiresPro

        case .autoAnswer:
            // Auto-Answer is Enterprise-only
            return features.autoAnswerEnabled ? .allowed : .requiresEnterprise

        case .sessionSync:
            return features.sessionSyncEnabled ? .allowed : .requiresPro

        case .aiRequest:
            if let limit = features.dailyAiRequestLimit {
                if aiRequestsToday >= limit {
                    return .limitReached(used: aiRequestsToday, limit: limit)
                }
            }
            return .allowed

        case .undetectable:
            // Undetectable overlay is Enterprise-only
            return features.undetectableEnabled ? .allowed : .requiresEnterprise

        case .screenshot:
            return features.screenshotEnabled ? .allowed : .requiresPro

        case .sessionStart:
            // Session start requires authentication
            return authManager.isAuthenticated ? .allowed : .blocked
        }
    }

    /// Record usage of a feature (for rate-limited features)
    /// Also sends usage to server asynchronously for server-side tracking
    func recordUsage(_ feature: Feature, provider: String? = nil) {
        let action: String
        switch feature {
        case .smartMode:
            smartModeUsedToday += 1
            saveUsage()
            action = "smart_mode"
        case .aiRequest:
            aiRequestsToday += 1
            saveUsage()
            action = "ai_request"
        case .sessionStart:
            action = "session_start"
        case .autoAnswer:
            action = "auto_answer"
        default:
            return
        }

        // Record usage to server asynchronously (fire-and-forget)
        Task {
            do {
                try await api.recordUsage(action: action, provider: provider)
            } catch {
                print("[License] Failed to record usage to server: \(error)")
            }
        }
    }

    // MARK: - Plan Properties

    var isPro: Bool {
        (currentLicense.plan == .pro || currentLicense.plan == .enterprise) &&
        (currentLicense.status == .active || currentLicense.status == .trialing)
    }

    var isEnterprise: Bool {
        currentLicense.plan == .enterprise &&
        (currentLicense.status == .active || currentLicense.status == .trialing)
    }

    var isTrialing: Bool {
        currentLicense.status == .trialing
    }

    var trialDaysRemaining: Int? {
        currentLicense.trial?.daysRemaining
    }

    // MARK: - Validation

    /// Force revalidate license from server
    func revalidate() async {
        guard authManager.isAuthenticated else {
            currentLicense = .free
            return
        }

        isValidating = true
        isOffline = false

        do {
            let license = try await api.validateLicense(deviceId: deviceInfo.deviceId)

            currentLicense = license
            lastValidatedAt = Date()

            // Update usage from server
            if let usage = license.usage {
                smartModeUsedToday = usage.smartModeUsedToday
                aiRequestsToday = usage.aiRequestsToday
            }

            // Cache the license
            cacheLicense(license)

        } catch {
            print("[License] Validation failed: \(error)")
            isOffline = true

            // Use cached license with grace period
            if let cachedLicense = loadCachedLicense() {
                // Check grace period for PRO users
                if cachedLicense.plan == .pro {
                    if let expiry = getCacheExpiry(), expiry > Date() {
                        currentLicense = cachedLicense
                    } else {
                        // Grace period expired, fallback to free
                        currentLicense = .free
                    }
                } else {
                    currentLicense = cachedLicense
                }
            }
        }

        isValidating = false
    }

    // MARK: - Cache Management

    @discardableResult
    private func loadCachedLicense() -> License? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let license = try? JSONDecoder().decode(License.self, from: data) else {
            return nil
        }
        currentLicense = license
        return license
    }

    private func cacheLicense(_ license: License) {
        guard let data = try? JSONEncoder().encode(license) else { return }

        UserDefaults.standard.set(data, forKey: cacheKey)

        // Set expiry with grace period for PRO
        let expiryDays = license.plan == .pro ? gracePeriodDays : 1
        let expiry = Date().addingTimeInterval(TimeInterval(expiryDays * 24 * 60 * 60))
        UserDefaults.standard.set(expiry, forKey: cacheExpiryKey)
    }

    private func getCacheExpiry() -> Date? {
        UserDefaults.standard.object(forKey: cacheExpiryKey) as? Date
    }

    // MARK: - Usage Management

    private func resetDailyUsageIfNeeded() {
        let today = Calendar.current.startOfDay(for: Date())
        let lastReset = UserDefaults.standard.object(forKey: usageResetKey) as? Date

        if lastReset == nil || !Calendar.current.isDate(lastReset!, inSameDayAs: today) {
            resetUsage()
            UserDefaults.standard.set(today, forKey: usageResetKey)
        } else {
            loadUsage()
        }
    }

    private func resetUsage() {
        smartModeUsedToday = 0
        aiRequestsToday = 0
        saveUsage()
    }

    private func loadUsage() {
        smartModeUsedToday = UserDefaults.standard.integer(forKey: "smartModeUsedToday")
        aiRequestsToday = UserDefaults.standard.integer(forKey: "aiRequestsToday")
    }

    private func saveUsage() {
        UserDefaults.standard.set(smartModeUsedToday, forKey: "smartModeUsedToday")
        UserDefaults.standard.set(aiRequestsToday, forKey: "aiRequestsToday")
    }
}

// MARK: - Convenience Extensions

extension LicenseManager {
    /// Check if feature is available (simple boolean)
    func isFeatureAvailable(_ feature: Feature) -> Bool {
        if case .allowed = canUse(feature) {
            return true
        }
        return false
    }

    /// Get remaining uses for a rate-limited feature
    func remainingUses(for feature: Feature) -> Int? {
        switch feature {
        case .smartMode:
            guard let limit = currentLicense.features.smartModeLimit else { return nil }
            return max(0, limit - smartModeUsedToday)
        case .aiRequest:
            guard let limit = currentLicense.features.dailyAiRequestLimit else { return nil }
            return max(0, limit - aiRequestsToday)
        default:
            return nil
        }
    }
}
