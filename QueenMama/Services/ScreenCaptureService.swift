import Foundation
import ScreenCaptureKit
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

        // Convert to JPEG data (compressed for API)
        guard let tiffData = nsImage.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let jpegData = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.7]) else {
            throw ScreenCaptureError.screenshotFailed
        }

        return jpegData
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
        let interval = config.screenCaptureIntervalSeconds
        screenshotTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                try? await self?.captureScreenshot()
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
        case .microphone:
            break
        @unknown default:
            break
        }
    }
}
