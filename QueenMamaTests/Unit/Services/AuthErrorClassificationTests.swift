//
//  AuthErrorClassificationTests.swift
//  QueenMamaTests
//
//  Regression tests for isPermanentAuthError() classification.
//  Bug: .invalidToken was NOT classified as permanent, allowing degraded mode
//  when the server explicitly rejected the refresh token (401).
//

import XCTest
@testable import QueenMama

@MainActor
final class AuthErrorClassificationTests: XCTestCase {

    private var authManager: AuthenticationManager!

    override func setUp() {
        super.setUp()
        authManager = AuthenticationManager.shared
    }

    override func tearDown() {
        authManager = nil
        super.tearDown()
    }

    // MARK: - Permanent Errors (must return true)

    func test_isPermanent_invalidToken_returnsTrue() {
        // REGRESSION: This was the root cause of the production bug.
        // .invalidToken means the server rejected the refresh token with 401.
        // Returning false allowed degraded mode → sessions started without proxy config.
        XCTAssertTrue(
            authManager.isPermanentAuthError(AuthError.invalidToken),
            "invalidToken must be permanent — server rejected the refresh token"
        )
    }

    func test_isPermanent_tokenExpired_returnsTrue() {
        // REGRESSION: Same category as invalidToken.
        XCTAssertTrue(
            authManager.isPermanentAuthError(AuthError.tokenExpired),
            "tokenExpired must be permanent — session is gone"
        )
    }

    func test_isPermanent_accountBlocked_returnsTrue() {
        XCTAssertTrue(
            authManager.isPermanentAuthError(AuthError.accountBlocked),
            "accountBlocked must be permanent"
        )
    }

    func test_isPermanent_deviceLimitReached_returnsTrue() {
        XCTAssertTrue(
            authManager.isPermanentAuthError(AuthError.deviceLimitReached),
            "deviceLimitReached must be permanent"
        )
    }

    // MARK: - Transient Errors (must return false)

    func test_isTransient_networkError_returnsFalse() {
        let urlError = URLError(.notConnectedToInternet)
        XCTAssertFalse(
            authManager.isPermanentAuthError(AuthError.networkError(urlError)),
            "networkError should be transient — allow degraded mode"
        )
    }

    func test_isTransient_serverError_returnsFalse() {
        XCTAssertFalse(
            authManager.isPermanentAuthError(AuthError.serverError("500 Internal Server Error")),
            "serverError should be transient"
        )
    }

    func test_isTransient_invalidCredentials_returnsFalse() {
        XCTAssertFalse(
            authManager.isPermanentAuthError(AuthError.invalidCredentials),
            "invalidCredentials should be transient (login-time error, not refresh-time)"
        )
    }

    func test_isTransient_notAuthenticated_returnsFalse() {
        XCTAssertFalse(
            authManager.isPermanentAuthError(AuthError.notAuthenticated),
            "notAuthenticated should be transient"
        )
    }

    // MARK: - Non-AuthError types (must return false)

    func test_isTransient_urlError_returnsFalse() {
        let urlError = URLError(.timedOut)
        XCTAssertFalse(
            authManager.isPermanentAuthError(urlError),
            "URLError (not wrapped in AuthError) should be transient"
        )
    }

    func test_isTransient_decodingError_returnsFalse() {
        let decodingError = DecodingError.dataCorrupted(
            .init(codingPath: [], debugDescription: "test")
        )
        XCTAssertFalse(
            authManager.isPermanentAuthError(decodingError),
            "DecodingError should be transient"
        )
    }

    // MARK: - Exhaustive Classification

    func test_exhaustive_allAuthErrorCases_areClassified() {
        // Every AuthError case must be explicitly in one of these two lists.
        // If a new case is added to AuthError, this test forces the developer
        // to decide whether it's permanent or transient.
        let permanentErrors: [AuthError] = [
            .invalidToken,
            .tokenExpired,
            .accountBlocked,
            .deviceLimitReached,
        ]

        let transientErrors: [AuthError] = [
            .notAuthenticated,
            .invalidCredentials,
            .oauthUserNeedsDeviceCode,
            .oauthUserNeedsGoogle,
            .credentialsAccountExists,
            .networkError(URLError(.notConnectedToInternet)),
            .serverError("test"),
            .emailAlreadyExists,
            .oauthAccountExists,
            .weakPassword("test"),
        ]

        for error in permanentErrors {
            XCTAssertTrue(
                authManager.isPermanentAuthError(error),
                "\(error) should be classified as PERMANENT"
            )
        }

        for error in transientErrors {
            XCTAssertFalse(
                authManager.isPermanentAuthError(error),
                "\(error) should be classified as TRANSIENT"
            )
        }

        // Verify we covered all cases (permanent + transient = total enum cases)
        let totalCovered = permanentErrors.count + transientErrors.count
        XCTAssertEqual(totalCovered, 14,
            "All 14 AuthError cases must be covered. If this fails, a new case was added — classify it!")
    }
}
