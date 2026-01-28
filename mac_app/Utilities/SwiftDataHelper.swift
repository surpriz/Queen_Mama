import Foundation
import SwiftData

/// Helper to perform SwiftData operations asynchronously without blocking the main thread
@MainActor
final class SwiftDataHelper {

    // Singleton for convenience
    static let shared = SwiftDataHelper()

    /// Debouncer for batching save operations
    private var saveWorkItem: DispatchWorkItem?
    private let saveDebounceInterval: TimeInterval = 0.3 // 300ms debounce

    private init() {}

    /// Performs a save operation asynchronously with debouncing
    /// - Parameter context: The ModelContext to save
    /// - Parameter immediate: If true, saves immediately without debouncing
    func save(context: ModelContext?, immediate: Bool = false) {
        guard let context = context else { return }

        if immediate {
            // Cancel pending debounced save
            saveWorkItem?.cancel()
            saveWorkItem = nil

            // Perform immediate save on background thread
            Task.detached(priority: .userInitiated) {
                do {
                    try context.save()
                } catch {
                    print("[SwiftDataHelper] Immediate save failed: \(error)")
                }
            }
        } else {
            // Debounce: wait for a pause in operations before saving
            saveWorkItem?.cancel()

            let workItem = DispatchWorkItem {
                Task.detached(priority: .utility) {
                    do {
                        try context.save()
                    } catch {
                        print("[SwiftDataHelper] Debounced save failed: \(error)")
                    }
                }
            }

            saveWorkItem = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + saveDebounceInterval, execute: workItem)
        }
    }

    /// Flushes any pending save operation immediately
    func flush(context: ModelContext?) {
        saveWorkItem?.cancel()
        saveWorkItem = nil

        guard let context = context else { return }

        Task.detached(priority: .userInitiated) {
            do {
                try context.save()
            } catch {
                print("[SwiftDataHelper] Flush save failed: \(error)")
            }
        }
    }
}
