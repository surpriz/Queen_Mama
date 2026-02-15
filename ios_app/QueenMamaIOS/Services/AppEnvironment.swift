import Foundation

/// Application environment configuration
/// Controls API endpoints and other environment-specific settings
enum AppEnvironment: String, CaseIterable {
    case development  // localhost:3000
    case staging      // staging.queenmama.co
    case production   // www.queenmama.co

    /// Current active environment
    static var current: AppEnvironment {
        // 1. Check for environment variable override (useful for testing)
        if let envOverride = ProcessInfo.processInfo.environment["APP_ENVIRONMENT"],
           let env = AppEnvironment(rawValue: envOverride.lowercased()) {
            return env
        }

        // 2. Check UserDefaults override (for dev testing via Settings)
        if let savedEnv = UserDefaults.standard.string(forKey: "appEnvironment"),
           let env = AppEnvironment(rawValue: savedEnv) {
            return env
        }

        // 3. Default based on build configuration
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }

    /// API base URL for this environment
    var apiBaseURL: String {
        switch self {
        case .development:
            return "http://localhost:3000"
        case .staging:
            return "https://staging.queenmama.co"
        case .production:
            return "https://www.queenmama.co"
        }
    }

    /// Display name for UI
    var displayName: String {
        switch self {
        case .development:
            return "Development (localhost)"
        case .staging:
            return "Staging"
        case .production:
            return "Production"
        }
    }

    /// Whether this is a production environment
    var isProduction: Bool {
        self == .production
    }

    // MARK: - Runtime Override (for testing)

    /// Override the environment at runtime (persisted in UserDefaults)
    /// Only available in DEBUG builds
    static func setOverride(_ environment: AppEnvironment?) {
        #if DEBUG
        if let env = environment {
            UserDefaults.standard.set(env.rawValue, forKey: "appEnvironment")
            print("[AppEnvironment] Override set to: \(env.displayName)")
        } else {
            UserDefaults.standard.removeObject(forKey: "appEnvironment")
            print("[AppEnvironment] Override cleared")
        }
        #endif
    }

    /// Clear any runtime override
    static func clearOverride() {
        setOverride(nil)
    }
}

// MARK: - Debug Helpers

#if DEBUG
extension AppEnvironment {
    /// Print current environment info (for debugging)
    static func printCurrentInfo() {
        print("""
        [AppEnvironment] Current Configuration:
          - Environment: \(current.displayName)
          - API URL: \(current.apiBaseURL)
          - Is Production: \(current.isProduction)
        """)
    }
}
#endif
