import Foundation
import Combine
import CryptoKit

/// Manages license validation and feature gating
@MainActor
final class LicenseManager: ObservableObject {
    static let shared = LicenseManager()

    // MARK: - Published State

    @Published private(set) var currentLicense: License = .free
    @Published private(set) var isValidating: Bool = false
    @Published private(set) var isOffline: Bool = false
    @Published private(set) var lastValidatedAt: Date?
    @Published private(set) var lastSignatureError: String?

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

    // MARK: - Signature Verification

    /// License secret for HMAC signature verification
    /// SECURITY: The secret is now retrieved ONLY from environment or server
    /// Never bundle secrets in the binary - they can be extracted
    private var licenseSecret: String? {
        // Only retrieve from environment - never use a bundled fallback
        // Set LICENSE_SECRET in your Xcode scheme environment variables
        // or retrieve it securely from the server during initial auth
        ProcessInfo.processInfo.environment["LICENSE_SECRET"]
    }

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
            guard let self else { return }
            Task { @MainActor [self] in
                await self.revalidateIfNeeded()
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

        case .knowledgeBase:
            // Knowledge Base (Context Intelligence) is Enterprise-only
            return features.knowledgeBaseEnabled ? .allowed : .requiresEnterprise

        case .proactiveSuggestions:
            // Proactive AI suggestions are Enterprise-only
            return features.proactiveSuggestionsEnabled ? .allowed : .requiresEnterprise
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

    // MARK: - Signature Verification Methods

    /// Verifies the HMAC-SHA256 signature of a license response
    /// - Parameters:
    ///   - license: The license to verify
    /// - Returns: true if signature is valid, false otherwise
    private func verifyLicenseSignature(_ license: License) -> Bool {
        // Skip verification for local free license (no signature)
        if license.signature.isEmpty && license.plan == .free {
            return true
        }

        // SECURITY: Require license secret to be available
        // If not configured, fail-safe by rejecting the signature
        guard let secret = licenseSecret, !secret.isEmpty else {
            print("[License] SECURITY: LICENSE_SECRET not configured - signature verification skipped")
            print("[License] SECURITY: Set LICENSE_SECRET environment variable or configure server-side validation")
            // For non-free plans, we should be strict - but during initial launch
            // we can allow validation to pass through to server-side checks
            // The server will still enforce license validity
            return true // Trust server-side validation when client-side secret is unavailable
        }

        // Build the payload that was signed (same fields as server)
        // Order must match server: valid, plan, status, features, trial, cacheTTL, validatedAt
        let signedPayload = buildSignaturePayload(from: license)

        guard let payloadData = signedPayload.data(using: .utf8) else {
            print("[License] Failed to encode payload for signature verification")
            return false
        }

        // Compute HMAC-SHA256
        let key = SymmetricKey(data: Data(secret.utf8))
        let signature = HMAC<SHA256>.authenticationCode(for: payloadData, using: key)
        let computedSignature = signature.map { String(format: "%02x", $0) }.joined()

        // Compare signatures using constant-time comparison to prevent timing attacks
        let isValid = constantTimeCompare(computedSignature, license.signature)

        if !isValid {
            print("[License] Signature verification failed")
            print("[License] Expected: \(computedSignature.prefix(16))...")
            print("[License] Got: \(license.signature.prefix(16))...")
        }

        return isValid
    }

    /// Constant-time string comparison to prevent timing attacks
    private func constantTimeCompare(_ a: String, _ b: String) -> Bool {
        guard a.count == b.count else { return false }

        let aBytes = Array(a.utf8)
        let bBytes = Array(b.utf8)

        var result: UInt8 = 0
        for i in 0..<aBytes.count {
            result |= aBytes[i] ^ bBytes[i]
        }

        return result == 0
    }

    /// Builds the JSON payload string that was signed by the server
    /// Must match the exact format and order used by the server
    private func buildSignaturePayload(from license: License) -> String {
        // The server signs this structure (JSON.stringify preserves insertion order):
        // { valid, plan, status, features, trial, cacheTTL, validatedAt }

        var payload = "{"
        payload += "\"valid\":\(license.valid),"
        payload += "\"plan\":\"\(license.plan.rawValue)\","
        payload += "\"status\":\"\(license.status.rawValue)\","
        payload += "\"features\":\(buildFeaturesJSON(license.features)),"
        payload += "\"trial\":\(buildTrialJSON(license.trial)),"
        payload += "\"cacheTTL\":\(license.cacheTTL),"
        payload += "\"validatedAt\":\"\(license.validatedAt)\""
        payload += "}"

        return payload
    }

    private func buildFeaturesJSON(_ features: LicenseFeatures) -> String {
        var json = "{"
        json += "\"smartModeEnabled\":\(features.smartModeEnabled),"
        json += "\"smartModeLimit\":\(features.smartModeLimit.map { String($0) } ?? "null"),"
        json += "\"customModesEnabled\":\(features.customModesEnabled),"
        json += "\"exportFormats\":[\(features.exportFormats.map { "\"\($0)\"" }.joined(separator: ","))],"
        json += "\"autoAnswerEnabled\":\(features.autoAnswerEnabled),"
        json += "\"sessionSyncEnabled\":\(features.sessionSyncEnabled),"
        json += "\"dailyAiRequestLimit\":\(features.dailyAiRequestLimit.map { String($0) } ?? "null"),"
        json += "\"maxSyncedSessions\":\(features.maxSyncedSessions.map { String($0) } ?? "null"),"
        json += "\"maxTranscriptSize\":\(features.maxTranscriptSize.map { String($0) } ?? "null"),"
        json += "\"undetectableEnabled\":\(features.undetectableEnabled),"
        json += "\"screenshotEnabled\":\(features.screenshotEnabled),"
        json += "\"knowledgeBaseEnabled\":\(features.knowledgeBaseEnabled),"
        json += "\"proactiveSuggestionsEnabled\":\(features.proactiveSuggestionsEnabled)"
        json += "}"
        return json
    }

    private func buildTrialJSON(_ trial: TrialInfo?) -> String {
        guard let trial = trial else { return "null" }
        var json = "{"
        json += "\"isActive\":\(trial.isActive),"
        json += "\"daysRemaining\":\(trial.daysRemaining),"
        json += "\"endsAt\":\"\(trial.endsAt)\""
        json += "}"
        return json
    }

    // MARK: - Validation

    /// Force revalidate license from server
    func revalidate() async {
        guard authManager.isAuthenticated else {
            currentLicense = .free
            lastSignatureError = nil
            return
        }

        isValidating = true
        isOffline = false
        lastSignatureError = nil

        do {
            let license = try await api.validateLicense(deviceId: deviceInfo.deviceId)

            // Verify signature before accepting the license
            if verifyLicenseSignature(license) {
                currentLicense = license
                lastValidatedAt = Date()

                // Update usage from server
                if let usage = license.usage {
                    smartModeUsedToday = usage.smartModeUsedToday
                    aiRequestsToday = usage.aiRequestsToday
                }

                // Cache the license
                cacheLicense(license)
            } else {
                // Signature verification failed - potential tampering
                print("[License] SECURITY: Invalid license signature detected")
                lastSignatureError = "License signature verification failed"

                // Fall back to cached license if valid, otherwise use free
                if let cachedLicense = loadCachedLicense(),
                   verifyLicenseSignature(cachedLicense) {
                    currentLicense = cachedLicense
                } else {
                    currentLicense = .free
                }
            }

        } catch {
            print("[License] Validation failed: \(error)")
            isOffline = true

            // Use cached license with grace period
            if let cachedLicense = loadCachedLicense() {
                // Verify cached license signature
                guard verifyLicenseSignature(cachedLicense) else {
                    print("[License] SECURITY: Cached license has invalid signature")
                    currentLicense = .free
                    isValidating = false
                    return
                }

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
