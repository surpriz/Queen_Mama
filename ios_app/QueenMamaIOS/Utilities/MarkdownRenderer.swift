//
//  MarkdownRenderer.swift
//  QueenMama
//
//  Created by Claude Code on 16/01/2026.
//

import SwiftUI

// MARK: - Markdown Block Types

enum MarkdownBlock {
    case header1(String)
    case header2(String)
    case header3(String)
    case paragraph(String)
    case codeBlock(code: String, language: String?)
    case bulletItem(text: String, indent: Int)
    case orderedItem(text: String, number: Int)
    case empty
}

// MARK: - Markdown Parser

struct MarkdownParser {
    static func parse(_ text: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        let lines = text.components(separatedBy: .newlines)
        var currentParagraph = ""

        // State machine for fenced code blocks
        var inCodeBlock = false
        var codeBlockLines: [String] = []
        var codeBlockLanguage: String?

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // --- Code block fence detection ---
            if trimmed.hasPrefix("```") {
                if !inCodeBlock {
                    // Opening fence: flush any pending paragraph
                    if !currentParagraph.isEmpty {
                        blocks.append(.paragraph(currentParagraph))
                        currentParagraph = ""
                    }
                    inCodeBlock = true
                    codeBlockLines = []
                    let lang = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                    codeBlockLanguage = lang.isEmpty ? nil : lang
                } else {
                    // Closing fence: emit code block
                    let code = codeBlockLines.joined(separator: "\n")
                    blocks.append(.codeBlock(code: code, language: codeBlockLanguage))
                    inCodeBlock = false
                    codeBlockLines = []
                    codeBlockLanguage = nil
                }
                continue
            }

            // Inside a code block: preserve raw lines (no trimming)
            if inCodeBlock {
                codeBlockLines.append(line)
                continue
            }

            // --- Normal (non-code) parsing ---

            // Empty line: flush paragraph
            if trimmed.isEmpty {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                continue
            }

            // Headers
            if trimmed.hasPrefix("### ") {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                blocks.append(.header3(String(trimmed.dropFirst(4))))
            } else if trimmed.hasPrefix("## ") {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                blocks.append(.header2(String(trimmed.dropFirst(3))))
            } else if trimmed.hasPrefix("# ") {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                blocks.append(.header1(String(trimmed.dropFirst(2))))
            }
            // Bullet items (- or *)
            else if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                let indent = line.prefix(while: { $0 == " " || $0 == "\t" }).count / 2
                let text = String(trimmed.dropFirst(2))
                blocks.append(.bulletItem(text: text, indent: indent))
            }
            // Ordered list items (1. 2. etc.)
            else if let match = trimmed.range(of: #"^(\d+)\.\s+"#, options: .regularExpression) {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                let numberStr = trimmed[trimmed.startIndex..<trimmed.index(before: match.upperBound)]
                    .trimmingCharacters(in: .whitespaces)
                    .replacingOccurrences(of: ".", with: "")
                let number = Int(numberStr) ?? 1
                let text = String(trimmed[match.upperBound...])
                blocks.append(.orderedItem(text: text, number: number))
            }
            // Regular text: accumulate into paragraph
            else {
                if !currentParagraph.isEmpty {
                    currentParagraph += " "
                }
                currentParagraph += trimmed
            }
        }

        // Flush remaining state
        if inCodeBlock {
            // Unclosed code block (streaming scenario): emit what we have
            let code = codeBlockLines.joined(separator: "\n")
            blocks.append(.codeBlock(code: code, language: codeBlockLanguage))
        } else if !currentParagraph.isEmpty {
            blocks.append(.paragraph(currentParagraph))
        }

        return blocks
    }
}

// MARK: - Inline Markdown Styling

extension String {
    /// Converts inline markdown to AttributedString (bold, italic, code)
    func inlineMarkdownToAttributed() -> AttributedString {
        // For simplicity, use native markdown parsing for inline elements
        do {
            let result = try AttributedString(markdown: self)
            return result
        } catch {
            return AttributedString(self)
        }
    }
}

// MARK: - SwiftUI Markdown View

struct MarkdownText: View {
    private let blocks: [MarkdownBlock]

    init(content: String) {
        self.blocks = MarkdownParser.parse(content)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .header1(let text):
                    Text(text.inlineMarkdownToAttributed())
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .padding(.top, 12)
                        .padding(.bottom, 6)
                        .frame(maxWidth: .infinity, alignment: .leading)

                case .header2(let text):
                    Text(text.inlineMarkdownToAttributed())
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .padding(.top, 10)
                        .padding(.bottom, 4)
                        .frame(maxWidth: .infinity, alignment: .leading)

                case .header3(let text):
                    Text(text.inlineMarkdownToAttributed())
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .padding(.top, 8)
                        .padding(.bottom, 3)
                        .frame(maxWidth: .infinity, alignment: .leading)

                case .paragraph(let text):
                    Text(text.inlineMarkdownToAttributed())
                        .font(.system(size: 12))
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .lineSpacing(4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 4)

                case .codeBlock(let code, let language):
                    VStack(alignment: .leading, spacing: 0) {
                        if let lang = language {
                            Text(lang)
                                .font(QMDesign.Typography.monoSmall)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                                .padding(.horizontal, 10)
                                .padding(.top, 8)
                                .padding(.bottom, 4)
                        }
                        Text(code)
                            .font(QMDesign.Typography.mono)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, language != nil ? 4 : 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .fill(QMDesign.Colors.surfaceMedium)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                    )
                    .padding(.vertical, 2)

                case .bulletItem(let text, let indent):
                    HStack(alignment: .top, spacing: 6) {
                        Text("\u{2022}")
                            .font(.system(size: 12))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                        Text(text.inlineMarkdownToAttributed())
                            .font(.system(size: 12))
                            .foregroundColor(QMDesign.Colors.textPrimary)
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, CGFloat(indent) * 16)

                case .orderedItem(let text, let number):
                    HStack(alignment: .top, spacing: 4) {
                        Text("\(number).")
                            .font(.system(size: 12))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .frame(width: 20, alignment: .trailing)
                        Text(text.inlineMarkdownToAttributed())
                            .font(.system(size: 12))
                            .foregroundColor(QMDesign.Colors.textPrimary)
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                case .empty:
                    EmptyView()
                }
            }
        }
        .textSelection(.enabled)
    }
}
