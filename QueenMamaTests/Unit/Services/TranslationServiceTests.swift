import XCTest
@testable import QueenMama

@MainActor
final class TranslationServiceTests: XCTestCase {

    func test_translate_skipsEmptyText() async {
        let mock = MockTranslationProvider()
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "   ", sourceLang: "FR", targetLang: "EN")
        XCTAssertEqual(mock.callCount, 0)
    }

    func test_translate_callsProviderWithEffectiveSourceLang_whenAuto() async {
        let mock = MockTranslationProvider()
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "Bonjour", sourceLang: "auto", targetLang: "EN")
        XCTAssertEqual(mock.callCount, 1)
        XCTAssertNil(mock.lastSourceLang, "auto should be passed as nil to provider")
        XCTAssertEqual(mock.lastTargetLang, "EN")
    }

    func test_translate_firstCall_hasNilContext() async {
        let mock = MockTranslationProvider()
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "Bonjour", sourceLang: nil, targetLang: "EN")
        XCTAssertNil(mock.lastContext, "First call should have no context")
    }

    func test_translate_subsequentCall_passesPriorChunksAsContext() async {
        let mock = MockTranslationProvider()
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "Bonjour", sourceLang: nil, targetLang: "EN")
        await service.translate(entryID: UUID(), text: "comment ça va", sourceLang: nil, targetLang: "EN")
        XCTAssertEqual(mock.lastContext, "Bonjour")
    }

    func test_translate_contextWindow_capsAtThreeChunks() async {
        let mock = MockTranslationProvider()
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "one", sourceLang: nil, targetLang: "EN")
        await service.translate(entryID: UUID(), text: "two", sourceLang: nil, targetLang: "EN")
        await service.translate(entryID: UUID(), text: "three", sourceLang: nil, targetLang: "EN")
        await service.translate(entryID: UUID(), text: "four", sourceLang: nil, targetLang: "EN")
        // Context for "four" should contain only the 3 most recent prior chunks (one, two, three).
        XCTAssertEqual(mock.lastContext, "one two three")
    }

    func test_resetContext_clearsBuffer() async {
        let mock = MockTranslationProvider()
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "Bonjour", sourceLang: nil, targetLang: "EN")
        service.resetContext()
        await service.translate(entryID: UUID(), text: "Hello", sourceLang: nil, targetLang: "EN")
        XCTAssertNil(mock.lastContext)
    }

    func test_translate_returnsCachedOnSecondCall() async {
        let mock = MockTranslationProvider()
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "Bonjour", sourceLang: "FR", targetLang: "EN")
        await service.translate(entryID: UUID(), text: "Bonjour", sourceLang: "FR", targetLang: "EN")
        XCTAssertEqual(mock.callCount, 1, "Second identical call should hit cache and skip provider")
    }

    func test_translate_capturesErrorOnProviderFailure() async {
        let mock = MockTranslationProvider()
        mock.injectedError = .rateLimited
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "Bonjour", sourceLang: nil, targetLang: "EN")
        XCTAssertNotNil(service.lastError)
        if case .rateLimited = service.lastError! {
            // ok
        } else {
            XCTFail("Expected rateLimited, got \(String(describing: service.lastError))")
        }
    }

    func test_translate_clearsErrorOnSuccessAfterFailure() async {
        let mock = MockTranslationProvider()
        mock.injectedError = .rateLimited
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "Hola", sourceLang: nil, targetLang: "EN")
        XCTAssertNotNil(service.lastError)

        mock.injectedError = nil
        await service.translate(entryID: UUID(), text: "Hello", sourceLang: nil, targetLang: "FR")
        XCTAssertNil(service.lastError)
    }

    func test_translate_noProviderConfigured_setsError() async {
        let mock = MockTranslationProvider()
        mock.isConfigured = false
        let service = TranslationService(proxyProvider: mock)
        await service.translate(entryID: UUID(), text: "Bonjour", sourceLang: nil, targetLang: "EN")
        XCTAssertNotNil(service.lastError)
    }
}
