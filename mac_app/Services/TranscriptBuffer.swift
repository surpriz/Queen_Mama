//
//  TranscriptBuffer.swift
//  QueenMama
//
//  Accumulates transcript updates and flushes in batches to reduce UI re-renders
//  and SwiftData writes. Instead of updating on every word, batches updates every 500ms.
//

import Foundation

@MainActor
final class TranscriptBuffer: ObservableObject {
    // MARK: - Configuration

    /// Time to wait before flushing accumulated transcript
    private let flushInterval: TimeInterval = 0.5

    // MARK: - State

    private var pendingText = ""
    private var flushTimer: Timer?
    private var totalUpdates: Int = 0
    private var totalFlushes: Int = 0

    // MARK: - Callbacks

    /// Called when buffered transcript is ready (batched update)
    var onFlush: ((String) -> Void)?

    // MARK: - Initialization

    init() {}

    // MARK: - Public Methods

    /// Append transcript text to the buffer
    /// Will be flushed after flushInterval or when flush() is called
    func append(_ text: String) {
        pendingText += text + " "
        totalUpdates += 1

        // Schedule flush if not already pending
        scheduleFlush()
    }

    /// Force flush any pending transcript
    func flush() {
        flushTimer?.invalidate()
        flushTimer = nil

        guard !pendingText.isEmpty else { return }

        let textToFlush = pendingText
        pendingText = ""
        totalFlushes += 1

        // Log periodically
        if totalFlushes % 20 == 0 {
            let batchRatio = totalFlushes > 0 ? totalUpdates / totalFlushes : 0
            print("[TranscriptBuffer] Stats: \(totalUpdates) updates batched into \(totalFlushes) flushes (avg \(batchRatio) updates/batch)")
        }

        onFlush?(textToFlush)
    }

    /// Reset the buffer (call when stopping session)
    func reset() {
        // Flush any remaining text first
        flush()

        pendingText = ""
        flushTimer?.invalidate()
        flushTimer = nil

        print("[TranscriptBuffer] Reset - \(totalUpdates) updates batched into \(totalFlushes) flushes")
        totalUpdates = 0
        totalFlushes = 0
    }

    /// Start the buffer (call when starting session)
    func start() {
        pendingText = ""
        totalUpdates = 0
        totalFlushes = 0
        print("[TranscriptBuffer] Started with \(flushInterval)s flush interval")
    }

    // MARK: - Private Methods

    private func scheduleFlush() {
        // Don't reschedule if timer is already running
        guard flushTimer == nil else { return }

        flushTimer = Timer.scheduledTimer(withTimeInterval: flushInterval, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.flushTimer = nil
                self?.flush()
            }
        }
    }
}
