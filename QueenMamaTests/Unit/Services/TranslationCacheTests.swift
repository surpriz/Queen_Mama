import XCTest
@testable import QueenMama

final class TranslationCacheTests: XCTestCase {

    func test_cacheMiss_thenHit() {
        let cache = TranslationCache(capacity: 10)
        XCTAssertNil(cache.lookup(text: "Bonjour", sourceLang: "FR", targetLang: "EN"))

        cache.store(text: "Bonjour", sourceLang: "FR", targetLang: "EN", translation: "Hello")
        XCTAssertEqual(cache.lookup(text: "Bonjour", sourceLang: "FR", targetLang: "EN"), "Hello")
    }

    func test_keyNormalization_caseAndWhitespace() {
        let cache = TranslationCache(capacity: 10)
        cache.store(text: "Bonjour", sourceLang: "FR", targetLang: "EN", translation: "Hello")

        // Whitespace/case variations hit the same key
        XCTAssertEqual(cache.lookup(text: "  Bonjour  ", sourceLang: "FR", targetLang: "EN"), "Hello")
        XCTAssertEqual(cache.lookup(text: "BONJOUR", sourceLang: "FR", targetLang: "EN"), "Hello")
    }

    func test_differentTargetLangs_differentKeys() {
        let cache = TranslationCache(capacity: 10)
        cache.store(text: "Bonjour", sourceLang: "FR", targetLang: "EN", translation: "Hello")
        cache.store(text: "Bonjour", sourceLang: "FR", targetLang: "DE", translation: "Hallo")

        XCTAssertEqual(cache.lookup(text: "Bonjour", sourceLang: "FR", targetLang: "EN"), "Hello")
        XCTAssertEqual(cache.lookup(text: "Bonjour", sourceLang: "FR", targetLang: "DE"), "Hallo")
        XCTAssertNil(cache.lookup(text: "Bonjour", sourceLang: "FR", targetLang: "ES"))
    }

    func test_nilSourceLang_treatedAsAuto() {
        let cache = TranslationCache(capacity: 10)
        cache.store(text: "Hi", sourceLang: nil, targetLang: "FR", translation: "Salut")
        XCTAssertEqual(cache.lookup(text: "Hi", sourceLang: nil, targetLang: "FR"), "Salut")
    }

    func test_lruEviction_atCapacity() {
        let cache = TranslationCache(capacity: 3)
        cache.store(text: "one", sourceLang: nil, targetLang: "FR", translation: "un")
        cache.store(text: "two", sourceLang: nil, targetLang: "FR", translation: "deux")
        cache.store(text: "three", sourceLang: nil, targetLang: "FR", translation: "trois")

        XCTAssertEqual(cache.count, 3)

        // Access "one" → it becomes most recently used
        _ = cache.lookup(text: "one", sourceLang: nil, targetLang: "FR")

        // Add fourth → "two" should evict (LRU after "one" was touched)
        cache.store(text: "four", sourceLang: nil, targetLang: "FR", translation: "quatre")

        XCTAssertEqual(cache.count, 3)
        XCTAssertNotNil(cache.lookup(text: "one", sourceLang: nil, targetLang: "FR"))
        XCTAssertNil(cache.lookup(text: "two", sourceLang: nil, targetLang: "FR"))
        XCTAssertNotNil(cache.lookup(text: "three", sourceLang: nil, targetLang: "FR"))
        XCTAssertNotNil(cache.lookup(text: "four", sourceLang: nil, targetLang: "FR"))
    }

    func test_clear_emptiesCache() {
        let cache = TranslationCache(capacity: 10)
        cache.store(text: "Bonjour", sourceLang: "FR", targetLang: "EN", translation: "Hello")
        XCTAssertEqual(cache.count, 1)
        cache.clear()
        XCTAssertEqual(cache.count, 0)
        XCTAssertNil(cache.lookup(text: "Bonjour", sourceLang: "FR", targetLang: "EN"))
    }
}
