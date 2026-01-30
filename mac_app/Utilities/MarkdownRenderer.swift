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
    case empty
}

// MARK: - Markdown Parser

struct MarkdownParser {
    static func parse(_ text: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        let lines = text.components(separatedBy: .newlines)
        var currentParagraph = ""

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Empty line - flush paragraph and add empty block
            if trimmed.isEmpty {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                continue
            }

            // Check for headers
            if trimmed.hasPrefix("### ") {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                let headerText = String(trimmed.dropFirst(4))
                blocks.append(.header3(headerText))
            } else if trimmed.hasPrefix("## ") {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                let headerText = String(trimmed.dropFirst(3))
                blocks.append(.header2(headerText))
            } else if trimmed.hasPrefix("# ") {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                let headerText = String(trimmed.dropFirst(2))
                blocks.append(.header1(headerText))
            } else {
                // Regular text - append to current paragraph
                if !currentParagraph.isEmpty {
                    currentParagraph += " "
                }
                currentParagraph += trimmed
            }
        }

        // Flush remaining paragraph
        if !currentParagraph.isEmpty {
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
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            let blocks = MarkdownParser.parse(content)
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

                case .empty:
                    EmptyView()
                }
            }
        }
        .textSelection(.enabled)
    }
}
