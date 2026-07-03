//
//  SyntaxHighlighterTests.swift
//  QueenMamaTests
//
//  Tests for the native syntax highlighter:
//  - Output text round-trips the input (no characters lost/added)
//  - Highlighting actually produces multiple colored runs
//  - Unknown language still returns valid output
//

import XCTest
import SwiftUI
@testable import QueenMama

@MainActor
final class SyntaxHighlighterTests: XCTestCase {

    func test_highlight_preservesText() {
        let code = "func add(a: Int, b: Int) -> Int { return a + b }"
        let attr = SyntaxHighlighter.highlight(code, language: "swift")
        XCTAssertEqual(String(attr.characters), code)
    }

    func test_highlight_producesMultipleColorRuns() {
        let code = "let name = \"hello\" // greeting\nlet count = 42"
        let attr = SyntaxHighlighter.highlight(code, language: "swift")
        // Keywords, a string, a comment and a number should yield >1 distinct run.
        let runCount = attr.runs.reduce(into: 0) { acc, _ in acc += 1 }
        XCTAssertGreaterThan(runCount, 1)
    }

    func test_highlight_unknownLanguage_returnsText() {
        let code = "some arbitrary text 123"
        let attr = SyntaxHighlighter.highlight(code, language: "totally-unknown")
        XCTAssertEqual(String(attr.characters), code)
    }

    func test_highlight_emptyString() {
        let attr = SyntaxHighlighter.highlight("", language: nil)
        XCTAssertEqual(String(attr.characters), "")
    }
}
