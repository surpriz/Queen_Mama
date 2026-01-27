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

struct RegistrationResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let user: AuthUser
    let message: String
    let emailVerificationRequired: Bool
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
    case enterprise = "ENTERPRISE"
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
    let undetectableEnabled: Bool
    let screenshotEnabled: Bool
    let knowledgeBaseEnabled: Bool  // Context Intelligence (Enterprise)
    let proactiveSuggestionsEnabled: Bool  // Proactive AI suggestions (Enterprise)

    // Custom decoding to handle servers that don't send new fields yet
    enum CodingKeys: String, CodingKey {
        case smartModeEnabled, smartModeLimit, customModesEnabled, exportFormats
        case autoAnswerEnabled, sessionSyncEnabled, dailyAiRequestLimit
        case maxSyncedSessions, maxTranscriptSize, undetectableEnabled, screenshotEnabled
        case knowledgeBaseEnabled, proactiveSuggestionsEnabled
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        smartModeEnabled = try container.decode(Bool.self, forKey: .smartModeEnabled)
        smartModeLimit = try container.decodeIfPresent(Int.self, forKey: .smartModeLimit)
        customModesEnabled = try container.decode(Bool.self, forKey: .customModesEnabled)
        exportFormats = try container.decode([String].self, forKey: .exportFormats)
        autoAnswerEnabled = try container.decode(Bool.self, forKey: .autoAnswerEnabled)
        sessionSyncEnabled = try container.decode(Bool.self, forKey: .sessionSyncEnabled)
        dailyAiRequestLimit = try container.decodeIfPresent(Int.self, forKey: .dailyAiRequestLimit)
        maxSyncedSessions = try container.decodeIfPresent(Int.self, forKey: .maxSyncedSessions)
        maxTranscriptSize = try container.decodeIfPresent(Int.self, forKey: .maxTranscriptSize)
        // Default to false if not present (backward compatibility)
        undetectableEnabled = try container.decodeIfPresent(Bool.self, forKey: .undetectableEnabled) ?? false
        screenshotEnabled = try container.decodeIfPresent(Bool.self, forKey: .screenshotEnabled) ?? true
        knowledgeBaseEnabled = try container.decodeIfPresent(Bool.self, forKey: .knowledgeBaseEnabled) ?? false
        proactiveSuggestionsEnabled = try container.decodeIfPresent(Bool.self, forKey: .proactiveSuggestionsEnabled) ?? false
    }

    init(
        smartModeEnabled: Bool,
        smartModeLimit: Int?,
        customModesEnabled: Bool,
        exportFormats: [String],
        autoAnswerEnabled: Bool,
        sessionSyncEnabled: Bool,
        dailyAiRequestLimit: Int?,
        maxSyncedSessions: Int?,
        maxTranscriptSize: Int?,
        undetectableEnabled: Bool = false,
        screenshotEnabled: Bool = true,
        knowledgeBaseEnabled: Bool = false,
        proactiveSuggestionsEnabled: Bool = false
    ) {
        self.smartModeEnabled = smartModeEnabled
        self.smartModeLimit = smartModeLimit
        self.customModesEnabled = customModesEnabled
        self.exportFormats = exportFormats
        self.autoAnswerEnabled = autoAnswerEnabled
        self.sessionSyncEnabled = sessionSyncEnabled
        self.dailyAiRequestLimit = dailyAiRequestLimit
        self.maxSyncedSessions = maxSyncedSessions
        self.maxTranscriptSize = maxTranscriptSize
        self.undetectableEnabled = undetectableEnabled
        self.screenshotEnabled = screenshotEnabled
        self.knowledgeBaseEnabled = knowledgeBaseEnabled
        self.proactiveSuggestionsEnabled = proactiveSuggestionsEnabled
    }

    // 4-tier model: Free users get basic features only
    static let freeDefaults = LicenseFeatures(
        smartModeEnabled: false, // Enterprise only
        smartModeLimit: 0,
        customModesEnabled: false,
        exportFormats: ["plainText"],
        autoAnswerEnabled: false, // Enterprise only
        sessionSyncEnabled: false,
        dailyAiRequestLimit: 50,
        maxSyncedSessions: 0,
        maxTranscriptSize: 10240,
        undetectableEnabled: false, // Enterprise only
        screenshotEnabled: true,
        knowledgeBaseEnabled: false, // Enterprise only
        proactiveSuggestionsEnabled: false // Enterprise only
    )

    // PRO tier: Unlimited standard AI, sync, custom modes - but no premium features
    static let proDefaults = LicenseFeatures(
        smartModeEnabled: false, // Enterprise only
        smartModeLimit: 0,
        customModesEnabled: true,
        exportFormats: ["plainText", "markdown", "json"],
        autoAnswerEnabled: false, // Enterprise only
        sessionSyncEnabled: true,
        dailyAiRequestLimit: nil, // unlimited
        maxSyncedSessions: nil, // unlimited
        maxTranscriptSize: 1048576,
        undetectableEnabled: false, // Enterprise only
        screenshotEnabled: true,
        knowledgeBaseEnabled: false, // Enterprise only
        proactiveSuggestionsEnabled: false // Enterprise only
    )

    // Enterprise tier: All features unlocked
    static let enterpriseDefaults = LicenseFeatures(
        smartModeEnabled: true,
        smartModeLimit: nil, // unlimited
        customModesEnabled: true,
        exportFormats: ["plainText", "markdown", "json"],
        autoAnswerEnabled: true,
        sessionSyncEnabled: true,
        dailyAiRequestLimit: nil, // unlimited
        maxSyncedSessions: nil, // unlimited
        maxTranscriptSize: 10485760, // 10MB
        undetectableEnabled: true,
        screenshotEnabled: true,
        knowledgeBaseEnabled: true, // Context Intelligence enabled
        proactiveSuggestionsEnabled: true // Proactive suggestions enabled
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
    case undetectable
    case screenshot
    case sessionStart
    case knowledgeBase  // Context Intelligence feedback (Enterprise)
    case proactiveSuggestions  // Proactive AI suggestions (Enterprise)
}

enum FeatureAccess: Equatable {
    case allowed
    case limitReached(used: Int, limit: Int)
    case requiresPro
    case requiresEnterprise
    case requiresAuth
    case blocked // For unauthenticated users trying to use any feature

    var isAllowed: Bool {
        if case .allowed = self { return true }
        return false
    }

    var errorMessage: String {
        switch self {
        case .allowed:
            return ""
        case .limitReached(let used, let limit):
            return "Daily limit reached (\(used)/\(limit)). Upgrade to continue."
        case .requiresPro:
            return "This feature requires a PRO subscription."
        case .requiresEnterprise:
            return "This feature requires an Enterprise subscription."
        case .requiresAuth:
            return "Please sign in to use this feature."
        case .blocked:
            return "Please sign in to access Queen Mama features."
        }
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case notAuthenticated
    case invalidCredentials
    case accountBlocked
    case oauthUserNeedsDeviceCode
    case oauthUserNeedsGoogle
    case credentialsAccountExists
    case deviceLimitReached
    case networkError(Error)
    case serverError(String)
    case tokenExpired
    case invalidToken
    case emailAlreadyExists
    case oauthAccountExists
    case weakPassword(String)

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
        case .oauthUserNeedsGoogle:
            return "This account uses Google Sign-In. Please sign in with Google."
        case .credentialsAccountExists:
            return "This email already has a password account. Please sign in with email and password."
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
        case .emailAlreadyExists:
            return "An account with this email already exists. Try signing in instead."
        case .oauthAccountExists:
            return "This email uses Google Sign-In. Please sign in with Google."
        case .weakPassword(let message):
            return message
        }
    }
}
