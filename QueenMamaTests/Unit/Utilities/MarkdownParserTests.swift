//
//  MarkdownParserTests.swift
//  QueenMamaTests
//
//  Tests for MarkdownParser.parse():
//  - Header detection (H1, H2, H3)
//  - Paragraph text accumulation
//  - Empty lines between blocks
//  - Mixed content (headers + paragraphs)
//  - Empty input
//  - Multi-line paragraph merging
//

import XCTest
@testable import QueenMama

@MainActor
final class MarkdownParserTests: XCTestCase {

    // MARK: - Empty Input

    func test_parse_emptyString_returnsEmptyArray() {
        let blocks = MarkdownParser.parse("")
        XCTAssertTrue(blocks.isEmpty, "Empty string should produce no blocks")
    }

    func test_parse_onlyWhitespace_returnsEmptyArray() {
        let blocks = MarkdownParser.parse("   \n   \n   ")
        XCTAssertTrue(blocks.isEmpty, "Whitespace-only string should produce no blocks")
    }

    // MARK: - Header Detection

    func test_parse_h1_returnsHeader1Block() {
        let blocks = MarkdownParser.parse("# Main Title")

        XCTAssertEqual(blocks.count, 1)
        if case .header1(let text) = blocks[0] {
            XCTAssertEqual(text, "Main Title", "H1 should extract text after '# '")
        } else {
            XCTFail("Expected header1 block, got \(blocks[0])")
        }
    }

    func test_parse_h2_returnsHeader2Block() {
        let blocks = MarkdownParser.parse("## Sub Title")

        XCTAssertEqual(blocks.count, 1)
        if case .header2(let text) = blocks[0] {
            XCTAssertEqual(text, "Sub Title", "H2 should extract text after '## '")
        } else {
            XCTFail("Expected header2 block, got \(blocks[0])")
        }
    }

    func test_parse_h3_returnsHeader3Block() {
        let blocks = MarkdownParser.parse("### Minor Title")

        XCTAssertEqual(blocks.count, 1)
        if case .header3(let text) = blocks[0] {
            XCTAssertEqual(text, "Minor Title", "H3 should extract text after '### '")
        } else {
            XCTFail("Expected header3 block, got \(blocks[0])")
        }
    }

    func test_parse_headerWithLeadingSpaces_recognized() {
        // The parser trims whitespace from each line
        let blocks = MarkdownParser.parse("   # Indented Header")

        XCTAssertEqual(blocks.count, 1)
        if case .header1(let text) = blocks[0] {
            XCTAssertEqual(text, "Indented Header")
        } else {
            XCTFail("Expected header1 block")
        }
    }

    // MARK: - Paragraphs

    func test_parse_singleLine_returnsParagraph() {
        let blocks = MarkdownParser.parse("This is a paragraph.")

        XCTAssertEqual(blocks.count, 1)
        if case .paragraph(let text) = blocks[0] {
            XCTAssertEqual(text, "This is a paragraph.")
        } else {
            XCTFail("Expected paragraph block, got \(blocks[0])")
        }
    }

    func test_parse_multipleConsecutiveLines_mergesIntoParagraph() {
        let input = "Line one.\nLine two.\nLine three."
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 1, "Consecutive lines without empty separator should merge")
        if case .paragraph(let text) = blocks[0] {
            XCTAssertEqual(text, "Line one. Line two. Line three.",
                "Lines should be joined with spaces")
        } else {
            XCTFail("Expected paragraph block")
        }
    }

    func test_parse_linesWithEmptyLineBetween_producesSeparateParagraphs() {
        let input = "Paragraph one.\n\nParagraph two."
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 2, "Empty line should separate paragraphs")

        if case .paragraph(let text1) = blocks[0] {
            XCTAssertEqual(text1, "Paragraph one.")
        } else {
            XCTFail("First block should be paragraph")
        }

        if case .paragraph(let text2) = blocks[1] {
            XCTAssertEqual(text2, "Paragraph two.")
        } else {
            XCTFail("Second block should be paragraph")
        }
    }

    // MARK: - Mixed Content

    func test_parse_headerThenParagraph() {
        let input = "# Title\nSome text below the title."
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 2)
        if case .header1(let title) = blocks[0] {
            XCTAssertEqual(title, "Title")
        } else {
            XCTFail("First block should be header1")
        }
        if case .paragraph(let text) = blocks[1] {
            XCTAssertEqual(text, "Some text below the title.")
        } else {
            XCTFail("Second block should be paragraph")
        }
    }

    func test_parse_paragraphThenHeader() {
        let input = "Some intro text.\n\n## Section Header"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 2)
        if case .paragraph(let text) = blocks[0] {
            XCTAssertEqual(text, "Some intro text.")
        } else {
            XCTFail("First block should be paragraph")
        }
        if case .header2(let title) = blocks[1] {
            XCTAssertEqual(title, "Section Header")
        } else {
            XCTFail("Second block should be header2")
        }
    }

    func test_parse_complexMixedContent() {
        let input = """
        # Overview

        This is the introduction.
        It spans multiple lines.

        ## Details

        ### Sub-section

        More content here.
        """
        let blocks = MarkdownParser.parse(input)

        // Expected: header1, paragraph, header2, header3, paragraph
        XCTAssertEqual(blocks.count, 5, "Should produce 5 blocks")

        if case .header1(let h1) = blocks[0] {
            XCTAssertEqual(h1, "Overview")
        } else {
            XCTFail("Block 0 should be header1")
        }

        if case .paragraph(let p1) = blocks[1] {
            XCTAssertTrue(p1.contains("introduction"))
            XCTAssertTrue(p1.contains("multiple lines"))
        } else {
            XCTFail("Block 1 should be paragraph")
        }

        if case .header2(let h2) = blocks[2] {
            XCTAssertEqual(h2, "Details")
        } else {
            XCTFail("Block 2 should be header2")
        }

        if case .header3(let h3) = blocks[3] {
            XCTAssertEqual(h3, "Sub-section")
        } else {
            XCTFail("Block 3 should be header3")
        }

        if case .paragraph(let p2) = blocks[4] {
            XCTAssertEqual(p2, "More content here.")
        } else {
            XCTFail("Block 4 should be paragraph")
        }
    }

    // MARK: - Header Flushing Pending Paragraph

    func test_parse_headerFlushesAccumulatedParagraph() {
        let input = "Some text\n# Header After Text"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 2)
        if case .paragraph(let text) = blocks[0] {
            XCTAssertEqual(text, "Some text")
        } else {
            XCTFail("First block should be paragraph flushed before header")
        }
        if case .header1(let h) = blocks[1] {
            XCTAssertEqual(h, "Header After Text")
        } else {
            XCTFail("Second block should be header1")
        }
    }

    // MARK: - Edge Cases

    func test_parse_hashWithoutSpace_treatedAsParagraph() {
        // "#NoSpace" should NOT be parsed as a header
        let blocks = MarkdownParser.parse("#NoSpace")

        XCTAssertEqual(blocks.count, 1)
        if case .paragraph(let text) = blocks[0] {
            XCTAssertEqual(text, "#NoSpace",
                "Hash without space should be treated as paragraph text")
        } else {
            XCTFail("Should be paragraph, not header")
        }
    }

    func test_parse_onlyEmptyLines_returnsEmpty() {
        let blocks = MarkdownParser.parse("\n\n\n\n")
        XCTAssertTrue(blocks.isEmpty, "Only empty lines should produce no blocks")
    }

    func test_parse_multipleHeaders_inSequence() {
        let input = "# H1\n## H2\n### H3"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 3)
        if case .header1 = blocks[0] {} else { XCTFail("Expected header1") }
        if case .header2 = blocks[1] {} else { XCTFail("Expected header2") }
        if case .header3 = blocks[2] {} else { XCTFail("Expected header3") }
    }
}
