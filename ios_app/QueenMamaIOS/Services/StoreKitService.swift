import Foundation
import StoreKit

/// StoreKit 2 subscription service.
///
/// The backend stays the single source of truth for the user's tier: every
/// verified transaction is POSTed (as JWS) to `/api/billing/apple/transaction`,
/// which verifies it with Apple and updates the user's subscription row. The
/// app then re-runs the normal license validation flow. StoreKit entitlements
/// are never trusted directly for feature gating.
@MainActor
final class StoreKitService: ObservableObject {
    static let shared = StoreKitService()

    enum ProductID {
        static let proMonthly = "com.queenmama.ios.pro.monthly"
        static let proYearly = "com.queenmama.ios.pro.yearly"
        static let all = [proMonthly, proYearly]
    }

    enum PurchaseState: Equatable {
        case idle
        case purchasing
        case success
        case failed(String)
    }

    @Published private(set) var products: [Product] = []
    @Published private(set) var purchaseState: PurchaseState = .idle
    @Published private(set) var isLoadingProducts = false

    private var updatesTask: Task<Void, Never>?
    private let appAccountTokenKey = "apple_app_account_token"

    private init() {}

    // MARK: - Lifecycle

    /// Start listening for transaction updates (renewals, Ask-to-Buy approvals,
    /// purchases finalized outside the app). Call once at app launch.
    func startTransactionListener() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(transactionResult: result)
            }
        }
    }

    func loadProducts() async {
        guard products.isEmpty else { return }
        isLoadingProducts = true
        defer { isLoadingProducts = false }
        do {
            let loaded = try await Product.products(for: ProductID.all)
            // Stable order: cheapest (monthly) first
            products = loaded.sorted { $0.price < $1.price }
            print("[StoreKit] Loaded \(products.count) products")
        } catch {
            print("[StoreKit] Failed to load products: \(error)")
        }
    }

    /// True when the current license was purchased through a non-Apple channel.
    /// Used to block double-billing: those users manage their plan on the web.
    var hasNonAppleSubscription: Bool {
        let license = LicenseManager.shared.currentLicense
        return license.plan != .free && license.provider?.uppercased() != "APPLE"
    }

    // MARK: - Purchase

    func purchase(_ product: Product) async {
        // Guard against double-billing: a user already subscribed via Stripe
        // must manage their plan on queenmama.co, not buy a second time here.
        if hasNonAppleSubscription {
            purchaseState = .failed(String(localized: "You already have an active subscription with this account."))
            return
        }

        purchaseState = .purchasing
        do {
            var options: Set<Product.PurchaseOption> = []
            if let token = await fetchAppAccountToken() {
                options.insert(.appAccountToken(token))
            }

            let result = try await product.purchase(options: options)
            switch result {
            case .success(let verification):
                await handle(transactionResult: verification)
                purchaseState = .success
                AnalyticsService.shared.capture("iap_purchase_success", properties: [
                    "product_id": product.id
                ])
            case .userCancelled:
                purchaseState = .idle
            case .pending:
                // Ask-to-Buy / SCA — Transaction.updates delivers the result later
                purchaseState = .idle
            @unknown default:
                purchaseState = .idle
            }
        } catch {
            print("[StoreKit] Purchase failed: \(error)")
            purchaseState = .failed(error.localizedDescription)
            AnalyticsService.shared.capture("iap_purchase_failed", properties: [
                "product_id": product.id,
                "error": error.localizedDescription
            ])
        }
    }

    func restorePurchases() async {
        purchaseState = .purchasing
        do {
            try await AppStore.sync()
        } catch {
            // Sync can fail (e.g. user cancelled App Store sign-in) — still try entitlements
            print("[StoreKit] AppStore.sync failed: \(error)")
        }

        var restored = 0
        for await result in Transaction.currentEntitlements {
            await handle(transactionResult: result, finish: false)
            restored += 1
        }
        await LicenseManager.shared.revalidate()
        purchaseState = restored > 0 ? .success : .failed(String(localized: "No purchases to restore."))
    }

    func resetPurchaseState() {
        purchaseState = .idle
    }

    // MARK: - Private

    /// Verifies, syncs to backend, refreshes the license, then finishes the transaction.
    /// On backend failure the transaction is left unfinished so Transaction.updates
    /// redelivers it on next launch and the sync is retried.
    private func handle(transactionResult result: VerificationResult<Transaction>, finish: Bool = true) async {
        guard case .verified(let transaction) = result else {
            print("[StoreKit] Unverified transaction — ignored")
            return
        }

        print("[StoreKit] Transaction: \(transaction.productID) (original: \(transaction.originalID))")

        do {
            try await AuthAPIClient.shared.syncAppleTransaction(signedTransaction: result.jwsRepresentation)
            await LicenseManager.shared.revalidate()
        } catch {
            print("[StoreKit] Backend sync failed (will retry on redelivery): \(error)")
            return
        }

        if finish {
            await transaction.finish()
        }
    }

    /// Returns the backend-issued UUID that links StoreKit purchases to the
    /// authenticated user. Cached locally after the first fetch.
    private func fetchAppAccountToken() async -> UUID? {
        if let cached = UserDefaults.standard.string(forKey: appAccountTokenKey),
           let uuid = UUID(uuidString: cached) {
            return uuid
        }
        do {
            let token = try await AuthAPIClient.shared.fetchAppAccountToken()
            if let uuid = UUID(uuidString: token) {
                UserDefaults.standard.set(token, forKey: appAccountTokenKey)
                return uuid
            }
        } catch {
            // Not fatal — the authenticated /transaction call links the purchase anyway
            print("[StoreKit] Failed to fetch appAccountToken: \(error)")
        }
        return nil
    }
}
