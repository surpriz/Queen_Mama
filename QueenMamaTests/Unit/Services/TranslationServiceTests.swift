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
