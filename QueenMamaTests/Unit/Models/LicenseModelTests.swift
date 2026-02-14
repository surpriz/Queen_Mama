//
//  LicenseModelTests.swift
//  QueenMamaTests
//
//  Tests for License, LicenseFeatures, FeatureAccess:
//  - Feature defaults per tier (Free/Pro/Enterprise)
//  - FeatureAccess enum properties
//  - License static defaults
//

import XCTest
@testable import QueenMama

final class LicenseModelTests: XCTestCase {

    // MARK: - Free Tier Defaults

    func testFreeTierDefaults() {
        let features = LicenseFeatures.freeDefaults

        XCTAssertFalse(features.smartModeEnabled, "Free tier should not have smart mode")
        XCTAssertEqual(features.smartModeLimit, 0, "Free tier smart mode limit should be 0")
        XCTAssertFalse(features.customModesEnabled, "Free tier should not have custom modes")
        XCTAssertEqual(features.exportFormats, ["plainText"], "Free tier should only have plainText export")
        XCTAssertFalse(features.autoAnswerEnabled, "Free tier should not have auto answer")
        XCTAssertFalse(features.sessionSyncEnabled, "Free tier should not have session sync")
        XCTAssertEqual(features.dailyAiRequestLimit, 50, "Free tier should have 50 daily AI requests")
        XCTAssertEqual(features.maxSyncedSessions, 0, "Free tier should have 0 synced sessions")
        XCTAssertEqual(features.maxTranscriptSize, 10240, "Free tier transcript size should be 10KB")
        XCTAssertFalse(features.undetectableEnabled, "Free tier should not have undetectable")
        XCTAssertTrue(features.screenshotEnabled, "Free tier should have screenshot enabled")
        XCTAssertFalse(features.knowledgeBaseEnabled, "Free tier should not have knowledge base")
        XCTAssertFalse(features.proactiveSuggestionsEnabled, "Free tier should not have proactive suggestions")
    }

    // MARK: - Pro Tier Defaults

    func testProTierDefaults() {
        let features = LicenseFeatures.proDefaults

        XCTAssertFalse(features.smartModeEnabled, "Pro tier should not have smart mode (Enterprise only)")
        XCTAssertTrue(features.customModesEnabled, "Pro tier should have custom modes")
        XCTAssertTrue(features.exportFormats.contains("markdown"), "Pro tier should support markdown export")
        XCTAssertTrue(features.exportFormats.contains("json"), "Pro tier should support json export")
        XCTAssertFalse(features.autoAnswerEnabled, "Pro tier should not have auto answer (Enterprise only)")
        XCTAssertTrue(features.sessionSyncEnabled, "Pro tier should have session sync")
        XCTAssertNil(features.dailyAiRequestLimit, "Pro tier should have unlimited AI requests")
        XCTAssertNil(features.maxSyncedSessions, "Pro tier should have unlimited synced sessions")
        XCTAssertEqual(features.maxTranscriptSize, 1048576, "Pro tier transcript size should be 1MB")
        XCTAssertFalse(features.undetectableEnabled, "Pro tier should not have undetectable (Enterprise only)")
        XCTAssertFalse(features.knowledgeBaseEnabled, "Pro tier should not have knowledge base (Enterprise only)")
        XCTAssertFalse(features.proactiveSuggestionsEnabled, "Pro tier should not have proactive (Enterprise only)")
    }

    // MARK: - Enterprise Tier Defaults

    func testEnterpriseTierDefaults() {
        let features = LicenseFeatures.enterpriseDefaults

        XCTAssertTrue(features.smartModeEnabled, "Enterprise should have smart mode")
        XCTAssertNil(features.smartModeLimit, "Enterprise should have unlimited smart mode")
        XCTAssertTrue(features.customModesEnabled, "Enterprise should have custom modes")
        XCTAssertTrue(features.exportFormats.contains("markdown"), "Enterprise should support markdown")
        XCTAssertTrue(features.exportFormats.contains("json"), "Enterprise should support json")
        XCTAssertTrue(features.autoAnswerEnabled, "Enterprise should have auto answer")
        XCTAssertTrue(features.sessionSyncEnabled, "Enterprise should have session sync")
        XCTAssertNil(features.dailyAiRequestLimit, "Enterprise should have unlimited AI requests")
        XCTAssertNil(features.maxSyncedSessions, "Enterprise should have unlimited synced sessions")
        XCTAssertEqual(features.maxTranscriptSize, 10485760, "Enterprise transcript size should be 10MB")
        XCTAssertTrue(features.undetectableEnabled, "Enterprise should have undetectable")
        XCTAssertTrue(features.screenshotEnabled, "Enterprise should have screenshot")
        XCTAssertTrue(features.knowledgeBaseEnabled, "Enterprise should have knowledge base")
        XCTAssertTrue(features.proactiveSuggestionsEnabled, "Enterprise should have proactive suggestions")
    }

    // MARK: - FeatureAccess Properties

    func testFeatureAccessAllowedIsAllowed() {
        XCTAssertTrue(FeatureAccess.allowed.isAllowed)
    }

    func testFeatureAccessBlockedIsNotAllowed() {
        XCTAssertFalse(FeatureAccess.blocked.isAllowed)
        XCTAssertFalse(FeatureAccess.requiresPro.isAllowed)
        XCTAssertFalse(FeatureAccess.requiresEnterprise.isAllowed)
        XCTAssertFalse(FeatureAccess.requiresAuth.isAllowed)
        XCTAssertFalse(FeatureAccess.limitReached(used: 50, limit: 50).isAllowed)
    }

    func testFeatureAccessErrorMessages() {
        XCTAssertEqual(FeatureAccess.allowed.errorMessage, "")
        XCTAssertTrue(FeatureAccess.requiresPro.errorMessage.contains("PRO"))
        XCTAssertTrue(FeatureAccess.requiresEnterprise.errorMessage.contains("Enterprise"))
        XCTAssertTrue(FeatureAccess.requiresAuth.errorMessage.contains("sign in"))
        XCTAssertTrue(FeatureAccess.blocked.errorMessage.contains("sign in"))
        XCTAssertTrue(FeatureAccess.limitReached(used: 50, limit: 50).errorMessage.contains("50/50"))
    }

    // MARK: - FeatureAccess Equality

    func testFeatureAccessEquality() {
        XCTAssertEqual(FeatureAccess.allowed, FeatureAccess.allowed)
        XCTAssertEqual(FeatureAccess.blocked, FeatureAccess.blocked)
        XCTAssertEqual(FeatureAccess.requiresPro, FeatureAccess.requiresPro)
        XCTAssertNotEqual(FeatureAccess.allowed, FeatureAccess.blocked)
        XCTAssertEqual(
            FeatureAccess.limitReached(used: 10, limit: 50),
            FeatureAccess.limitReached(used: 10, limit: 50)
        )
    }

    // MARK: - License Static

    func testFreeLicenseDefaults() {
        let license = License.free
        XCTAssertTrue(license.valid)
        XCTAssertEqual(license.plan, .free)
        XCTAssertEqual(license.status, .active)
        XCTAssertNil(license.trial)
        XCTAssertEqual(license.signature, "")
    }

    // MARK: - Subscription Plan/Status

    func testSubscriptionPlanRawValues() {
        XCTAssertEqual(SubscriptionPlan.free.rawValue, "FREE")
        XCTAssertEqual(SubscriptionPlan.pro.rawValue, "PRO")
        XCTAssertEqual(SubscriptionPlan.enterprise.rawValue, "ENTERPRISE")
    }

    func testSubscriptionStatusRawValues() {
        XCTAssertEqual(SubscriptionStatus.active.rawValue, "ACTIVE")
        XCTAssertEqual(SubscriptionStatus.trialing.rawValue, "TRIALING")
        XCTAssertEqual(SubscriptionStatus.pastDue.rawValue, "PAST_DUE")
        XCTAssertEqual(SubscriptionStatus.canceled.rawValue, "CANCELED")
        XCTAssertEqual(SubscriptionStatus.incomplete.rawValue, "INCOMPLETE")
    }
}
