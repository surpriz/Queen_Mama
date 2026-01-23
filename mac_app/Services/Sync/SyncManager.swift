import Foundation
import SwiftData
import Combine

/// Manages session synchronization between macOS app and web dashboard
@MainActor
final class SyncManager: ObservableObject {
    static let shared = SyncManager()

    // MARK: - Published State

    @Published private(set) var isSyncing: Bool = false
    @Published private(set) var lastSyncAt: Date?
    @Published private(set) var pendingCount: Int = 0
    @Published private(set) var lastError: String?
    @Published private(set) var isOffline: Bool = false

    // MARK: - Dependencies

    private let authManager = AuthenticationManager.shared
    private let licenseManager = LicenseManager.shared
    private let deviceInfo = DeviceInfo.current()

    // MARK: - Persistence

    private let queueFileURL: URL
    private var pendingQueue: [SyncableSession] = []

    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Set up queue persistence file
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appFolder = appSupport.appendingPathComponent("QueenMama", isDirectory: true)
        try? FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
        queueFileURL = appFolder.appendingPathComponent("sync_queue.json")

        loadQueue()

        // Auto-sync when coming online
        NotificationCenter.default.publisher(for: .NSReachabilityDidChange)
            .debounce(for: .seconds(2), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in
                Task { @MainActor in
                    await self?.syncPendingIfNeeded()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Queue a session for sync
    func queueSession(_ session: Session) {
        guard authManager.isAuthenticated else { return }
        guard licenseManager.isFeatureAvailable(.sessionSync) else { return }

        let syncable = SyncableSession(from: session, deviceId: deviceInfo.deviceId)

        // Check if already queued (update if so)
        if let index = pendingQueue.firstIndex(where: { $0.originalId == syncable.originalId }) {
            pendingQueue[index] = syncable
        } else {
            pendingQueue.append(syncable)
        }

        pendingCount = pendingQueue.count
        saveQueue()

        // Try to sync immediately
        Task {
            await syncPendingIfNeeded()
        }
    }

    /// Force sync all pending sessions
    func syncNow() async {
        await syncPendingIfNeeded()
    }

    /// Clear all pending syncs
    func clearQueue() {
        pendingQueue.removeAll()
        pendingCount = 0
        saveQueue()
    }

    // MARK: - Private Methods

    private func syncPendingIfNeeded() async {
        guard !isSyncing else { return }
        guard !pendingQueue.isEmpty else { return }
        guard authManager.isAuthenticated else { return }
        guard licenseManager.isFeatureAvailable(.sessionSync) else {
            lastError = "Session sync requires PRO subscription"
            return
        }

        isSyncing = true
        lastError = nil
        isOffline = false

        do {
            let accessToken = try await authManager.getAccessToken()

            // Sync in batches of 10
            let batch = Array(pendingQueue.prefix(10))
            let result = try await syncBatch(batch, accessToken: accessToken)

            // Remove synced sessions from queue
            for syncedId in result.syncedIds {
                pendingQueue.removeAll { $0.originalId == syncedId }
            }

            pendingCount = pendingQueue.count
            lastSyncAt = Date()
            saveQueue()

            // Continue if more pending
            if !pendingQueue.isEmpty {
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second delay
                await syncPendingIfNeeded()
            }

        } catch {
            print("[Sync] Error: \(error)")
            lastError = error.localizedDescription

            // Check if it's a network error to set offline status
            if let urlError = error as? URLError,
               urlError.code == .notConnectedToInternet || urlError.code == .networkConnectionLost {
                isOffline = true
            }
        }

        isSyncing = false
    }

    private func syncBatch(_ sessions: [SyncableSession], accessToken: String) async throws -> SyncResult {
        #if DEBUG
        let url = URL(string: "http://localhost:3000/api/sync/sessions")!
        #else
        let url = URL(string: "https://www.queenmama.co/api/sync/sessions")!
        #endif
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let body = SyncRequest(sessions: sessions)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return try JSONDecoder().decode(SyncResult.self, from: data)
        case 401:
            throw SyncError.unauthorized
        case 403:
            throw SyncError.subscriptionRequired
        default:
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw SyncError.serverError(message)
        }
    }

    // MARK: - Queue Persistence

    private func loadQueue() {
        guard FileManager.default.fileExists(atPath: queueFileURL.path) else { return }

        do {
            let data = try Data(contentsOf: queueFileURL)
            pendingQueue = try JSONDecoder().decode([SyncableSession].self, from: data)
            pendingCount = pendingQueue.count
        } catch {
            print("[Sync] Failed to load queue: \(error)")
        }
    }

    private func saveQueue() {
        do {
            let data = try JSONEncoder().encode(pendingQueue)
            try data.write(to: queueFileURL, options: .atomic)
        } catch {
            print("[Sync] Failed to save queue: \(error)")
        }
    }
}

// MARK: - Types

struct SyncableSession: Codable {
    let deviceId: String
    let originalId: String
    let title: String
    let startTime: String
    let endTime: String?
    let duration: Int?
    let transcript: String?
    let summary: String?
    let actionItems: [String]?
    let modeUsed: String?
    let version: Int
    let checksum: String?

    init(from session: Session, deviceId: String) {
        self.deviceId = deviceId
        self.originalId = session.id.uuidString
        self.title = session.title
        self.startTime = ISO8601DateFormatter().string(from: session.startTime)
        self.endTime = session.endTime.map { ISO8601DateFormatter().string(from: $0) }
        self.duration = session.duration.map { Int($0) }
        self.transcript = session.transcript.isEmpty ? nil : session.transcript
        self.summary = session.summary
        self.actionItems = session.actionItems.isEmpty ? nil : session.actionItems
        self.modeUsed = session.modeId?.uuidString
        self.version = 1
        self.checksum = Self.computeChecksum(session)
    }

    private static func computeChecksum(_ session: Session) -> String {
        let content = "\(session.id)\(session.transcript)\(session.summary ?? "")"
        let data = Data(content.utf8)
        return data.base64EncodedString().prefix(16).description
    }
}

struct SyncRequest: Codable {
    let sessions: [SyncableSession]
}

struct SyncResult: Codable {
    let syncedCount: Int
    let failed: Int
    let results: [SyncedSessionResult]
    let errors: [SyncResultError]?

    /// IDs of successfully synced sessions
    var syncedIds: [String] {
        results.filter { $0.status == "synced" }.map { $0.originalId }
    }

    struct SyncedSessionResult: Codable {
        let originalId: String
        let syncedId: String?
        let status: String
    }

    struct SyncResultError: Codable {
        let originalId: String
        let error: String
    }

    // Map from API response field name
    enum CodingKeys: String, CodingKey {
        case syncedCount = "synced"
        case failed
        case results
        case errors
    }
}

enum SyncError: LocalizedError {
    case invalidResponse
    case unauthorized
    case subscriptionRequired
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Please sign in again"
        case .subscriptionRequired:
            return "Session sync requires PRO subscription"
        case .serverError(let message):
            return message
        }
    }
}

// MARK: - Reachability Notification Extension

extension NSNotification.Name {
    static let NSReachabilityDidChange = NSNotification.Name("NSReachabilityDidChange")
}
