import Foundation
import os.log

/// Structured logging system for Queen Mama
///
/// Provides consistent, structured logging with support for:
/// - Multiple log levels (debug, info, warning, error)
/// - Context attachments for better traceability
/// - JSON output for log aggregation
/// - Integration with Apple's unified logging (os.log)
///
/// Usage:
/// ```swift
/// Logger.info("User logged in", context: ["userId": userId])
/// Logger.error("API request failed", error: error, context: ["endpoint": url])
/// ```
final class Logger: @unchecked Sendable {
    // MARK: - Log Level

    enum Level: String, Codable, Comparable {
        case debug = "DEBUG"
        case info = "INFO"
        case warning = "WARN"
        case error = "ERROR"

        var osLogType: OSLogType {
            switch self {
            case .debug: return .debug
            case .info: return .info
            case .warning: return .default
            case .error: return .error
            }
        }

        private var order: Int {
            switch self {
            case .debug: return 0
            case .info: return 1
            case .warning: return 2
            case .error: return 3
            }
        }

        static func < (lhs: Level, rhs: Level) -> Bool {
            lhs.order < rhs.order
        }
    }

    // MARK: - Log Entry

    struct Entry: Codable {
        let timestamp: String
        let level: String
        let message: String
        let module: String
        let context: [String: AnyCodable]?
        let error: ErrorInfo?

        struct ErrorInfo: Codable {
            let type: String
            let message: String
            let code: Int?
        }
    }

    // MARK: - Configuration

    nonisolated(unsafe) static var minLevel: Level = {
        #if DEBUG
        return .debug
        #else
        return .info
        #endif
    }()

    nonisolated(unsafe) static var outputJSON: Bool = false // Set true for log aggregation
    nonisolated(unsafe) static var defaultModule = "QueenMama"

    // MARK: - OS Log Categories

    nonisolated(unsafe) private static let osLogs: [String: OSLog] = [
        "QueenMama": OSLog(subsystem: "com.queenmama.app", category: "general"),
        "Audio": OSLog(subsystem: "com.queenmama.app", category: "audio"),
        "Transcription": OSLog(subsystem: "com.queenmama.app", category: "transcription"),
        "AI": OSLog(subsystem: "com.queenmama.app", category: "ai"),
        "Auth": OSLog(subsystem: "com.queenmama.app", category: "auth"),
        "License": OSLog(subsystem: "com.queenmama.app", category: "license"),
        "Sync": OSLog(subsystem: "com.queenmama.app", category: "sync"),
        "Network": OSLog(subsystem: "com.queenmama.app", category: "network"),
    ]

    // MARK: - Public Logging Methods

    nonisolated static func debug(_ message: String, module: String = "QueenMama", context: [String: Any]? = nil) {
        log(level: .debug, message: message, module: module, context: context)
    }

    nonisolated static func info(_ message: String, module: String = "QueenMama", context: [String: Any]? = nil) {
        log(level: .info, message: message, module: module, context: context)
    }

    nonisolated static func warning(_ message: String, module: String = "QueenMama", context: [String: Any]? = nil) {
        log(level: .warning, message: message, module: module, context: context)
    }

    nonisolated static func error(_ message: String, error: Error? = nil, module: String = "QueenMama", context: [String: Any]? = nil) {
        log(level: .error, message: message, module: module, context: context, error: error)
    }

    // MARK: - Module-Specific Loggers

    /// Convenience loggers for common modules
    static let audio = ModuleLogger(module: "Audio")
    static let transcription = ModuleLogger(module: "Transcription")
    static let ai = ModuleLogger(module: "AI")
    static let auth = ModuleLogger(module: "Auth")
    static let license = ModuleLogger(module: "License")
    static let sync = ModuleLogger(module: "Sync")
    static let network = ModuleLogger(module: "Network")

    // MARK: - Private Implementation

    nonisolated(unsafe) private static let dateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    nonisolated(unsafe) private static let jsonEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }()

    private nonisolated static func log(
        level: Level,
        message: String,
        module: String,
        context: [String: Any]?,
        error: Error? = nil
    ) {
        guard level >= minLevel else { return }

        let timestamp = dateFormatter.string(from: Date())

        // Build error info if present
        var errorInfo: Entry.ErrorInfo?
        if let error = error {
            let nsError = error as NSError
            errorInfo = Entry.ErrorInfo(
                type: String(describing: type(of: error)),
                message: error.localizedDescription,
                code: nsError.code
            )
        }

        // Convert context to codable
        let codableContext = context?.compactMapValues { AnyCodable($0) }

        let entry = Entry(
            timestamp: timestamp,
            level: level.rawValue,
            message: message,
            module: module,
            context: codableContext?.isEmpty == true ? nil : codableContext,
            error: errorInfo
        )

        if outputJSON {
            outputJSONLog(entry: entry, level: level, module: module)
        } else {
            outputConsoleLog(entry: entry, level: level, module: module)
        }

        // Also log to OS unified logging
        logToOSLog(entry: entry, level: level, module: module)
    }

    private nonisolated static func outputJSONLog(entry: Entry, level: Level, module: String) {
        if let data = try? jsonEncoder.encode(entry),
           let jsonString = String(data: data, encoding: .utf8) {
            print(jsonString)
        }
    }

    private nonisolated static func outputConsoleLog(entry: Entry, level: Level, module: String) {
        var output = "[\(level.rawValue)] [\(module)] \(entry.message)"

        if let context = entry.context, !context.isEmpty {
            let contextStr = context.map { "\($0.key)=\($0.value.value)" }.joined(separator: ", ")
            output += " {\(contextStr)}"
        }

        if let error = entry.error {
            output += " [Error: \(error.message)]"
        }

        print(output)
    }

    private nonisolated static func logToOSLog(entry: Entry, level: Level, module: String) {
        let osLog = osLogs[module] ?? osLogs["QueenMama"]!

        var logMessage = entry.message
        if let context = entry.context, !context.isEmpty {
            let contextStr = context.map { "\($0.key)=\($0.value.value)" }.joined(separator: ", ")
            logMessage += " {\(contextStr)}"
        }
        if let error = entry.error {
            logMessage += " [Error: \(error.message)]"
        }

        os_log("%{public}@", log: osLog, type: level.osLogType, logMessage)
    }
}

// MARK: - Module Logger

/// A logger scoped to a specific module
struct ModuleLogger: Sendable {
    let module: String

    func debug(_ message: String, context: [String: Any]? = nil) {
        Logger.debug(message, module: module, context: context)
    }

    func info(_ message: String, context: [String: Any]? = nil) {
        Logger.info(message, module: module, context: context)
    }

    func warning(_ message: String, context: [String: Any]? = nil) {
        Logger.warning(message, module: module, context: context)
    }

    func error(_ message: String, error: Error? = nil, context: [String: Any]? = nil) {
        Logger.error(message, error: error, module: module, context: context)
    }
}

// MARK: - AnyCodable Helper

/// A type-erased Codable value for logging context
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            // Fallback to string representation
            try container.encode(String(describing: value))
        }
    }
}

// MARK: - Performance Logging

extension Logger {
    /// Measure and log the execution time of an operation
    nonisolated static func measure<T>(
        _ operation: String,
        module: String = "QueenMama",
        context: [String: Any]? = nil,
        block: () throws -> T
    ) rethrows -> T {
        let start = CFAbsoluteTimeGetCurrent()
        defer {
            let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000
            var ctx = context ?? [:]
            ctx["durationMs"] = Int(duration)
            info("\(operation) completed", module: module, context: ctx)
        }
        return try block()
    }

    /// Measure and log the execution time of an async operation
    nonisolated static func measureAsync<T>(
        _ operation: String,
        module: String = "QueenMama",
        context: [String: Any]? = nil,
        block: () async throws -> T
    ) async rethrows -> T {
        let start = CFAbsoluteTimeGetCurrent()
        defer {
            let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000
            var ctx = context ?? [:]
            ctx["durationMs"] = Int(duration)
            info("\(operation) completed", module: module, context: ctx)
        }
        return try await block()
    }
}
