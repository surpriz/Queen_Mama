//
//  RichBlockRenderer.swift
//  QueenMama
//
//  Renders LaTeX (KaTeX) and Mermaid diagrams for AI responses. KaTeX/Mermaid
//  are JS, so a WKWebView is required — but to preserve the undetectable overlay
//  (`OverlayPanel` sharingType = .none) and avoid live-WebView perf/streaming
//  issues, we render OFF-SCREEN and snapshot to an `NSImage`. A bitmap inside the
//  panel is fully covered by window-level content protection.
//
//  Assets are vendored offline under `Resources/rich/` (no CDN). If they're
//  missing the view falls back to showing the raw source as a code block, so the
//  build never breaks.
//

import SwiftUI
import WebKit

enum RichBlockKind {
    case math
    case diagram
}

@MainActor
final class RichBlockRenderer: NSObject {
    static let shared = RichBlockRenderer()

    private var cache: [String: NSImage] = [:]
    private let renderWidth: CGFloat = 380          // fits the 420px overlay minus padding
    private let renderTimeout: TimeInterval = 6.0

    /// Resolve the vendored assets directory inside the app bundle.
    private var assetsBaseURL: URL? {
        Bundle.main.resourceURL?.appendingPathComponent("rich", isDirectory: true)
    }

    // MARK: - Public

    func render(_ source: String, kind: RichBlockKind) async -> NSImage? {
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let key = "\(kind)|\(trimmed)"
        if let cached = cache[key] { return cached }

        guard let baseURL = assetsBaseURL,
              FileManager.default.fileExists(atPath: baseURL.appendingPathComponent("katex/katex.min.css").path) else {
            return nil   // assets not bundled → caller falls back to raw source
        }

        let html = Self.makeHTML(source: trimmed, kind: kind)
        let image = await renderToImage(html: html, baseURL: baseURL)
        if let image { cache[key] = image }
        return image
    }

    // MARK: - Off-screen WebView → NSImage

    private func renderToImage(html: String, baseURL: URL) async -> NSImage? {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        let coordinator = RenderCoordinator()
        controller.add(coordinator, name: "rendered")
        config.userContentController = controller

        let webView = WKWebView(
            frame: NSRect(x: 0, y: 0, width: renderWidth, height: 100),
            configuration: config
        )
        webView.setValue(false, forKey: "drawsBackground")   // transparent base

        // Off-screen host window so layout + snapshot actually happen.
        let window = NSWindow(
            contentRect: NSRect(x: -10_000, y: -10_000, width: renderWidth, height: 100),
            styleMask: [.borderless], backing: .buffered, defer: false
        )
        window.contentView?.addSubview(webView)

        let reportedHeight: CGFloat? = await withCheckedContinuation { continuation in
            coordinator.onHeight = { height in continuation.resume(returning: height) }
            webView.loadHTMLString(html, baseURL: baseURL)
            // Timeout guard so a broken render never hangs the UI.
            DispatchQueue.main.asyncAfter(deadline: .now() + renderTimeout) {
                coordinator.fireOnce(nil)
            }
        }

        guard let height = reportedHeight, height > 1 else {
            controller.removeScriptMessageHandler(forName: "rendered")
            return nil
        }

        // Resize to measured content and snapshot.
        webView.frame = NSRect(x: 0, y: 0, width: renderWidth, height: height)
        window.setContentSize(NSSize(width: renderWidth, height: height))

        let snapshotConfig = WKSnapshotConfiguration()
        snapshotConfig.rect = NSRect(x: 0, y: 0, width: renderWidth, height: height)

        let image: NSImage? = await withCheckedContinuation { continuation in
            // Small delay lets fonts/layout settle before the snapshot.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                webView.takeSnapshot(with: snapshotConfig) { img, _ in
                    continuation.resume(returning: img)
                }
            }
        }

        controller.removeScriptMessageHandler(forName: "rendered")
        webView.removeFromSuperview()
        return image
    }

    // MARK: - HTML

    private static func makeHTML(source: String, kind: RichBlockKind) -> String {
        // JSON-encode the source so it's safe inside a <script> string literal.
        let encoded = (try? String(data: JSONSerialization.data(withJSONObject: [source], options: []), encoding: .utf8))
            .map { String($0.dropFirst().dropLast()) } ?? ""   // strip surrounding [ ]

        let body: String
        switch kind {
        case .math:
            body = """
            <link rel="stylesheet" href="katex/katex.min.css">
            <script src="katex/katex.min.js"></script>
            <div id="out"></div>
            <script>
              const src = \(encoded);
              try { katex.render(src, document.getElementById('out'), {displayMode:true, throwOnError:false}); }
              catch(e) { document.getElementById('out').textContent = src; }
              requestAnimationFrame(() => report());
            </script>
            """
        case .diagram:
            body = """
            <script src="mermaid.min.js"></script>
            <div id="out"></div>
            <script>
              const src = \(encoded);
              mermaid.initialize({startOnLoad:false, theme:'dark', securityLevel:'loose'});
              mermaid.render('g0', src).then(({svg}) => {
                document.getElementById('out').innerHTML = svg;
                requestAnimationFrame(() => report());
              }).catch(e => { document.getElementById('out').textContent = src; report(); });
            </script>
            """
        }

        return """
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          html,body { margin:0; padding:6px 2px; background:transparent;
            color:#fff; font-family:-apple-system,system-ui,sans-serif; }
          #out { display:inline-block; }
          .katex { color:#fff; font-size:1.05em; }
          svg { max-width:100%; height:auto; }
        </style></head><body>
        <script>
          function report() {
            const el = document.getElementById('out') || document.body;
            const h = Math.ceil(el.getBoundingClientRect().height) + 12;
            window.webkit.messageHandlers.rendered.postMessage(h);
          }
        </script>
        \(body)
        </body></html>
        """
    }
}

// MARK: - Message handler

private final class RenderCoordinator: NSObject, WKScriptMessageHandler {
    var onHeight: ((CGFloat?) -> Void)?
    private var fired = false

    func fireOnce(_ height: CGFloat?) {
        guard !fired else { return }
        fired = true
        onHeight?(height)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let height = (message.body as? NSNumber).map { CGFloat(truncating: $0) }
        fireOnce(height)
    }
}

// MARK: - SwiftUI view

struct RichBlockView: View {
    let source: String
    let kind: RichBlockKind

    @State private var image: NSImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 2)
            } else if failed {
                // Graceful fallback: show the raw source as a code block.
                CodeBlockView(code: source, language: kind == .math ? "latex" : "mermaid")
            } else {
                Text(source)
                    .font(QMDesign.Typography.mono)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .task(id: source) {
            let rendered = await RichBlockRenderer.shared.render(source, kind: kind)
            if let rendered { image = rendered } else { failed = true }
        }
    }
}
