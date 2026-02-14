//
//  HealthCheckServiceTests.swift
//  QueenMamaTests
//
//  Tests for HealthCheckService:
//  - Threshold constants validation
//  - HealthStatus enum values and properties
//  - HealthCheck struct
//  - AnomalyType enum values
//  - Severity enum values
//  - Recording metrics (AI response time, transcription latency, words, reconnects)
//
//  Note: HealthCheckService is a singleton with @MainActor. We test the
//  public recording methods and type definitions. Some behavior depends on
//  analytics services (PostHog, Sentry) which are not available in test.
//

import XCTest
@testable import QueenMama

@MainActor
final class HealthCheckServiceTests: XCTestCase {

    // MARK: - Threshold Constants

    func test_thresholds_maxMemoryMB_is500() {
        XCTAssertEqual(
            HealthCheckService.Thresholds.maxMemoryMB, 500,
            "Max memory threshold should be 500 MB"
        )
    }

    func test_thresholds_maxAIResponseTimeMs_is10000() {
        XCTAssertEqual(
            HealthCheckService.Thresholds.maxAIResponseTimeMs, 10_000,
            "Max AI response time threshold should be 10000 ms"
        )
    }

    func test_thresholds_maxTranscriptionLatencyMs_is2000() {
        XCTAssertEqual(
            HealthCheckService.Thresholds.maxTranscriptionLatencyMs, 2_000,
            "Max transcription latency threshold should be 2000 ms"
        )
    }

    func test_thresholds_minTranscriptionWordsPerMinute_is10() {
        XCTAssertEqual(
            HealthCheckService.Thresholds.minTranscriptionWordsPerMinute, 10,
            "Minimum transcription words per minute should be 10"
        )
    }

    func test_thresholds_maxWebSocketReconnects_is3() {
        XCTAssertEqual(
            HealthCheckService.Thresholds.maxWebSocketReconnects, 3,
            "Max WebSocket reconnects threshold should be 3"
        )
    }

    // MARK: - HealthStatus Enum

    func test_healthStatus_rawValues() {
        XCTAssertEqual(HealthCheckService.HealthStatus.healthy.rawValue, "healthy")
        XCTAssertEqual(HealthCheckService.HealthStatus.warning.rawValue, "warning")
        XCTAssertEqual(HealthCheckService.HealthStatus.critical.rawValue, "critical")
    }

    func test_healthStatus_colors() {
        XCTAssertEqual(HealthCheckService.HealthStatus.healthy.color, "green")
        XCTAssertEqual(HealthCheckService.HealthStatus.warning.color, "yellow")
        XCTAssertEqual(HealthCheckService.HealthStatus.critical.color, "red")
    }

    // MARK: - HealthCheck Struct

    func test_healthCheck_initialization() {
        let check = HealthCheckService.HealthCheck(
            id: "test_check",
            name: "Test Check",
            status: .healthy,
            detail: "All good",
            value: 42.0
        )

        XCTAssertEqual(check.id, "test_check")
        XCTAssertEqual(check.name, "Test Check")
        XCTAssertEqual(check.status, .healthy)
        XCTAssertEqual(check.detail, "All good")
        XCTAssertEqual(check.value, 42.0, accuracy: 0.01)
    }

    func test_healthCheck_defaultValues() {
        let check = HealthCheckService.HealthCheck(
            id: "minimal",
            name: "Minimal",
            status: .warning
        )

        XCTAssertEqual(check.detail, "", "Default detail should be empty string")
        XCTAssertEqual(check.value, 0, accuracy: 0.001, "Default value should be 0")
    }

    // MARK: - AnomalyType Enum

    func test_anomalyType_rawValues() {
        XCTAssertEqual(HealthCheckService.AnomalyType.highMemory.rawValue, "high_memory")
        XCTAssertEqual(HealthCheckService.AnomalyType.aiResponseSlow.rawValue, "ai_response_slow")
        XCTAssertEqual(HealthCheckService.AnomalyType.lowTranscription.rawValue, "low_transcription")
        XCTAssertEqual(HealthCheckService.AnomalyType.connectionUnstable.rawValue, "connection_unstable")
    }

    // MARK: - Severity Enum

    func test_severity_rawValues() {
        XCTAssertEqual(HealthCheckService.Severity.info.rawValue, "info")
        XCTAssertEqual(HealthCheckService.Severity.warning.rawValue, "warning")
        XCTAssertEqual(HealthCheckService.Severity.error.rawValue, "error")
    }

    // MARK: - Recording Metrics

    func test_recordAIResponseTime_doesNotCrash() {
        // The singleton records to internal array; we verify it does not crash
        let service = HealthCheckService.shared
        service.recordAIResponseTime(500)
        service.recordAIResponseTime(1200)
        service.recordAIResponseTime(3000)
        // No assertion needed - verifying no crash
    }

    func test_recordTranscriptionLatency_doesNotCrash() {
        let service = HealthCheckService.shared
        service.recordTranscriptionLatency(100)
        service.recordTranscriptionLatency(250)
    }

    func test_recordWordsTranscribed_doesNotCrash() {
        let service = HealthCheckService.shared
        service.recordWordsTranscribed(10)
        service.recordWordsTranscribed(25)
    }

    func test_recordWebSocketReconnect_doesNotCrash() {
        let service = HealthCheckService.shared
        service.recordWebSocketReconnect()
        service.recordWebSocketReconnect()
    }

    // MARK: - Initial State

    func test_shared_initialHealthIsHealthy() {
        let service = HealthCheckService.shared
        XCTAssertEqual(service.overallHealth, .healthy,
            "Initial overall health should be .healthy")
    }

    func test_shared_initialChecksExist() {
        let service = HealthCheckService.shared
        XCTAssertFalse(service.checks.isEmpty,
            "Initial health checks should be set up")
    }

    func test_shared_initialCheckIds() {
        let service = HealthCheckService.shared
        let checkIds = service.checks.map { $0.id }

        XCTAssertTrue(checkIds.contains("memory"), "Should have memory check")
        XCTAssertTrue(checkIds.contains("ai_response"), "Should have AI response check")
        XCTAssertTrue(checkIds.contains("transcription"), "Should have transcription check")
        XCTAssertTrue(checkIds.contains("connection"), "Should have connection check")
    }
}
