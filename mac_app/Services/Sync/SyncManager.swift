import Foundation
import SwiftData
import Combine

/// Sync status for display in UI
enum SyncDisplayStatus {
    case notSynced
    case pending
    case syncing
    case synced
    case failed
}

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

    /// Session IDs that were deleted remotely and need local deletion
    @Published var sessionIdsToDeleteRemotely: Set<String> = []

    // MARK: - Dependencies

    private let authManager = AuthenticationManager.shared
    private let licenseManager = LicenseManager.shared
    private let deviceInfo = DeviceInfo.current()

    // MARK: - Persistence

    private let queueFileURL: URL
    private var pendingQueue: [SyncableSession] = []

    // Track synced session IDs (uploaded from this device)
    private let syncedSessionsKey = "synced_session_ids"
    private var syncedSessionIds: Set<String> = []
    private var failedSessionIds: Set<String> = []

    // Track imported session IDs (pulled from server, originally from other devices)
    private let importedSessionsKey = "imported_session_ids"
    private var importedSessionIds: Set<String> = []

    /// Callback to insert imported sessions into SwiftData (set by SessionListView)
    var onSessionsImported: (([Session]) -> Void)?

    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Set up queue persistence file
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appFolder = appSupport.appendingPathComponent("QueenMama", isDirectory: true)
        try? FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
        queueFileURL = appFolder.appendingPathComponent("sync_queue.json")

        loadQueue()
        loadSyncedIds()
        loadImportedIds()

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

    /// Get sync status for a session
    func getSyncStatus(for sessionId: UUID) -> SyncDisplayStatus {
        let idString = sessionId.uuidString
        if syncedSessionIds.contains(idString) {
            return .synced
        }
        if failedSessionIds.contains(idString) {
            return .failed
        }
        if pendingQueue.contains(where: { $0.originalId == idString }) {
            return isSyncing ? .syncing : .pending
        }
        return .notSynced
    }

    /// Queue an existing completed session for sync
    func queueExistingSession(_ session: Session) {
        guard authManager.isAuthenticated else { return }
        guard licenseManager.isFeatureAvailable(.sessionSync) else { return }
        guard session.endTime != nil else { return } // Must be completed

        let syncable = SyncableSession(from: session, deviceId: deviceInfo.deviceId)

        // Don't re-queue already synced sessions
        guard !syncedSessionIds.contains(syncable.originalId) else { return }

        // Check if already queued
        if !pendingQueue.contains(where: { $0.originalId == syncable.originalId }) {
            pendingQueue.append(syncable)
        }

        // Remove from failed set if retrying
        failedSessionIds.remove(syncable.originalId)

        pendingCount = pendingQueue.count
        saveQueue()

        Task {
            await syncPendingIfNeeded()
        }
    }

    /// Sync all completed sessions
    func syncAllSessions(_ sessions: [Session]) {
        for session in sessions where session.endTime != nil {
            queueExistingSession(session)
        }
    }

    /// Check if sync is available (authenticated + PRO subscription)
    var canSync: Bool {
        authManager.isAuthenticated && licenseManager.isFeatureAvailable(.sessionSync)
    }

    // MARK: - Auto Sync on Launch

    /// Perform initial sync: upload unsynced sessions, pull remote sessions, and reconcile deletions
    func performInitialSync(_ sessions: [Session]) async {
        guard canSync else {
            print("[Sync] Initial sync skipped - not authenticated or no PRO subscription")
            return
        }

        print("[Sync] Starting initial sync...")

        // 1. Queue unsynced completed sessions for upload
        let unsyncedSessions = sessions.filter { session in
            session.endTime != nil && getSyncStatus(for: session.id) == .notSynced
        }

        if !unsyncedSessions.isEmpty {
            print("[Sync] Found \(unsyncedSessions.count) unsynced sessions to upload")
            syncAllSessions(unsyncedSessions)
        }

        // 2. Fetch remote sessions and reconcile deletions
        await reconcileRemoteDeletions()

        // 3. Pull sessions from other devices (bidirectional sync)
        let localSessionIds = Set(sessions.map { $0.id.uuidString })
        let importedCount = await pullRemoteSessions(localSessionIds: localSessionIds)
        if importedCount > 0 {
            print("[Sync] Imported \(importedCount) sessions from other devices")
        }
    }

    /// Fetch remote sessions and mark locally-synced sessions for deletion if removed from server
    func reconcileRemoteDeletions() async {
        guard canSync else { return }

        do {
            let accessToken = try await authManager.getAccessToken()
            let remoteSessions = try await fetchRemoteSessions(accessToken: accessToken)

            // Get all originalIds from remote
            let remoteOriginalIds = Set(remoteSessions.map { $0.originalId })

            // Find sessions that we thought were synced but are no longer on the server
            let deletedRemotely = syncedSessionIds.filter { !remoteOriginalIds.contains($0) }

            if !deletedRemotely.isEmpty {
                print("[Sync] Found \(deletedRemotely.count) sessions deleted remotely")

                // Mark for local deletion
                sessionIdsToDeleteRemotely = deletedRemotely

                // Remove from synced tracking
                for id in deletedRemotely {
                    syncedSessionIds.remove(id)
                }
                UserDefaults.standard.set(Array(syncedSessionIds), forKey: syncedSessionsKey)
            }

            // Also mark remote sessions as synced locally (in case we missed tracking them)
            for remoteId in remoteOriginalIds {
                if !syncedSessionIds.contains(remoteId) {
                    syncedSessionIds.insert(remoteId)
                }
            }
            UserDefaults.standard.set(Array(syncedSessionIds), forKey: syncedSessionsKey)

            print("[Sync] Remote reconciliation complete. \(syncedSessionIds.count) sessions tracked as synced.")

        } catch {
            print("[Sync] Failed to reconcile remote deletions: \(error)")
        }
    }

    /// Clear the remote deletion list after UI has processed them
    func clearRemoteDeletions() {
        sessionIdsToDeleteRemotely.removeAll()
    }

    // MARK: - Pull Sessions from Web (Bidirectional Sync)

    /// Pull sessions from the web and import them locally
    /// Returns the number of newly imported sessions
    @discardableResult
    func pullRemoteSessions(localSessionIds: Set<String>) async -> Int {
        guard canSync else {
            print("[Sync] Pull skipped - not authenticated or no PRO subscription")
            return 0
        }

        isSyncing = true
        defer { isSyncing = false }

        do {
            let accessToken = try await authManager.getAccessToken()
            let remoteSessions = try await fetchAllRemoteSessions(accessToken: accessToken)

            print("[Sync] Found \(remoteSessions.count) sessions on server")

            // Filter out sessions that already exist locally
            // Only check if session exists in local SwiftData - that's the source of truth
            // We don't check importedSessionIds or syncedSessionIds because:
            // - The local database may have been cleared (reinstall, clean build)
            // - We need to re-import sessions that were originally from this device
            let sessionsToImport = remoteSessions.filter { remote in
                !localSessionIds.contains(remote.originalId)
            }

            if sessionsToImport.isEmpty {
                print("[Sync] No new sessions to import")
                return 0
            }

            print("[Sync] Importing \(sessionsToImport.count) new sessions from server")

            // Convert remote sessions to local Session objects
            var importedSessions: [Session] = []

            // Create date formatter that handles ISO 8601 with fractional seconds
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

            // Fallback formatter without fractional seconds
            let fallbackFormatter = ISO8601DateFormatter()
            fallbackFormatter.formatOptions = [.withInternetDateTime]

            func parseDate(_ dateString: String) -> Date? {
                return dateFormatter.date(from: dateString) ?? fallbackFormatter.date(from: dateString)
            }

            for remote in sessionsToImport {
                guard let startTime = parseDate(remote.startTime) else {
                    print("[Sync] Skipping session with invalid startTime: \(remote.originalId) - '\(remote.startTime)'")
                    continue
                }

                let endTime = remote.endTime.flatMap { parseDate($0) }
                let modeId = remote.modeUsed.flatMap { UUID(uuidString: $0) }

                let session = Session(
                    id: UUID(uuidString: remote.originalId) ?? UUID(),
                    title: remote.title,
                    startTime: startTime,
                    endTime: endTime,
                    transcript: remote.transcript ?? "",
                    summary: remote.summary,
                    actionItems: remote.actionItems ?? [],
                    modeId: modeId
                )

                importedSessions.append(session)

                // Track as imported (to avoid re-importing)
                importedSessionIds.insert(remote.originalId)

                // Also mark as synced (to avoid re-uploading back to server)
                syncedSessionIds.insert(remote.originalId)
            }

            // Save tracking IDs
            UserDefaults.standard.set(Array(importedSessionIds), forKey: importedSessionsKey)
            UserDefaults.standard.set(Array(syncedSessionIds), forKey: syncedSessionsKey)

            // Notify listener to insert sessions into SwiftData
            if !importedSessions.isEmpty {
                onSessionsImported?(importedSessions)
            }

            print("[Sync] Successfully imported \(importedSessions.count) sessions")
            lastSyncAt = Date()
            return importedSessions.count

        } catch {
            print("[Sync] Pull failed: \(error)")
            lastError = error.localizedDescription
            return 0
        }
    }

    /// Fetch all user sessions from server (across all devices) with full data
    private func fetchAllRemoteSessions(accessToken: String) async throws -> [RemoteFullSession] {
        var urlComponents = URLComponents(url: URLConfigManager.shared.syncSessionsURL, resolvingAgainstBaseURL: false)!
        urlComponents.queryItems = [
            URLQueryItem(name: "allDevices", value: "true"),
            URLQueryItem(name: "full", value: "true"),
            URLQueryItem(name: "limit", value: "100")
        ]

        var request = URLRequest(url: urlComponents.url!)
        request.httpMethod = "GET"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw SyncError.serverError("Failed to fetch remote sessions: \(httpResponse.statusCode)")
        }

        let result = try JSONDecoder().decode(RemoteFullSessionsResponse.self, from: data)
        return result.sessions
    }

    // MARK: - Remote Deletion (Mac → Web)

    /// Delete a session from the remote server
    func deleteRemoteSession(_ sessionId: UUID) async {
        guard canSync else {
            print("[Sync] Cannot delete remotely - not authenticated or no PRO subscription")
            return
        }

        let idString = sessionId.uuidString

        // Only delete if session was previously synced
        guard syncedSessionIds.contains(idString) else {
            print("[Sync] Session \(idString) was not synced, no remote deletion needed")
            return
        }

        do {
            let accessToken = try await authManager.getAccessToken()
            try await performRemoteDeletion(sessionId: idString, accessToken: accessToken)

            // Remove from synced tracking
            syncedSessionIds.remove(idString)
            UserDefaults.standard.set(Array(syncedSessionIds), forKey: syncedSessionsKey)

            print("[Sync] Successfully deleted session \(idString) from server")
        } catch {
            print("[Sync] Failed to delete session remotely: \(error)")
            // Session will still be deleted locally, but remain on server
            // User can manually delete from web if needed
        }
    }

    private func performRemoteDeletion(sessionId: String, accessToken: String) async throws {
        let baseURL = URLConfigManager.shared.syncSessionsURL
        let url = baseURL.appendingPathComponent(sessionId)

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            print("[Sync] Remote deletion successful")
        case 404:
            // Session not found on server - that's fine, already deleted
            print("[Sync] Session not found on server (already deleted?)")
        case 401:
            throw SyncError.unauthorized
        default:
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw SyncError.serverError("Delete failed: \(message)")
        }
    }

    // MARK: - Private Methods

    private func syncPendingIfNeeded() async {
        guard !isSyncing else { return }
        guard !pendingQueue.isEmpty else { return }
        guard authManager.isAuthenticated else { return }
        guard licenseManager.isFeatureAvailable(.sessionSync) else {
            lastError = "Session sync is not available"
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

            // Remove synced sessions from queue and mark as synced
            for syncedId in result.syncedIds {
                pendingQueue.removeAll { $0.originalId == syncedId }
                markAsSynced(syncedId)
            }

            // Mark failed sessions
            if let errors = result.errors {
                for error in errors {
                    markAsFailed(error.originalId)
                }
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

    private func fetchRemoteSessions(accessToken: String) async throws -> [RemoteSessionInfo] {
        let url = URLConfigManager.shared.syncSessionsURL
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw SyncError.serverError("Failed to fetch remote sessions: \(httpResponse.statusCode)")
        }

        let result = try JSONDecoder().decode(RemoteSessionsResponse.self, from: data)
        return result.sessions
    }

    private func syncBatch(_ sessions: [SyncableSession], accessToken: String) async throws -> SyncResult {
        let url = URLConfigManager.shared.syncSessionsURL
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

    // MARK: - Synced Session ID Persistence

    private func loadSyncedIds() {
        syncedSessionIds = Set(UserDefaults.standard.stringArray(forKey: syncedSessionsKey) ?? [])
    }

    private func loadImportedIds() {
        importedSessionIds = Set(UserDefaults.standard.stringArray(forKey: importedSessionsKey) ?? [])
    }

    private func markAsSynced(_ sessionId: String) {
        syncedSessionIds.insert(sessionId)
        failedSessionIds.remove(sessionId)
        UserDefaults.standard.set(Array(syncedSessionIds), forKey: syncedSessionsKey)
    }

    private func markAsFailed(_ sessionId: String) {
        failedSessionIds.insert(sessionId)
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

// MARK: - Remote Session Types

struct RemoteSessionInfo: Codable {
    let id: String
    let originalId: String
    let deviceId: String?
    let title: String
    let startTime: String
    let version: Int
    let checksum: String?
    let updatedAt: String
}

/// Full session data for import (includes transcript, summary, etc.)
struct RemoteFullSession: Codable {
    let id: String
    let originalId: String
    let deviceId: String
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
    let updatedAt: String
}

struct RemoteSessionsResponse: Codable {
    let sessions: [RemoteSessionInfo]
    let total: Int
    let limit: Int
    let offset: Int
}

struct RemoteFullSessionsResponse: Codable {
    let sessions: [RemoteFullSession]
    let total: Int
    let limit: Int
    let offset: Int
}

// MARK: - Reachability Notification Extension

extension NSNotification.Name {
    static let NSReachabilityDidChange = NSNotification.Name("NSReachabilityDidChange")
}
