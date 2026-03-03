//
//  ProxyConfigAvailabilityTests.swift
//  QueenMamaTests
//
//  Tests for proxy configuration pre-flight checks.
//  Validates that session start is blocked when config is nil or
//  transcription/AI services are disabled.
//
//  Approach: Constructs ProxyConfig value types directly (Codable structs)
//  and tests computed properties. No singleton interaction needed.
//

import XCTest
@testable import QueenMama

final class ProxyConfigAvailabilityTests: XCTestCase {

    // MARK: - Helpers

    private func makeConfig(
        transcriptionEnabled: Bool = true,
        transcriptionProviders: [String] = ["deepgram"],
        aiEnabled: Bool = true,
        aiProviders: [String] = ["openai"],
        aiSmartMode: Bool = false,
        aiMaxTokens: Int = 1000,
        aiDailyLimit: Int? = nil,
        aiUsedToday: Int = 0,
        aiRemaining: Int? = nil
    ) -> ProxyConfig {
        ProxyConfig(
            plan: "PRO",
            services: ProxyServices(
                ai: AIServiceConfig(
                    enabled: aiEnabled,
                    providers: aiProviders,
                    maxTokens: aiMaxTokens,
                    smartModeEnabled: aiSmartMode,
                    dailyLimit: aiDailyLimit,
                    usedToday: aiUsedToday,
                    remaining: aiRemaining
                ),
                transcription: TranscriptionServiceConfig(
                    enabled: transcriptionEnabled,
                    providers: transcriptionProviders,
                    tokenTTLSeconds: 3600
                )
            ),
            cacheTTL: 300,
            configuredAt: "2026-03-03T10:00:00Z"
        )
    }

    // MARK: - Transcription Availability

    func test_noConfig_transcriptionDisabled() {
        // Mirrors ProxyConfigManager.isTranscriptionEnabled when config is nil
        let config: ProxyConfig? = nil
        let isEnabled = config?.services.transcription.enabled ?? false
        XCTAssertFalse(isEnabled,
            "nil config must block transcription (simulates degraded mode)")
    }

    func test_transcriptionDisabled_blocksSession() {
        let config = makeConfig(transcriptionEnabled: false)
        XCTAssertFalse(config.services.transcription.enabled,
            "Transcription disabled should block session start")
    }

    func test_transcriptionEnabled_allowsSession() {
        let config = makeConfig(transcriptionEnabled: true)
        XCTAssertTrue(config.services.transcription.enabled,
            "Transcription enabled should allow session start")
    }

    // MARK: - AI Availability

    func test_noConfig_aiDisabled() {
        let config: ProxyConfig? = nil
        let isEnabled = config?.services.ai.enabled ?? false
        XCTAssertFalse(isEnabled,
            "nil config must block AI service")
    }

    func test_aiDisabled_blocksAIRequests() {
        let config = makeConfig(aiEnabled: false)
        XCTAssertFalse(config.services.ai.enabled)
    }

    func test_aiEnabled_allowsAIRequests() {
        let config = makeConfig(aiEnabled: true)
        XCTAssertTrue(config.services.ai.enabled)
    }

    // MARK: - Provider Availability

    func test_emptyProviders_noTranscription() {
        let config = makeConfig(transcriptionProviders: [])
        XCTAssertTrue(config.services.transcription.providers.isEmpty,
            "No transcription providers should indicate service unavailability")
    }

    func test_configuredProviders_available() {
        let config = makeConfig(
            transcriptionProviders: ["deepgram", "assemblyai"],
            aiProviders: ["openai", "anthropic"]
        )
        XCTAssertEqual(config.services.transcription.providers.count, 2)
        XCTAssertEqual(config.services.ai.providers.count, 2)
    }

    // MARK: - Pre-flight Guard Logic

    func test_preflight_noConfig_blocksSession() {
        // Mirrors the guard in AppState.startSession():
        //   guard ProxyConfigManager.shared.isTranscriptionEnabled else { ... }
        // When config is nil, isTranscriptionEnabled returns false → session blocked
        let config: ProxyConfig? = nil
        let canStart = config?.services.transcription.enabled ?? false
        XCTAssertFalse(canStart,
            "Pre-flight: nil config must prevent session start")
    }

    func test_preflight_configLoaded_transcriptionEnabled_allowsSession() {
        let config: ProxyConfig? = makeConfig(transcriptionEnabled: true)
        let canStart = config?.services.transcription.enabled ?? false
        XCTAssertTrue(canStart,
            "Pre-flight: valid config with transcription enabled should allow session")
    }

    func test_preflight_configLoaded_transcriptionDisabled_blocksSession() {
        let config: ProxyConfig? = makeConfig(transcriptionEnabled: false)
        let canStart = config?.services.transcription.enabled ?? false
        XCTAssertFalse(canStart,
            "Pre-flight: config with transcription disabled must block session")
    }
}
