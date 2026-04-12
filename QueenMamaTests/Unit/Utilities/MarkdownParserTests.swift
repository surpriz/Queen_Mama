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
//  - Code blocks (fenced, with language, unclosed)
//  - Bullet lists (- and *)
//  - Ordered lists (1. 2. 3.)
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

    // MARK: - Code Blocks

    func test_parse_codeBlock_basic() {
        let input = "```\nprint(\"hello\")\n```"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 1)
        if case .codeBlock(let code, let language) = blocks[0] {
            XCTAssertEqual(code, "print(\"hello\")")
            XCTAssertNil(language, "No language specified")
        } else {
            XCTFail("Expected codeBlock, got \(blocks[0])")
        }
    }

    func test_parse_codeBlock_withLanguage() {
        let input = "```python\ndef hello():\n    print(\"hi\")\n```"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 1)
        if case .codeBlock(let code, let language) = blocks[0] {
            XCTAssertEqual(language, "python")
            XCTAssertTrue(code.contains("def hello():"))
            XCTAssertTrue(code.contains("    print(\"hi\")"))
        } else {
            XCTFail("Expected codeBlock, got \(blocks[0])")
        }
    }

    func test_parse_codeBlock_preservesIndentation() {
        let input = "```\nif true {\n    let x = 1\n        let y = 2\n}\n```"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 1)
        if case .codeBlock(let code, _) = blocks[0] {
            let lines = code.components(separatedBy: "\n")
            XCTAssertEqual(lines[0], "if true {")
            XCTAssertEqual(lines[1], "    let x = 1")
            XCTAssertEqual(lines[2], "        let y = 2")
            XCTAssertEqual(lines[3], "}")
        } else {
            XCTFail("Expected codeBlock")
        }
    }

    func test_parse_codeBlock_unclosed_streamingScenario() {
        // Simulates streaming where the closing fence hasn't arrived yet
        let input = "```swift\nfunc test() {\n    return 42"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 1)
        if case .codeBlock(let code, let language) = blocks[0] {
            XCTAssertEqual(language, "swift")
            XCTAssertTrue(code.contains("func test()"))
            XCTAssertTrue(code.contains("return 42"))
        } else {
            XCTFail("Expected codeBlock for unclosed fence")
        }
    }

    func test_parse_textThenCodeBlock_producesTwoBlocks() {
        let input = "Here is the solution:\n\n```\nreturn n * 2\n```"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 2)
        if case .paragraph(let text) = blocks[0] {
            XCTAssertEqual(text, "Here is the solution:")
        } else {
            XCTFail("First block should be paragraph")
        }
        if case .codeBlock(let code, _) = blocks[1] {
            XCTAssertEqual(code, "return n * 2")
        } else {
            XCTFail("Second block should be codeBlock")
        }
    }

    // MARK: - Bullet Lists

    func test_parse_bulletItems_dash() {
        let input = "- First item\n- Second item\n- Third item"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 3)
        if case .bulletItem(let text, let indent) = blocks[0] {
            XCTAssertEqual(text, "First item")
            XCTAssertEqual(indent, 0)
        } else {
            XCTFail("Expected bulletItem, got \(blocks[0])")
        }
        if case .bulletItem(let text, _) = blocks[1] {
            XCTAssertEqual(text, "Second item")
        } else {
            XCTFail("Expected bulletItem")
        }
    }

    func test_parse_bulletItems_asterisk() {
        let input = "* Alpha\n* Beta"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 2)
        if case .bulletItem(let text, _) = blocks[0] {
            XCTAssertEqual(text, "Alpha")
        } else {
            XCTFail("Expected bulletItem with asterisk")
        }
    }

    func test_parse_bulletItems_indented() {
        let input = "- Parent\n  - Child\n    - Grandchild"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 3)
        if case .bulletItem(_, let indent) = blocks[0] {
            XCTAssertEqual(indent, 0)
        } else {
            XCTFail("Expected bulletItem at indent 0")
        }
        if case .bulletItem(_, let indent) = blocks[1] {
            XCTAssertEqual(indent, 1)
        } else {
            XCTFail("Expected bulletItem at indent 1")
        }
        if case .bulletItem(_, let indent) = blocks[2] {
            XCTAssertEqual(indent, 2)
        } else {
            XCTFail("Expected bulletItem at indent 2")
        }
    }

    // MARK: - Ordered Lists

    func test_parse_orderedItems_simple() {
        let input = "1. First\n2. Second\n3. Third"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 3)
        if case .orderedItem(let text, let number) = blocks[0] {
            XCTAssertEqual(text, "First")
            XCTAssertEqual(number, 1)
        } else {
            XCTFail("Expected orderedItem, got \(blocks[0])")
        }
        if case .orderedItem(let text, let number) = blocks[2] {
            XCTAssertEqual(text, "Third")
            XCTAssertEqual(number, 3)
        } else {
            XCTFail("Expected orderedItem")
        }
    }

    func test_parse_orderedItems_multipleDigits() {
        let input = "10. Tenth item\n11. Eleventh item"
        let blocks = MarkdownParser.parse(input)

        XCTAssertEqual(blocks.count, 2)
        if case .orderedItem(let text, let number) = blocks[0] {
            XCTAssertEqual(text, "Tenth item")
            XCTAssertEqual(number, 10)
        } else {
            XCTFail("Expected orderedItem with number 10")
        }
    }

    // MARK: - Developer Exam Prompt Guard

    func test_developerExam_noAssistAddition() {
        let devMode = Mode.developerExamMode
        let context = AIContext(
            transcript: "test",
            mode: devMode,
            responseType: .assist
        )
        let prompt = context.systemPrompt

        // Developer Exam should NOT contain the .assist responseType addition
        XCTAssertFalse(
            prompt.contains("PRIORITY ORDER for providing help"),
            "Developer Exam mode should not include .assist systemPromptAddition"
        )
        // But it should still contain its own prompt content
        XCTAssertTrue(
            prompt.contains("COMPLETE, WORKING code solutions"),
            "Developer Exam mode should contain its own prompt"
        )
    }

    func test_defaultMode_getsAssistAddition() {
        let defaultMode = Mode.defaultMode
        let context = AIContext(
            transcript: "test",
            mode: defaultMode,
            responseType: .assist
        )
        let prompt = context.systemPrompt

        // Default mode SHOULD get the classic .assist addition (not NZT)
        XCTAssertTrue(
            prompt.contains("live coach in the user"),
            "Default mode should include classic .assist systemPromptAddition"
        )
    }

    func test_limitlessMode_getsNZTAddition() {
        let limitlessMode = Mode.limitlessMode
        let context = AIContext(
            transcript: "test",
            mode: limitlessMode,
            responseType: .assist
        )
        let prompt = context.systemPrompt

        // Limitless mode SHOULD get the NZT .assist addition
        XCTAssertTrue(
            prompt.contains("NZT EFFECT"),
            "Limitless mode should include NZT .assist systemPromptAddition"
        )
    }
}
