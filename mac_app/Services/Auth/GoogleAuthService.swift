import Foundation
import AuthenticationServices
import CryptoKit

/// Google OAuth service using ASWebAuthenticationSession with PKCE
@MainActor
final class GoogleAuthService: NSObject, ObservableObject {
    static let shared = GoogleAuthService()

    // Google OAuth configuration (iOS client type uses reversed client ID as scheme)
    private let clientId: String
    private var redirectScheme: String {
        // Reversed client ID format for iOS OAuth clients
        let parts = clientId.split(separator: ".")
        if parts.count >= 3 {
            return "com.googleusercontent.apps.\(parts[0])"
        }
        return "com.googleusercontent.apps"
    }
    private var redirectUri: String {
        "\(redirectScheme):/oauth2callback"
    }

    // PKCE state
    private var currentCodeVerifier: String?
    private var authSession: ASWebAuthenticationSession?

    @Published private(set) var isAuthenticating = false

    private override init() {
        // Load client ID from Info.plist or environment
        #if DEBUG
        self.clientId = ProcessInfo.processInfo.environment["GOOGLE_CLIENT_ID"]
            ?? Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_ID") as? String
            ?? ""
        #else
        self.clientId = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_ID") as? String ?? ""
        #endif

        super.init()

        if clientId.isEmpty {
            print("[GoogleAuth] Warning: GOOGLE_CLIENT_ID not configured")
        }
    }

    // MARK: - Public API

    /// Start Google Sign-In flow using ASWebAuthenticationSession
    /// Returns the authorization code and code verifier for backend exchange
    func startGoogleSignIn() async throws -> GoogleAuthResult {
        guard !clientId.isEmpty else {
            throw GoogleAuthError.notConfigured
        }

        isAuthenticating = true
        defer { isAuthenticating = false }

        // Generate PKCE code verifier and challenge
        let codeVerifier = generateCodeVerifier()
        let codeChallenge = generateCodeChallenge(from: codeVerifier)
        currentCodeVerifier = codeVerifier

        // Build authorization URL
        let authURL = buildAuthorizationURL(codeChallenge: codeChallenge)

        print("[GoogleAuth] Starting OAuth flow with URL: \(authURL)")

        // Start ASWebAuthenticationSession
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: redirectScheme
            ) { [weak self] callbackURL, error in
                guard let self = self else {
                    continuation.resume(throwing: GoogleAuthError.sessionDeallocated)
                    return
                }

                if let error = error {
                    if let asError = error as? ASWebAuthenticationSessionError,
                       asError.code == .canceledLogin {
                        continuation.resume(throwing: GoogleAuthError.userCancelled)
                    } else {
                        continuation.resume(throwing: GoogleAuthError.authenticationFailed(error.localizedDescription))
                    }
                    return
                }

                guard let callbackURL = callbackURL else {
                    continuation.resume(throwing: GoogleAuthError.noCallback)
                    return
                }

                print("[GoogleAuth] Received callback: \(callbackURL)")

                // Parse authorization code from callback URL
                do {
                    let authCode = try self.parseAuthorizationCode(from: callbackURL)

                    guard let verifier = self.currentCodeVerifier else {
                        throw GoogleAuthError.missingCodeVerifier
                    }

                    let result = GoogleAuthResult(
                        authorizationCode: authCode,
                        codeVerifier: verifier,
                        redirectUri: self.redirectUri
                    )

                    self.currentCodeVerifier = nil
                    continuation.resume(returning: result)

                } catch {
                    continuation.resume(throwing: error)
                }
            }

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false // Allow auto-fill of credentials

            self.authSession = session

            if !session.start() {
                continuation.resume(throwing: GoogleAuthError.failedToStartSession)
            }
        }
    }

    /// Cancel any ongoing authentication session
    func cancelAuthentication() {
        authSession?.cancel()
        authSession = nil
        currentCodeVerifier = nil
        isAuthenticating = false
    }

    // MARK: - PKCE Generation

    /// Generate a random code verifier (43-128 characters)
    private func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Generate SHA256 code challenge from verifier
    private func generateCodeChallenge(from verifier: String) -> String {
        let data = Data(verifier.utf8)
        let hash = SHA256.hash(data: data)
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    // MARK: - URL Building

    private func buildAuthorizationURL(codeChallenge: String) -> URL {
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!

        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectUri),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "select_account"), // Always show account picker
        ]

        return components.url!
    }

    // MARK: - Response Parsing

    private func parseAuthorizationCode(from url: URL) throws -> String {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw GoogleAuthError.invalidCallback
        }

        // Check for error in callback
        if let error = components.queryItems?.first(where: { $0.name == "error" })?.value {
            let description = components.queryItems?.first(where: { $0.name == "error_description" })?.value
            throw GoogleAuthError.oauthError(error: error, description: description)
        }

        // Extract authorization code
        guard let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
            throw GoogleAuthError.missingAuthorizationCode
        }

        return code
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension GoogleAuthService: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // Return the key window for presentation
        NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first ?? NSWindow()
    }
}

// MARK: - Supporting Types

struct GoogleAuthResult {
    let authorizationCode: String
    let codeVerifier: String
    let redirectUri: String
}

enum GoogleAuthError: LocalizedError, Equatable {
    case notConfigured
    case userCancelled
    case authenticationFailed(String)
    case noCallback
    case invalidCallback
    case missingAuthorizationCode
    case missingCodeVerifier
    case oauthError(error: String, description: String?)
    case sessionDeallocated
    case failedToStartSession

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Google Sign-In is not configured. Please contact support."
        case .userCancelled:
            return "Sign-in was cancelled."
        case .authenticationFailed(let message):
            return "Authentication failed: \(message)"
        case .noCallback:
            return "No callback received from Google."
        case .invalidCallback:
            return "Invalid callback received from Google."
        case .missingAuthorizationCode:
            return "Authorization code not found in callback."
        case .missingCodeVerifier:
            return "Internal error: code verifier missing."
        case .oauthError(let error, let description):
            return description ?? "OAuth error: \(error)"
        case .sessionDeallocated:
            return "Authentication session was unexpectedly terminated."
        case .failedToStartSession:
            return "Failed to start authentication session."
        }
    }

    // Custom Equatable implementation for enums with associated values
    static func == (lhs: GoogleAuthError, rhs: GoogleAuthError) -> Bool {
        switch (lhs, rhs) {
        case (.notConfigured, .notConfigured),
             (.userCancelled, .userCancelled),
             (.noCallback, .noCallback),
             (.invalidCallback, .invalidCallback),
             (.missingAuthorizationCode, .missingAuthorizationCode),
             (.missingCodeVerifier, .missingCodeVerifier),
             (.sessionDeallocated, .sessionDeallocated),
             (.failedToStartSession, .failedToStartSession):
            return true
        case (.authenticationFailed(let lhsMsg), .authenticationFailed(let rhsMsg)):
            return lhsMsg == rhsMsg
        case (.oauthError(let lhsError, let lhsDesc), .oauthError(let rhsError, let rhsDesc)):
            return lhsError == rhsError && lhsDesc == rhsDesc
        default:
            return false
        }
    }
}
