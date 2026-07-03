//
//  SyntaxHighlighter.swift
//  QueenMama
//
//  Dependency-free syntax highlighting for code blocks in AI responses.
//  Produces an `AttributedString` (stays native — no WebView, so it remains
//  inside the undetectable overlay panel). Pragmatic regex tokenizer: comments
//  and strings are matched first and "mask" their ranges so keywords/numbers
//  inside them aren't re-colored.
//
//  Covers the languages that show up in interview / developer-exam answers.
//  Unknown languages fall back to a union of common keywords + universal
//  string/number/comment rules, which still reads well.
//

import SwiftUI

enum SyntaxHighlighter {

    // MARK: - Public

    static func highlight(_ code: String, language: String?) -> AttributedString {
        var attr = AttributedString(code)
        attr.foregroundColor = QMDesign.Colors.textPrimary

        let lang = (language ?? "").lowercased()
        let full = NSRange(location: 0, length: (code as NSString).length)
        var masked: [NSRange] = []   // string/comment ranges take priority

        func run(_ pattern: String, _ color: Color, options: NSRegularExpression.Options = [],
                 group: Int = 0, respectMask: Bool = true, record: Bool = false) {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return }
            regex.enumerateMatches(in: code, range: full) { match, _, _ in
                guard let match = match, match.numberOfRanges > group else { return }
                let r = match.range(at: group)
                guard r.location != NSNotFound, r.length > 0 else { return }
                if respectMask, masked.contains(where: { NSIntersectionRange($0, r).length > 0 }) { return }
                if record { masked.append(r) }
                colorize(&attr, code, r, color)
            }
        }

        // 1. Strings (recorded so their contents are left alone).
        run(#""(?:\\.|[^"\\])*""#, QMDesign.Colors.codeString, record: true)
        run(#"'(?:\\.|[^'\\])*'"#, QMDesign.Colors.codeString, record: true)
        if isCLike(lang) || lang == "js" || lang == "ts" || lang.contains("javascript") || lang.contains("typescript") {
            run(#"`(?:\\.|[^`\\])*`"#, QMDesign.Colors.codeString, record: true)
        }

        // 2. Comments (recorded). Pick the line-comment style by language family.
        for pattern in commentPatterns(for: lang) {
            run(pattern, QMDesign.Colors.codeComment, options: [.anchorsMatchLines], record: true)
        }
        run(#"/\*[\s\S]*?\*/"#, QMDesign.Colors.codeComment, record: true)

        // 3. Numbers.
        run(#"\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b"#, QMDesign.Colors.codeNumber)

        // 4. Keywords.
        let kws = keywords(for: lang)
        if !kws.isEmpty {
            let alt = kws.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|")
            run("\\b(?:\(alt))\\b", QMDesign.Colors.codeKeyword)
        }

        // 5. Types / capitalized identifiers (cheap heuristic).
        run(#"\b[A-Z][A-Za-z0-9_]*\b"#, QMDesign.Colors.codeType)

        return attr
    }

    // MARK: - Helpers

    private static func colorize(_ attr: inout AttributedString, _ code: String, _ nsRange: NSRange, _ color: Color) {
        guard let r = Range(nsRange, in: code) else { return }
        let start = code.distance(from: code.startIndex, to: r.lowerBound)
        let length = code.distance(from: r.lowerBound, to: r.upperBound)
        let lo = attr.index(attr.startIndex, offsetByCharacters: start)
        let hi = attr.index(lo, offsetByCharacters: length)
        attr[lo..<hi].foregroundColor = color
    }

    private static func isCLike(_ lang: String) -> Bool {
        ["c", "cpp", "c++", "objc", "objective-c", "java", "swift", "go", "rust", "kotlin", "scala", "cs", "csharp"].contains(lang)
    }

    private static func commentPatterns(for lang: String) -> [String] {
        switch lang {
        case "python", "py", "bash", "sh", "shell", "zsh", "ruby", "rb", "yaml", "yml", "toml", "r", "perl":
            return [#"#[^\n]*"#]
        case "sql":
            return [#"--[^\n]*"#, #"//[^\n]*"#]
        case "lua":
            return [#"--[^\n]*"#]
        case "html", "xml":
            return [#"<!--[\s\S]*?-->"#]
        default:
            return [#"//[^\n]*"#]
        }
    }

    private static func keywords(for lang: String) -> [String] {
        switch lang {
        case "swift":
            return ["func", "let", "var", "if", "else", "guard", "return", "for", "while", "in", "switch", "case", "default", "struct", "class", "enum", "protocol", "extension", "import", "self", "init", "deinit", "static", "private", "public", "internal", "fileprivate", "open", "final", "lazy", "weak", "unowned", "throws", "throw", "try", "catch", "async", "await", "nil", "true", "false", "where", "as", "is", "some", "any", "actor"]
        case "python", "py":
            return ["def", "class", "if", "elif", "else", "for", "while", "in", "return", "import", "from", "as", "try", "except", "finally", "with", "lambda", "yield", "pass", "break", "continue", "global", "nonlocal", "None", "True", "False", "and", "or", "not", "is", "async", "await", "raise", "assert", "del"]
        case "js", "javascript", "ts", "typescript", "jsx", "tsx":
            return ["function", "const", "let", "var", "if", "else", "for", "while", "do", "return", "class", "extends", "new", "this", "super", "import", "export", "from", "default", "try", "catch", "finally", "throw", "async", "await", "yield", "typeof", "instanceof", "in", "of", "null", "undefined", "true", "false", "switch", "case", "break", "continue", "interface", "type", "enum", "implements", "public", "private", "readonly"]
        case "java", "kotlin", "cs", "csharp":
            return ["public", "private", "protected", "class", "interface", "extends", "implements", "static", "final", "void", "int", "long", "double", "float", "boolean", "char", "new", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "try", "catch", "finally", "throw", "throws", "import", "package", "this", "super", "null", "true", "false", "abstract", "fun", "val", "var", "when", "object"]
        case "go":
            return ["func", "var", "const", "package", "import", "type", "struct", "interface", "map", "chan", "go", "defer", "return", "if", "else", "for", "range", "switch", "case", "default", "select", "break", "continue", "nil", "true", "false", "make", "new"]
        case "rust":
            return ["fn", "let", "mut", "const", "struct", "enum", "trait", "impl", "pub", "use", "mod", "match", "if", "else", "for", "while", "loop", "return", "self", "Self", "where", "as", "move", "ref", "async", "await", "dyn", "true", "false", "Some", "None", "Ok", "Err"]
        case "c", "cpp", "c++", "objc", "objective-c":
            return ["int", "char", "float", "double", "void", "long", "short", "unsigned", "signed", "struct", "union", "enum", "typedef", "const", "static", "extern", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "sizeof", "class", "public", "private", "protected", "virtual", "namespace", "template", "typename", "new", "delete", "nullptr", "true", "false", "auto", "using"]
        case "sql":
            return ["SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "ALTER", "DROP", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "AS", "AND", "OR", "NOT", "NULL", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "INDEX", "PRIMARY", "KEY", "FOREIGN", "REFERENCES"]
        case "bash", "sh", "shell", "zsh":
            return ["if", "then", "else", "elif", "fi", "for", "in", "do", "done", "while", "case", "esac", "function", "return", "export", "local", "echo", "cd", "exit"]
        case "json", "":
            return []
        default:
            // Union of the most common cross-language keywords.
            return ["function", "func", "def", "let", "var", "const", "if", "else", "for", "while", "return", "class", "import", "from", "true", "false", "null", "nil", "new", "public", "private", "static", "void", "int", "string"]
        }
    }
}
