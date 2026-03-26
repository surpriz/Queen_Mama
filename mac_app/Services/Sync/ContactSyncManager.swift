//
//  ContactSyncManager.swift
//  QueenMama
//
//  Memory Palace: Manages contact synchronization between macOS app and web dashboard
//

import Foundation
import Combine

/// Syncable representation of a Contact for API transfer
struct SyncableContact: Codable {
    let deviceId: String
    let originalId: String
    let firstName: String
    let lastName: String?
    let email: String?
    let company: String?
    let role: String?
    let lastSeenAt: String
    let version: Int
    let notes: [SyncableNote]?

    init(from contact: Contact, deviceId: String) {
        self.deviceId = deviceId
        self.originalId = contact.id.uuidString
        self.firstName = contact.firstName
        self.lastName = contact.lastName
        self.email = contact.email
        self.company = contact.company
        self.role = contact.role
        self.lastSeenAt = ISO8601DateFormatter().string(from: contact.lastSeenAt)
        self.version = 1
        self.notes = contact.notes.map { SyncableNote(from: $0) }
    }

    /// Custom decoder to handle old queue files that lack deviceId
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.deviceId = try container.decodeIfPresent(String.self, forKey: .deviceId) ?? DeviceInfo.current().deviceId
        self.originalId = try container.decode(String.self, forKey: .originalId)
        self.firstName = try container.decode(String.self, forKey: .firstName)
        self.lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        self.email = try container.decodeIfPresent(String.self, forKey: .email)
        self.company = try container.decodeIfPresent(String.self, forKey: .company)
        self.role = try container.decodeIfPresent(String.self, forKey: .role)
        self.lastSeenAt = try container.decode(String.self, forKey: .lastSeenAt)
        self.version = try container.decode(Int.self, forKey: .version)
        self.notes = try container.decodeIfPresent([SyncableNote].self, forKey: .notes)
    }

    struct SyncableNote: Codable {
        let originalId: String
        let content: String
        let createdAt: String

        init(from note: ContactNote) {
            self.originalId = note.id.uuidString
            self.content = note.content
            self.createdAt = ISO8601DateFormatter().string(from: note.createdAt)
        }
    }
}

/// Manages contact synchronization between macOS app and web dashboard
@MainActor
final class ContactSyncManager: ObservableObject {
    static let shared = ContactSyncManager()

    // MARK: - Published State

    @Published private(set) var isSyncing: Bool = false
    @Published private(set) var isPulling: Bool = false
    @Published private(set) var pendingCount: Int = 0
    @Published private(set) var lastSyncAt: Date?
    @Published private(set) var lastError: String?

    // MARK: - Callbacks

    /// Called when contacts are pulled from the server and need to be inserted into SwiftData
    var onContactsImported: (([Contact]) -> Void)?

    /// Called after a contact is successfully pushed to the server (originalId, remoteId)
    var onContactSynced: ((String, String) -> Void)?

    // MARK: - Dependencies

    private let authManager = AuthenticationManager.shared
    private let licenseManager = LicenseManager.shared
    private let deviceInfo = DeviceInfo.current()

    // MARK: - Persistence

    private let queueFileURL: URL
    private var pendingQueue: [SyncableContact] = []

    // Track synced contact IDs
    private let syncedContactsKey = "synced_contact_ids"
    private var syncedContactIds: Set<String> = []

    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Set up queue persistence file
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appFolder = appSupport.appendingPathComponent("QueenMama", isDirectory: true)
        try? FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
        queueFileURL = appFolder.appendingPathComponent("contact_sync_queue.json")

        loadQueue()
        loadSyncedIds()
    }

    // MARK: - Public Methods

    /// Queue a contact for sync
    func queueContact(_ contact: Contact) {
        guard authManager.isAuthenticated else { return }
        guard licenseManager.isFeatureAvailable(.sessionSync) else { return }

        let syncable = SyncableContact(from: contact, deviceId: deviceInfo.deviceId)

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

    /// Force sync all pending contacts
    func syncNow() async {
        await syncPendingIfNeeded()
    }

    /// Check if a contact has been synced
    func isSynced(_ contactId: UUID) -> Bool {
        syncedContactIds.contains(contactId.uuidString)
    }

    /// Check if sync is available
    var canSync: Bool {
        authManager.isAuthenticated && licenseManager.isFeatureAvailable(.sessionSync)
    }

    // MARK: - Internal Sync Logic

    private func syncPendingIfNeeded() async {
        guard canSync else { return }
        guard !pendingQueue.isEmpty else { return }
        guard !isSyncing else { return }

        isSyncing = true
        defer { isSyncing = false }

        do {
            let accessToken = try await authManager.getAccessToken()

            // Batch upload (max 10 at a time)
            let batch = Array(pendingQueue.prefix(10))

            let response = try await uploadContacts(batch, accessToken: accessToken)

            // Remove successfully synced contacts from queue
            for result in response.results where result.status != "error" {
                syncedContactIds.insert(result.originalId)
                pendingQueue.removeAll { $0.originalId == result.originalId }

                // Notify listener to save remoteId
                if let syncedId = result.syncedId {
                    onContactSynced?(result.originalId, syncedId)
                }
            }

            pendingCount = pendingQueue.count
            lastSyncAt = Date()
            lastError = nil

            saveSyncedIds()
            saveQueue()

            print("[ContactSync] Synced \(response.synced) contacts, \(response.failed) failed")

            // Continue syncing if there are more
            if !pendingQueue.isEmpty {
                await syncPendingIfNeeded()
            }

        } catch {
            lastError = error.localizedDescription
            CrashReporter.shared.captureError(error, extras: ["service": "contact_sync", "operation": "upload"])
            print("[ContactSync] Sync failed: \(error)")
        }
    }

    // MARK: - Pull Remote Contacts (Bidirectional Sync)

    /// Pull contacts from the web dashboard and import them locally
    @discardableResult
    func pullRemoteContacts(localContactIds: Set<String>, localContactEmails: Set<String>) async -> Int {
        guard canSync else {
            print("[ContactSync] Pull skipped - not authenticated or no PRO subscription")
            return 0
        }

        isPulling = true
        defer { isPulling = false }

        do {
            let accessToken = try await authManager.getAccessToken()
            let remoteContacts = try await fetchRemoteContacts(accessToken: accessToken)

            print("[ContactSync] Found \(remoteContacts.count) contacts on server")

            // Filter out contacts that already exist locally
            // Match by remoteId (server-side id) or by email
            let contactsToImport = remoteContacts.filter { remote in
                // Skip if we already have this contact by remoteId
                if localContactIds.contains(remote.id) {
                    return false
                }
                // Skip if we have a contact with the same email
                if let email = remote.email?.lowercased(), localContactEmails.contains(email) {
                    return false
                }
                return true
            }

            if contactsToImport.isEmpty {
                print("[ContactSync] No new contacts to import")
                return 0
            }

            print("[ContactSync] Importing \(contactsToImport.count) new contacts from server")

            var importedContacts: [Contact] = []

            for remote in contactsToImport {
                let contact = Contact(
                    firstName: remote.firstName,
                    lastName: remote.lastName,
                    email: remote.email,
                    company: remote.company,
                    role: remote.role,
                    lastSeenAt: parseDate(remote.lastSeenAt) ?? Date(),
                    createdAt: parseDate(remote.createdAt) ?? Date(),
                    isSynced: true,
                    remoteId: remote.id
                )
                importedContacts.append(contact)

                // Track as synced
                syncedContactIds.insert(contact.id.uuidString)
            }

            saveSyncedIds()

            if !importedContacts.isEmpty {
                onContactsImported?(importedContacts)
            }

            print("[ContactSync] Successfully imported \(importedContacts.count) contacts")
            lastSyncAt = Date()
            return importedContacts.count

        } catch {
            print("[ContactSync] Pull failed: \(error)")
            CrashReporter.shared.captureError(error, extras: ["service": "contact_sync", "operation": "pull"])
            lastError = error.localizedDescription
            return 0
        }
    }

    private func fetchRemoteContacts(accessToken: String) async throws -> [RemoteContact] {
        var urlComponents = URLComponents(url: URLConfigManager.shared.syncContactsURL, resolvingAgainstBaseURL: false)!
        urlComponents.queryItems = [
            URLQueryItem(name: "includeNotes", value: "true"),
            URLQueryItem(name: "limit", value: "500"),
        ]

        guard let url = urlComponents.url else {
            throw SyncError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }

        guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            if httpResponse.statusCode == 401 { throw SyncError.unauthorized }
            if httpResponse.statusCode == 403 { throw SyncError.subscriptionRequired }
            throw SyncError.serverError(httpResponse.statusCode)
        }

        let decoded = try JSONDecoder().decode(RemoteContactsResponse.self, from: data)
        return decoded.contacts
    }

    private func parseDate(_ dateString: String?) -> Date? {
        guard let dateString else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) { return date }
        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        return fallback.date(from: dateString)
    }

    // MARK: - API Calls

    private func uploadContacts(_ contacts: [SyncableContact], accessToken: String) async throws -> SyncResponse {
        var request = URLRequest(url: URLConfigManager.shared.syncContactsURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let payload = ContactSyncPayload(
            contacts: contacts,
            deviceId: deviceInfo.deviceId
        )
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw SyncError.unauthorized
        }

        if httpResponse.statusCode == 403 {
            throw SyncError.subscriptionRequired
        }

        guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            throw SyncError.serverError(httpResponse.statusCode)
        }

        return try JSONDecoder().decode(SyncResponse.self, from: data)
    }

    // MARK: - Persistence

    private func loadQueue() {
        guard FileManager.default.fileExists(atPath: queueFileURL.path) else { return }
        do {
            let data = try Data(contentsOf: queueFileURL)
            pendingQueue = try JSONDecoder().decode([SyncableContact].self, from: data)
            pendingCount = pendingQueue.count
        } catch {
            print("[ContactSync] Failed to load queue: \(error)")
        }
    }

    private func saveQueue() {
        do {
            let data = try JSONEncoder().encode(pendingQueue)
            try data.write(to: queueFileURL)
        } catch {
            print("[ContactSync] Failed to save queue: \(error)")
        }
    }

    private func loadSyncedIds() {
        if let ids = UserDefaults.standard.array(forKey: syncedContactsKey) as? [String] {
            syncedContactIds = Set(ids)
        }
    }

    private func saveSyncedIds() {
        UserDefaults.standard.set(Array(syncedContactIds), forKey: syncedContactsKey)
    }

    // MARK: - Models

    private struct ContactSyncPayload: Encodable {
        let contacts: [SyncableContact]
        let deviceId: String
    }

    private struct SyncResponse: Decodable {
        let synced: Int
        let failed: Int
        let results: [SyncResult]

        struct SyncResult: Decodable {
            let originalId: String
            let syncedId: String?
            let status: String
        }
    }

    private struct RemoteContactsResponse: Decodable {
        let contacts: [RemoteContact]
        let total: Int
    }

    struct RemoteContact: Decodable {
        let id: String
        let firstName: String
        let lastName: String?
        let email: String?
        let company: String?
        let role: String?
        let originalId: String?
        let deviceId: String?
        let lastSeenAt: String?
        let createdAt: String?
        let updatedAt: String?
        let notes: [RemoteNote]?

        struct RemoteNote: Decodable {
            let id: String
            let content: String
            let createdAt: String
        }
    }

    enum SyncError: LocalizedError {
        case invalidResponse
        case unauthorized
        case subscriptionRequired
        case serverError(Int)

        var errorDescription: String? {
            switch self {
            case .invalidResponse: return "Invalid server response"
            case .unauthorized: return "Not authorized"
            case .subscriptionRequired: return "PRO subscription required"
            case .serverError(let code): return "Server error: \(code)"
            }
        }
    }
}
