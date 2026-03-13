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
    case table(headers: [String], rows: [[String]])
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

        // State machine for tables
        var tableLines: [String] = []

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

            // Empty line: flush paragraph and table
            if trimmed.isEmpty {
                if !tableLines.isEmpty {
                    if let table = Self.parseTable(tableLines) {
                        blocks.append(table)
                    }
                    tableLines = []
                }
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                continue
            }

            // Table lines (starts and ends with |)
            if trimmed.hasPrefix("|") {
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph))
                    currentParagraph = ""
                }
                tableLines.append(trimmed)
                continue
            }

            // If we were collecting table lines but this line isn't a table line, flush
            if !tableLines.isEmpty {
                if let table = Self.parseTable(tableLines) {
                    blocks.append(table)
                }
                tableLines = []
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
        if !tableLines.isEmpty {
            if let table = Self.parseTable(tableLines) {
                blocks.append(table)
            }
        }
        if inCodeBlock {
            // Unclosed code block (streaming scenario): emit what we have
            let code = codeBlockLines.joined(separator: "\n")
            blocks.append(.codeBlock(code: code, language: codeBlockLanguage))
        } else if !currentParagraph.isEmpty {
            blocks.append(.paragraph(currentParagraph))
        }

        return blocks
    }

    /// Parse collected table lines into a .table block
    private static func parseTable(_ lines: [String]) -> MarkdownBlock? {
        guard lines.count >= 2 else {
            // Not enough lines for a valid table (need header + separator at minimum)
            return nil
        }

        func parseCells(_ line: String) -> [String] {
            var trimmed = line.trimmingCharacters(in: .whitespaces)
            // Remove leading/trailing pipes
            if trimmed.hasPrefix("|") { trimmed = String(trimmed.dropFirst()) }
            if trimmed.hasSuffix("|") { trimmed = String(trimmed.dropLast()) }
            return trimmed.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
        }

        func isSeparatorLine(_ line: String) -> Bool {
            let cells = parseCells(line)
            return cells.allSatisfy { cell in
                let stripped = cell.replacingOccurrences(of: "-", with: "")
                    .replacingOccurrences(of: ":", with: "")
                    .trimmingCharacters(in: .whitespaces)
                return stripped.isEmpty && !cell.isEmpty
            }
        }

        let headers = parseCells(lines[0])

        // Find and skip separator line (usually line 1)
        var dataStartIndex = 1
        if lines.count > 1 && isSeparatorLine(lines[1]) {
            dataStartIndex = 2
        }

        var rows: [[String]] = []
        for i in dataStartIndex..<lines.count {
            if isSeparatorLine(lines[i]) { continue }
            rows.append(parseCells(lines[i]))
        }

        return .table(headers: headers, rows: rows)
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

                case .codeBlock(let code, let language):
                    CodeBlockView(code: code, language: language)

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

                case .table(let headers, let rows):
                    VStack(alignment: .leading, spacing: 0) {
                        // Header row
                        HStack(spacing: 0) {
                            ForEach(Array(headers.enumerated()), id: \.offset) { index, header in
                                Text(header.inlineMarkdownToAttributed())
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundColor(QMDesign.Colors.textPrimary)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 6)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                if index < headers.count - 1 {
                                    Divider()
                                }
                            }
                        }
                        .background(QMDesign.Colors.surfaceMedium)

                        Divider()

                        // Data rows
                        ForEach(Array(rows.enumerated()), id: \.offset) { rowIndex, row in
                            HStack(spacing: 0) {
                                ForEach(Array(row.enumerated()), id: \.offset) { colIndex, cell in
                                    Text(cell.inlineMarkdownToAttributed())
                                        .font(.system(size: 11))
                                        .foregroundColor(QMDesign.Colors.textPrimary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 5)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    if colIndex < row.count - 1 {
                                        Divider()
                                    }
                                }
                            }
                            if rowIndex < rows.count - 1 {
                                Divider()
                            }
                        }
                    }
                    .overlay(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                            .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: QMDesign.Radius.sm))
                    .padding(.vertical, 4)

                case .empty:
                    EmptyView()
                }
            }
        }
        .textSelection(.enabled)
    }
}

// MARK: - Code Block View with Copy Button

struct CodeBlockView: View {
    let code: String
    let language: String?

    @State private var showCopied = false
    @State private var isHoveringCopy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header bar with language label and copy button
            HStack(spacing: 0) {
                if let lang = language {
                    Text(lang)
                        .font(QMDesign.Typography.monoSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }
                Spacer()
                Button(action: copyCode) {
                    HStack(spacing: 3) {
                        Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 9))
                        Text(showCopied
                            ? String(localized: "codeBlock.copied")
                            : String(localized: "codeBlock.copy"))
                            .font(.system(size: 10))
                    }
                    .foregroundColor(showCopied ? QMDesign.Colors.success : QMDesign.Colors.textTertiary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(
                        RoundedRectangle(cornerRadius: 4)
                            .fill(isHoveringCopy ? QMDesign.Colors.surfaceHover : Color.clear)
                    )
                }
                .buttonStyle(.plain)
                .onHover { isHoveringCopy = $0 }
            }
            .padding(.horizontal, 10)
            .padding(.top, 6)
            .padding(.bottom, 2)

            // Code content
            Text(code)
                .font(QMDesign.Typography.mono)
                .foregroundColor(QMDesign.Colors.textPrimary)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.bottom, 4)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.surfaceMedium)
        )
        .overlay(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .stroke(QMDesign.Colors.borderSubtle, lineWidth: 1)
        )
        .padding(.vertical, 2)
    }

    private func copyCode() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        showCopied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            showCopied = false
        }
    }
}
