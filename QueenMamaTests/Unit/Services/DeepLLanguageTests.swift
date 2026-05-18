import XCTest
@testable import QueenMama

final class DeepLLanguageTests: XCTestCase {

    func test_allCases_haveDisplayName() {
        for lang in DeepLLanguage.allCases {
            XCTAssertFalse(lang.displayName.isEmpty, "Missing displayName for \(lang.rawValue)")
            XCTAssertFalse(lang.flag.isEmpty, "Missing flag for \(lang.rawValue)")
        }
    }

    func test_bcp47_fr_mapsToFrench() {
        XCTAssertEqual(DeepLLanguage.fromBCP47("fr"), .french)
        XCTAssertEqual(DeepLLanguage.fromBCP47("FR"), .french)
        XCTAssertEqual(DeepLLanguage.fromBCP47("fr-FR"), .french)
    }

    func test_bcp47_enUS_mapsToEnglishUS() {
        XCTAssertEqual(DeepLLanguage.fromBCP47("en-US"), .englishUS)
        XCTAssertEqual(DeepLLanguage.fromBCP47("EN-US"), .englishUS)
    }

    func test_bcp47_bareEN_mapsToEnglishUS() {
        XCTAssertEqual(DeepLLanguage.fromBCP47("en"), .englishUS)
    }

    func test_bcp47_unknown_returnsNil() {
        XCTAssertNil(DeepLLanguage.fromBCP47("xx"))
        XCTAssertNil(DeepLLanguage.fromBCP47(""))
    }

    func test_badge_collapsesRegionalVariants() {
        XCTAssertEqual(DeepLLanguage.englishUS.badge, "EN")
        XCTAssertEqual(DeepLLanguage.englishGB.badge, "EN")
        XCTAssertEqual(DeepLLanguage.portugueseBR.badge, "PT")
        XCTAssertEqual(DeepLLanguage.portuguesePT.badge, "PT")
        XCTAssertEqual(DeepLLanguage.french.badge, "FR")
    }
}
