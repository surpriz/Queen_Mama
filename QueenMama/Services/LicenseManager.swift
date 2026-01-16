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

    private var cancellables = Set<AnyCancellable>()

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
    }

    // MARK: - Feature Access

    /// Check if a feature can be used
    func canUse(_ feature: Feature) -> FeatureAccess {
        // Auth-gated features
        guard authManager.isAuthenticated else {
            switch feature {
            case .sessionSync:
                return .requiresAuth
            default:
                break
            }
        }

        let features = currentLicense.features

        switch feature {
        case .smartMode:
            if !features.smartModeEnabled {
                return .requiresPro
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
            return features.autoAnswerEnabled ? .allowed : .requiresPro

        case .sessionSync:
            return features.sessionSyncEnabled ? .allowed : .requiresPro

        case .aiRequest:
            if let limit = features.dailyAiRequestLimit {
                if aiRequestsToday >= limit {
                    return .limitReached(used: aiRequestsToday, limit: limit)
                }
            }
            return .allowed
        }
    }

    /// Record usage of a feature (for rate-limited features)
    func recordUsage(_ feature: Feature) {
        switch feature {
        case .smartMode:
            smartModeUsedToday += 1
            saveUsage()
        case .aiRequest:
            aiRequestsToday += 1
            saveUsage()
        default:
            break
        }
    }

    // MARK: - Plan Properties

    var isPro: Bool {
        currentLicense.plan == .pro &&
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
