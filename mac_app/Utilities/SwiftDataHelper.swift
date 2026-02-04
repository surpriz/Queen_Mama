import Foundation
import SwiftData

// MARK: - SwiftData Save Helper
// Uses @MainActor to ensure ModelContext.save() runs on the same thread where context was created
// This prevents "ModelContext unbinding from main queue" warnings and potential deadlocks
@MainActor
final class SwiftDataHelper {

    // Singleton for convenience
    static let shared = SwiftDataHelper()

    /// Debounced save task
    private var saveTask: Task<Void, Never>?
    private let saveDebounceInterval: TimeInterval = 0.3 // 300ms debounce

    private init() {}

    /// Performs a save operation on the main actor with optional debouncing
    /// - Parameter context: The ModelContext to save
    /// - Parameter immediate: If true, saves immediately without debouncing
    func save(context: ModelContext?, immediate: Bool = false) {
        guard let context = context else { return }

        if immediate {
            // Cancel pending debounced save
            saveTask?.cancel()
            saveTask = nil

            // Save immediately on main actor (where context was created)
            do {
                try context.save()
            } catch {
                print("[SwiftDataHelper] Immediate save failed: \(error)")
                // TRACKING: Report SwiftData save failures
                CrashReporter.shared.captureError(error, extras: [
                    "save_type": "immediate",
                    "context": "swift_data_helper"
                ])
            }
        } else {
            // Cancel any pending debounced save
            saveTask?.cancel()

            // Schedule debounced save on main actor
            saveTask = Task { @MainActor [weak self] in
                guard let self = self else { return }

                do {
                    try await Task.sleep(nanoseconds: UInt64(self.saveDebounceInterval * 1_000_000_000))

                    // Check if task was cancelled during sleep
                    try Task.checkCancellation()

                    try context.save()
                } catch is CancellationError {
                    // Debounce cancelled by newer save request - this is expected
                } catch {
                    print("[SwiftDataHelper] Debounced save failed: \(error)")
                    // TRACKING: Report SwiftData save failures
                    CrashReporter.shared.captureError(error, extras: [
                        "save_type": "debounced",
                        "context": "swift_data_helper"
                    ])
                }
            }
        }
    }

    /// Flushes any pending save operation immediately
    func flush(context: ModelContext?) {
        saveTask?.cancel()
        saveTask = nil

        guard let context = context else { return }

        // Save synchronously on main actor
        do {
            try context.save()
        } catch {
            print("[SwiftDataHelper] Flush save failed: \(error)")
            // TRACKING: Report SwiftData save failures
            CrashReporter.shared.captureError(error, extras: [
                "save_type": "flush",
                "context": "swift_data_helper"
            ])
        }
    }
}
