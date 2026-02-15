//
//  AudioBatchingService.swift
//  QueenMama
//
//  Accumulates audio buffers and flushes in batches to reduce WebSocket overhead.
//  Instead of sending ~3750 messages/hour (every 256ms), sends ~240 messages/hour (every 1s).
//

import Foundation

@MainActor
final class AudioBatchingService: ObservableObject {
    // MARK: - Configuration

    /// Target batch size in bytes (~1 second of 16kHz mono 16-bit audio = 32KB)
    private let targetBatchSize: Int = 32_000

    /// Maximum time before forced flush (prevents stale audio)
    private let maxFlushInterval: TimeInterval = 1.0

    /// Minimum buffer before sending (avoid tiny packets)
    private let minBatchSize: Int = 8_000  // ~250ms

    // MARK: - State

    private var buffer = Data()
    private var flushTimer: Timer?
    private var lastFlushTime = Date()
    private var totalBytesBatched: Int = 0
    private var totalFlushes: Int = 0

    // MARK: - Callbacks

    /// Called when a batch is ready to send
    var onBatchReady: ((Data) -> Void)?

    // MARK: - Initialization

    init() {}

    // MARK: - Public Methods

    /// Append audio data to the buffer
    /// Will automatically flush when buffer is full or timer fires
    func append(_ data: Data) {
        buffer.append(data)
        totalBytesBatched += data.count

        // Flush if buffer is large enough
        if buffer.count >= targetBatchSize {
            flush()
        } else {
            // Schedule flush timer if not already running
            scheduleFlushTimer()
        }
    }

    /// Force flush any remaining buffered audio
    func flush() {
        guard !buffer.isEmpty else { return }

        // Only send if we have meaningful data or it's been too long
        let timeSinceLastFlush = Date().timeIntervalSince(lastFlushTime)
        if buffer.count < minBatchSize && timeSinceLastFlush < maxFlushInterval * 2 {
            // Wait for more data
            return
        }

        let batchData = buffer
        buffer = Data()
        lastFlushTime = Date()
        totalFlushes += 1

        // Cancel pending timer since we just flushed
        flushTimer?.invalidate()
        flushTimer = nil

        // Log periodically
        if totalFlushes % 60 == 0 {
            let avgBatchSize = totalBytesBatched / max(totalFlushes, 1)
            print("[AudioBatch] Stats: \(totalFlushes) flushes, avg batch: \(avgBatchSize / 1024)KB, total: \(totalBytesBatched / 1024)KB")
        }

        // Send the batch
        onBatchReady?(batchData)
    }

    /// Reset the buffer (call when stopping session)
    func reset() {
        // Flush any remaining data first
        if !buffer.isEmpty {
            flush()
        }

        buffer = Data()
        flushTimer?.invalidate()
        flushTimer = nil
        lastFlushTime = Date()

        print("[AudioBatch] Reset - Total batched: \(totalBytesBatched / 1024)KB in \(totalFlushes) flushes")
        totalBytesBatched = 0
        totalFlushes = 0
    }

    /// Start the batching service (call when starting session)
    func start() {
        buffer = Data()
        lastFlushTime = Date()
        print("[AudioBatch] Started with target batch size: \(targetBatchSize / 1024)KB, max interval: \(maxFlushInterval)s")
    }

    // MARK: - Private Methods

    private func scheduleFlushTimer() {
        // Don't reschedule if timer is already running
        guard flushTimer == nil else { return }

        flushTimer = Timer.scheduledTimer(withTimeInterval: maxFlushInterval, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.flushTimer = nil
                self?.flush()
            }
        }
    }
}
