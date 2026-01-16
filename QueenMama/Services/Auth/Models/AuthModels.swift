import Foundation

// MARK: - Auth State

enum AuthState: Equatable {
    case unknown
    case unauthenticated
    case deviceCodePending(userCode: String, deviceCode: String, expiresAt: Date)
    case authenticating
    case authenticated(user: AuthUser)
    case error(message: String)
}

// MARK: - Auth User

struct AuthUser: Codable, Equatable {
    let id: String
    let email: String
    let name: String?

    var displayName: String {
        name ?? email.components(separatedBy: "@").first ?? email
    }
}

// MARK: - Auth Tokens

struct AuthTokens: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int

    var expiresAt: Date {
        Date().addingTimeInterval(TimeInterval(expiresIn))
    }
}

// MARK: - Device Info

struct DeviceInfo: Codable {
    let deviceId: String
    let name: String
    let platform: String
    let osVersion: String?
    let appVersion: String?

    static func current() -> DeviceInfo {
        let deviceId = DeviceIdentifier.shared.getOrCreateDeviceId()
        let name = Host.current().localizedName ?? "Mac"
        let platform = "macOS"
        let osVersion = ProcessInfo.processInfo.operatingSystemVersionString
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String

        return DeviceInfo(
            deviceId: deviceId,
            name: name,
            platform: platform,
            osVersion: osVersion,
            appVersion: appVersion
        )
    }
}

// MARK: - API Response Types

struct DeviceCodeResponse: Codable {
    let userCode: String
    let deviceCode: String
    let expiresIn: Int
    let interval: Int
    let verificationUrl: String
}

struct LoginResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let user: AuthUser
}

struct RefreshResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}

struct DevicePollResponse: Codable {
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let user: AuthUser?
    let error: String?
    let message: String?
}

// MARK: - License Types

struct License: Codable, Equatable {
    let valid: Bool
    let plan: SubscriptionPlan
    let status: SubscriptionStatus
    let features: LicenseFeatures
    let trial: TrialInfo?
    let cacheTTL: Int
    let validatedAt: String
    let usage: UsageStats?
    let signature: String

    static let free = License(
        valid: true,
        plan: .free,
        status: .active,
        features: .freeDefaults,
        trial: nil,
        cacheTTL: 86400,
        validatedAt: ISO8601DateFormatter().string(from: Date()),
        usage: nil,
        signature: ""
    )
}

enum SubscriptionPlan: String, Codable {
    case free = "FREE"
    case pro = "PRO"
}

enum SubscriptionStatus: String, Codable {
    case active = "ACTIVE"
    case trialing = "TRIALING"
    case pastDue = "PAST_DUE"
    case canceled = "CANCELED"
    case incomplete = "INCOMPLETE"
}

struct LicenseFeatures: Codable, Equatable {
    let smartModeEnabled: Bool
    let smartModeLimit: Int?
    let customModesEnabled: Bool
    let exportFormats: [String]
    let autoAnswerEnabled: Bool
    let sessionSyncEnabled: Bool
    let dailyAiRequestLimit: Int?
    let maxSyncedSessions: Int?
    let maxTranscriptSize: Int?

    static let freeDefaults = LicenseFeatures(
        smartModeEnabled: true,
        smartModeLimit: 5,
        customModesEnabled: false,
        exportFormats: ["plainText"],
        autoAnswerEnabled: false,
        sessionSyncEnabled: false,
        dailyAiRequestLimit: 50,
        maxSyncedSessions: 5,
        maxTranscriptSize: 10240
    )

    static let proDefaults = LicenseFeatures(
        smartModeEnabled: true,
        smartModeLimit: nil,
        customModesEnabled: true,
        exportFormats: ["plainText", "markdown", "json"],
        autoAnswerEnabled: true,
        sessionSyncEnabled: true,
        dailyAiRequestLimit: nil,
        maxSyncedSessions: nil,
        maxTranscriptSize: 1048576
    )
}

struct TrialInfo: Codable, Equatable {
    let isActive: Bool
    let daysRemaining: Int
    let endsAt: String
}

struct UsageStats: Codable, Equatable {
    let smartModeUsedToday: Int
    let aiRequestsToday: Int
}

// MARK: - Feature Access

enum Feature {
    case smartMode
    case customModes
    case exportMarkdown
    case exportJson
    case autoAnswer
    case sessionSync
    case aiRequest
}

enum FeatureAccess {
    case allowed
    case limitReached(used: Int, limit: Int)
    case requiresPro
    case requiresAuth
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case notAuthenticated
    case invalidCredentials
    case accountBlocked
    case oauthUserNeedsDeviceCode
    case deviceLimitReached
    case networkError(Error)
    case serverError(String)
    case tokenExpired
    case invalidToken

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Please sign in to continue"
        case .invalidCredentials:
            return "Invalid email or password"
        case .accountBlocked:
            return "Your account has been blocked"
        case .oauthUserNeedsDeviceCode:
            return "Please use the device code flow to sign in"
        case .deviceLimitReached:
            return "Maximum device limit reached"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let message):
            return message
        case .tokenExpired:
            return "Session expired. Please sign in again."
        case .invalidToken:
            return "Invalid session. Please sign in again."
        }
    }
}
