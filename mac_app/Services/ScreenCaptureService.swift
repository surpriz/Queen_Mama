import Foundation
@preconcurrency import ScreenCaptureKit
import CoreGraphics
import AppKit
import Combine

enum ScreenCaptureError: LocalizedError {
    case permissionDenied
    case noDisplaysAvailable
    case captureStartFailed(Error)
    case screenshotFailed

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Screen recording permission denied. Please enable in System Settings > Privacy & Security > Screen Recording."
        case .noDisplaysAvailable:
            return "No displays available for capture."
        case .captureStartFailed(let error):
            return "Failed to start screen capture: \(error.localizedDescription)"
        case .screenshotFailed:
            return "Failed to capture screenshot."
        }
    }
}

@MainActor
final class ScreenCaptureService: NSObject, ObservableObject {
    // MARK: - Published Properties

    @Published var isCapturing = false
    @Published var latestScreenshot: NSImage?
    @Published var errorMessage: String?

    // MARK: - Private Properties

    private var stream: SCStream?
    private var streamOutput: StreamOutput?
    private let config = ConfigurationManager.shared

    // Excluded windows (Queen Mama's own windows)
    private var excludedWindowIDs: Set<CGWindowID> = []

    // Screenshot timer
    private var screenshotTimer: Timer?

    // Screenshot deduplication for cost optimization
    private var lastScreenshotHash: String?

    // MARK: - Pre-Capture Cache (Phase 1 Optimization)
    // Cache screenshots in background for instant access during AI triggers
    private var cachedScreenshotData: Data?
    private var cachedScreenshotTimestamp: Date?
    private var cachedScreenshotAnalysis: ScreenContentAnalyzer.AnalysisResult?

    // Configuration
    private let preCaptureInterval: TimeInterval = 2.0  // Capture every 2 seconds
    private let cacheMaxAge: TimeInterval = 2.0         // Cache valid for 2 seconds

    // MARK: - Initialization

    override init() {
        super.init()
    }

    // MARK: - Permission Handling

    func checkPermission() async -> Bool {
        do {
            // Attempting to get shareable content will prompt for permission if needed
            _ = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            return true
        } catch {
            return false
        }
    }

    func requestPermission() async -> Bool {
        // On macOS, simply trying to access SCShareableContent will trigger the permission dialog
        return await checkPermission()
    }

    // MARK: - Capture Control

    func startCapture() async throws {
        guard !isCapturing else { return }

        // Check permission
        guard await checkPermission() else {
            throw ScreenCaptureError.permissionDenied
        }

        // Get available content
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

        guard let display = content.displays.first else {
            throw ScreenCaptureError.noDisplaysAvailable
        }

        // Exclude Queen Mama windows
        updateExcludedWindows()
        let excludedApps = content.applications.filter { app in
            app.bundleIdentifier == Bundle.main.bundleIdentifier
        }

        // Create content filter (capture all except our app)
        let filter = SCContentFilter(
            display: display,
            excludingApplications: excludedApps,
            exceptingWindows: []
        )

        // Configure stream
        let streamConfig = SCStreamConfiguration()
        streamConfig.width = Int(display.width)
        streamConfig.height = Int(display.height)
        streamConfig.minimumFrameInterval = CMTime(value: 1, timescale: 30) // 30 FPS max
        streamConfig.pixelFormat = kCVPixelFormatType_32BGRA
        streamConfig.showsCursor = true
        streamConfig.capturesAudio = config.captureSystemAudio

        if config.captureSystemAudio {
            streamConfig.sampleRate = 48000
            streamConfig.channelCount = 2
        }

        // Create stream
        stream = SCStream(filter: filter, configuration: streamConfig, delegate: self)

        // Add stream output
        streamOutput = StreamOutput()
        try stream?.addStreamOutput(streamOutput!, type: .screen, sampleHandlerQueue: .main)

        if config.captureSystemAudio {
            try stream?.addStreamOutput(streamOutput!, type: .audio, sampleHandlerQueue: .main)
        }

        // Start stream
        do {
            try await stream?.startCapture()
            isCapturing = true
            errorMessage = nil

            // Start periodic screenshot capture if enabled
            if config.autoScreenCapture {
                startScreenshotTimer()
            }
        } catch {
            throw ScreenCaptureError.captureStartFailed(error)
        }
    }

    func stopCapture() {
        guard isCapturing else { return }

        Task {
            try? await stream?.stopCapture()
            stream = nil
            streamOutput = nil
            isCapturing = false
            stopScreenshotTimer()
            clearCache()
        }
    }

    // MARK: - Screenshot Capture

    func captureScreenshot() async throws -> Data {
        guard await checkPermission() else {
            throw ScreenCaptureError.permissionDenied
        }

        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

        guard let display = content.displays.first else {
            throw ScreenCaptureError.noDisplaysAvailable
        }

        // Exclude Queen Mama windows
        let excludedApps = content.applications.filter { app in
            app.bundleIdentifier == Bundle.main.bundleIdentifier
        }

        let filter = SCContentFilter(
            display: display,
            excludingApplications: excludedApps,
            exceptingWindows: []
        )

        let config = SCStreamConfiguration()
        config.width = Int(display.width)
        config.height = Int(display.height)
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = false

        // Capture screenshot
        let image = try await SCScreenshotManager.captureImage(
            contentFilter: filter,
            configuration: config
        )

        // Convert to NSImage
        let nsImage = NSImage(cgImage: image, size: NSSize(width: image.width, height: image.height))
        latestScreenshot = nsImage

        // COST OPTIMIZATION: Resize to max 1024x576 for AI (sufficient for text/UI analysis)
        // Reduced from 1280x720 to improve response latency (smaller upload = faster)
        let maxWidth: CGFloat = 1024
        let maxHeight: CGFloat = 576
        let scaleFactor = min(
            maxWidth / CGFloat(image.width),
            maxHeight / CGFloat(image.height),
            1.0  // Don't upscale
        )

        let newWidth = Int(CGFloat(image.width) * scaleFactor)
        let newHeight = Int(CGFloat(image.height) * scaleFactor)

        let resizedImage = NSImage(size: NSSize(width: newWidth, height: newHeight))
        resizedImage.lockFocus()
        nsImage.draw(
            in: NSRect(x: 0, y: 0, width: newWidth, height: newHeight),
            from: NSRect(origin: .zero, size: nsImage.size),
            operation: .copy,
            fraction: 1.0
        )
        resizedImage.unlockFocus()

        // COST OPTIMIZATION: Compress to 50% for faster uploads (reduced from 60%)
        // GPT-5-mini can still read text/UI clearly at this quality
        guard let tiffData = resizedImage.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let jpegData = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.5]) else {
            throw ScreenCaptureError.screenshotFailed
        }

        return jpegData
    }

    /// Capture screenshot only if it has changed (deduplication for cost optimization)
    func captureScreenshotIfChanged() async throws -> Data? {
        let screenshot = try await captureScreenshot()
        let hash = screenshot.sha256Hash()

        if hash == lastScreenshotHash {
            return nil  // Same screenshot, don't send again
        }

        lastScreenshotHash = hash
        return screenshot
    }

    // MARK: - Pre-Capture Cache Methods (Phase 1 Optimization)

    /// Get cached screenshot if available and fresh enough
    /// Returns (data, analysis) tuple - analysis may be nil if not yet computed
    func getCachedScreenshot(maxAge: TimeInterval? = nil) -> (Data?, ScreenContentAnalyzer.AnalysisResult?) {
        let effectiveMaxAge = maxAge ?? cacheMaxAge

        guard let data = cachedScreenshotData,
              let timestamp = cachedScreenshotTimestamp else {
            print("[ScreenCapture] Cache miss: no cached data")
            return (nil, nil)
        }

        let age = Date().timeIntervalSince(timestamp)
        if age > effectiveMaxAge {
            print("[ScreenCapture] Cache miss: expired (age: \(String(format: "%.1f", age))s > \(effectiveMaxAge)s)")
            return (nil, nil)
        }

        print("[ScreenCapture] Cache hit: using cached screenshot (age: \(String(format: "%.1f", age))s)")
        return (data, cachedScreenshotAnalysis)
    }

    /// Capture screenshot and update cache (used by background timer)
    private func captureAndCacheScreenshot() async {
        do {
            let startTime = CFAbsoluteTimeGetCurrent()
            let data = try await captureScreenshot()
            let captureTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000

            // Update cache
            cachedScreenshotData = data
            cachedScreenshotTimestamp = Date()

            // Analyze content in background (Phase 2)
            let analyzer = ScreenContentAnalyzer.shared
            let analysis = await analyzer.analyze(data)
            cachedScreenshotAnalysis = analysis

            let totalTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000

            if analysis.shouldInclude {
                print("[ScreenCapture] Pre-cached screenshot: \(data.count / 1024)KB, capture: \(Int(captureTime))ms, analysis: \(analysis.analysisTimeMs)ms, total: \(Int(totalTime))ms → INCLUDE")
            } else {
                print("[ScreenCapture] Pre-cached screenshot: \(data.count / 1024)KB, capture: \(Int(captureTime))ms, analysis: \(analysis.analysisTimeMs)ms, total: \(Int(totalTime))ms → SKIP (\(analysis.reason?.rawValue ?? "unknown"))")
            }
        } catch {
            print("[ScreenCapture] Pre-capture failed: \(error.localizedDescription)")
        }
    }

    /// Get screenshot for AI request - uses cache if fresh, otherwise captures fresh
    /// Also respects content analysis to skip low-value screenshots
    func getScreenshotForAI() async throws -> Data? {
        // First, try to use cached screenshot
        let (cachedData, cachedAnalysis) = getCachedScreenshot()

        if let data = cachedData {
            // Check if we should include based on analysis
            if let analysis = cachedAnalysis, !analysis.shouldInclude {
                print("[ScreenCapture] Skipping screenshot: \(analysis.reason?.rawValue ?? "unknown")")
                return nil
            }
            return data
        }

        // Cache miss - capture fresh
        print("[ScreenCapture] Capturing fresh screenshot (cache miss)")
        let data = try await captureScreenshot()

        // Update cache with fresh capture
        cachedScreenshotData = data
        cachedScreenshotTimestamp = Date()

        // Quick analysis for immediate decision
        let analyzer = ScreenContentAnalyzer.shared
        let analysis = await analyzer.analyze(data)
        cachedScreenshotAnalysis = analysis

        if !analysis.shouldInclude {
            print("[ScreenCapture] Skipping fresh screenshot: \(analysis.reason?.rawValue ?? "unknown")")
            return nil
        }

        return data
    }

    /// Clear the screenshot cache
    func clearCache() {
        cachedScreenshotData = nil
        cachedScreenshotTimestamp = nil
        cachedScreenshotAnalysis = nil
        print("[ScreenCapture] Cache cleared")
    }

    // MARK: - Private Methods

    private func updateExcludedWindows() {
        // Get all windows belonging to our app
        if let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] {
            let bundleIdentifier = Bundle.main.bundleIdentifier ?? ""

            excludedWindowIDs = Set(windowList.compactMap { window -> CGWindowID? in
                guard let ownerName = window[kCGWindowOwnerName as String] as? String,
                      ownerName == bundleIdentifier || ownerName == "Queen Mama",
                      let windowID = window[kCGWindowNumber as String] as? CGWindowID else {
                    return nil
                }
                return windowID
            })
        }
    }

    private func startScreenshotTimer() {
        // Use pre-capture interval for background caching
        let interval = preCaptureInterval
        print("[ScreenCapture] Starting pre-capture timer with \(interval)s interval")

        // Capture immediately on start
        Task { @MainActor [weak self] in
            await self?.captureAndCacheScreenshot()
        }

        screenshotTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [self] in
                await self.captureAndCacheScreenshot()
            }
        }
    }

    private func stopScreenshotTimer() {
        screenshotTimer?.invalidate()
        screenshotTimer = nil
    }
}

// MARK: - SCStreamDelegate

extension ScreenCaptureService: SCStreamDelegate {
    nonisolated func stream(_ stream: SCStream, didStopWithError error: Error) {
        Task { @MainActor in
            self.isCapturing = false
            self.errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Stream Output Handler

private class StreamOutput: NSObject, SCStreamOutput {
    var onFrame: ((CMSampleBuffer) -> Void)?
    var onAudio: ((CMSampleBuffer) -> Void)?

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        switch type {
        case .screen:
            onFrame?(sampleBuffer)
        case .audio:
            onAudio?(sampleBuffer)
        @unknown default:
            break
        }
    }
}
