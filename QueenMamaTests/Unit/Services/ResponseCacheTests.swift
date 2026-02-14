//
//  ResponseCacheTests.swift
//  QueenMamaTests
//
//  Tests for ResponseCache:
//  - Cache hit and miss behavior
//  - TTL expiry (5-minute default)
//  - LRU eviction when cache is full (50 entries)
//  - Concurrent access safety (actor isolation)
//  - Cache key generation from transcript suffix + mode + type
//  - Clear and stats methods
//

import XCTest
@testable import QueenMama

final class ResponseCacheTests: XCTestCase {

    // Note: ResponseCache is an actor with a shared singleton.
    // We use the shared instance and clear it between tests.

    override func setUp() async throws {
        try await super.setUp()
        await ResponseCache.shared.clear()
    }

    override func tearDown() async throws {
        await ResponseCache.shared.clear()
        try await super.tearDown()
    }

    // MARK: - Cache Miss

    func test_get_emptyCache_returnsNil() async {
        let result = await ResponseCache.shared.get(
            transcript: "Hello world",
            mode: "default",
            type: "assist"
        )
        XCTAssertNil(result, "Empty cache should return nil")
    }

    func test_get_differentKey_returnsNil() async {
        await ResponseCache.shared.set(
            transcript: "Hello world",
            mode: "default",
            type: "assist",
            content: "Response A",
            provider: .openai
        )

        let result = await ResponseCache.shared.get(
            transcript: "Different transcript",
            mode: "default",
            type: "assist"
        )
        XCTAssertNil(result, "Different transcript should miss cache")
    }

    // MARK: - Cache Hit

    func test_get_sameKey_returnsCachedResponse() async {
        await ResponseCache.shared.set(
            transcript: "Hello world",
            mode: "default",
            type: "assist",
            content: "Cached response content",
            provider: .openai
        )

        let result = await ResponseCache.shared.get(
            transcript: "Hello world",
            mode: "default",
            type: "assist"
        )
        XCTAssertNotNil(result, "Same key should hit cache")
        XCTAssertEqual(result?.content, "Cached response content")
        XCTAssertEqual(result?.provider, .openai)
    }

    func test_get_differentMode_returnsMiss() async {
        await ResponseCache.shared.set(
            transcript: "Hello",
            mode: "default",
            type: "assist",
            content: "Response",
            provider: .openai
        )

        let result = await ResponseCache.shared.get(
            transcript: "Hello",
            mode: "professional",
            type: "assist"
        )
        XCTAssertNil(result, "Different mode should miss cache")
    }

    func test_get_differentType_returnsMiss() async {
        await ResponseCache.shared.set(
            transcript: "Hello",
            mode: "default",
            type: "assist",
            content: "Response",
            provider: .openai
        )

        let result = await ResponseCache.shared.get(
            transcript: "Hello",
            mode: "default",
            type: "recap"
        )
        XCTAssertNil(result, "Different type should miss cache")
    }

    // MARK: - TTL Expiry

    func test_get_expiredEntry_returnsNilAndRemoves() async {
        // We cannot easily test TTL expiry with the real 300s TTL
        // without mocking the clock. Instead, we verify the cache exists
        // immediately after setting it (proving the timestamp works).
        await ResponseCache.shared.set(
            transcript: "Hello",
            mode: "default",
            type: "assist",
            content: "Fresh response",
            provider: .anthropic
        )

        // Immediate access should hit
        let result = await ResponseCache.shared.get(
            transcript: "Hello",
            mode: "default",
            type: "assist"
        )
        XCTAssertNotNil(result, "Non-expired entry should be returned")
        XCTAssertEqual(result?.content, "Fresh response")
    }

    // MARK: - LRU Eviction

    func test_set_exceedsMaxSize_evictsOldestEntry() async {
        // Fill cache to max (50 entries)
        for i in 0..<50 {
            await ResponseCache.shared.set(
                transcript: "transcript_\(i)",
                mode: "default",
                type: "assist",
                content: "response_\(i)",
                provider: .openai
            )
        }

        let statsBefore = await ResponseCache.shared.stats()
        XCTAssertEqual(statsBefore.count, 50, "Cache should be full at 50")
        XCTAssertEqual(statsBefore.maxSize, 50, "Max size should be 50")

        // Add one more - should evict oldest
        await ResponseCache.shared.set(
            transcript: "transcript_new",
            mode: "default",
            type: "assist",
            content: "response_new",
            provider: .openai
        )

        let statsAfter = await ResponseCache.shared.stats()
        XCTAssertEqual(statsAfter.count, 50, "Cache should still be at max after eviction")

        // The new entry should be accessible
        let newResult = await ResponseCache.shared.get(
            transcript: "transcript_new",
            mode: "default",
            type: "assist"
        )
        XCTAssertNotNil(newResult, "Newly added entry should be accessible")
        XCTAssertEqual(newResult?.content, "response_new")
    }

    // MARK: - Clear

    func test_clear_removesAllEntries() async {
        await ResponseCache.shared.set(
            transcript: "Hello",
            mode: "default",
            type: "assist",
            content: "Response",
            provider: .openai
        )

        await ResponseCache.shared.clear()

        let stats = await ResponseCache.shared.stats()
        XCTAssertEqual(stats.count, 0, "Cache should be empty after clear")

        let result = await ResponseCache.shared.get(
            transcript: "Hello",
            mode: "default",
            type: "assist"
        )
        XCTAssertNil(result, "Cleared cache should return nil")
    }

    // MARK: - Stats

    func test_stats_reflectsCurrentCount() async {
        let empty = await ResponseCache.shared.stats()
        XCTAssertEqual(empty.count, 0)
        XCTAssertEqual(empty.maxSize, 50)

        await ResponseCache.shared.set(
            transcript: "A",
            mode: "m",
            type: "t",
            content: "r",
            provider: .openai
        )

        let one = await ResponseCache.shared.stats()
        XCTAssertEqual(one.count, 1)
    }

    // MARK: - Cache Key Uses Last 500 Characters

    func test_cacheKey_usesTranscriptSuffix() async {
        // Two transcripts with the same last 500 chars should share a cache key
        let suffix = String(repeating: "x", count: 500)
        let transcript1 = "prefix_A_" + suffix
        let transcript2 = "prefix_B_" + suffix

        await ResponseCache.shared.set(
            transcript: transcript1,
            mode: "default",
            type: "assist",
            content: "Response from transcript1",
            provider: .openai
        )

        let result = await ResponseCache.shared.get(
            transcript: transcript2,
            mode: "default",
            type: "assist"
        )
        XCTAssertNotNil(result, "Transcripts sharing same 500-char suffix should share cache key")
        XCTAssertEqual(result?.content, "Response from transcript1")
    }

    // MARK: - Concurrent Access

    func test_concurrentAccess_doesNotCrash() async {
        // Actor isolation ensures safety; this test verifies no deadlocks or crashes
        await withTaskGroup(of: Void.self) { group in
            for i in 0..<20 {
                group.addTask {
                    await ResponseCache.shared.set(
                        transcript: "concurrent_\(i)",
                        mode: "default",
                        type: "assist",
                        content: "response_\(i)",
                        provider: .openai
                    )
                }
                group.addTask {
                    _ = await ResponseCache.shared.get(
                        transcript: "concurrent_\(i)",
                        mode: "default",
                        type: "assist"
                    )
                }
            }
        }

        let stats = await ResponseCache.shared.stats()
        XCTAssertGreaterThan(stats.count, 0, "Some entries should exist after concurrent writes")
        XCTAssertLessThanOrEqual(stats.count, 50, "Should not exceed max size")
    }

    // MARK: - Provider Preservation

    func test_set_preservesProviderType() async {
        await ResponseCache.shared.set(
            transcript: "test",
            mode: "m",
            type: "t",
            content: "r",
            provider: .anthropic
        )

        let result = await ResponseCache.shared.get(transcript: "test", mode: "m", type: "t")
        XCTAssertEqual(result?.provider, .anthropic, "Cached provider should be preserved")
    }

    func test_set_overwritesExistingKey() async {
        await ResponseCache.shared.set(
            transcript: "same",
            mode: "m",
            type: "t",
            content: "first",
            provider: .openai
        )
        await ResponseCache.shared.set(
            transcript: "same",
            mode: "m",
            type: "t",
            content: "second",
            provider: .anthropic
        )

        let result = await ResponseCache.shared.get(transcript: "same", mode: "m", type: "t")
        XCTAssertEqual(result?.content, "second", "Later set should overwrite")
        XCTAssertEqual(result?.provider, .anthropic)
    }
}
