//
//  ScreenContentAnalyzer.swift
//  QueenMama
//
//  Smart screenshot analysis using Vision framework to detect
//  whether screenshots contain useful content or should be skipped.
//
//  Phase 2 Optimization: Reduces AI costs by skipping video call faces-only screenshots
//

import Foundation
import Vision
import AppKit
import CoreImage

@MainActor
final class ScreenContentAnalyzer {
    // MARK: - Singleton

    static let shared = ScreenContentAnalyzer()

    // MARK: - Configuration

    /// Threshold for face coverage to consider "video call" (0.0 - 1.0)
    /// If faces cover > 60% of screen, likely a video call
    let faceSkipThreshold: Float = 0.60

    /// Minimum text ratio to include despite high face coverage (0.0 - 1.0)
    /// If text > 10%, there's likely shared content (slides, documents)
    let textIncludeThreshold: Float = 0.10

    /// Minimum entropy for non-empty screen (0.0 - 1.0)
    /// Below 0.15 suggests empty/uniform screen
    let entropySkipThreshold: Float = 0.15

    // MARK: - Types

    struct AnalysisResult {
        let shouldInclude: Bool
        let reason: SkipReason?
        let faceCoverage: Float      // 0.0 - 1.0, percentage of screen covered by faces
        let textRatio: Float         // 0.0 - 1.0, rough estimate of text presence
        let entropy: Float           // 0.0 - 1.0, image complexity/variation
        let analysisTimeMs: Int

        static let includeDefault = AnalysisResult(
            shouldInclude: true,
            reason: nil,
            faceCoverage: 0,
            textRatio: 0,
            entropy: 1.0,
            analysisTimeMs: 0
        )
    }

    enum SkipReason: String {
        case emptyScreen = "Empty or uniform screen"
        case videoCallFacesOnly = "Video call without shared content"
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Public Methods

    /// Full analysis using Vision framework (async, runs in background)
    /// Call this during pre-capture, not at trigger time
    func analyze(_ imageData: Data) async -> AnalysisResult {
        let startTime = CFAbsoluteTimeGetCurrent()

        guard let cgImage = createCGImage(from: imageData) else {
            print("[ScreenAnalyzer] Failed to create CGImage")
            return AnalysisResult(
                shouldInclude: true, // Default to include on error
                reason: nil,
                faceCoverage: 0,
                textRatio: 0,
                entropy: 1.0,
                analysisTimeMs: 0
            )
        }

        // Phase A: Quick entropy check (sync, fast)
        let entropy = calculateEntropy(cgImage)
        if entropy < entropySkipThreshold {
            let timeMs = Int((CFAbsoluteTimeGetCurrent() - startTime) * 1000)
            print("[ScreenAnalyzer] Quick check: entropy=\(String(format: "%.2f", entropy)) → SKIP (emptyScreen)")
            return AnalysisResult(
                shouldInclude: false,
                reason: .emptyScreen,
                faceCoverage: 0,
                textRatio: 0,
                entropy: entropy,
                analysisTimeMs: timeMs
            )
        }

        // Phase B & C: Face and text detection (async)
        async let faceResult = detectFaces(in: cgImage)
        async let textResult = detectText(in: cgImage)

        let faceCoverage = await faceResult
        let textRatio = await textResult

        let timeMs = Int((CFAbsoluteTimeGetCurrent() - startTime) * 1000)

        // Decision logic
        let (shouldInclude, reason) = makeDecision(
            faceCoverage: faceCoverage,
            textRatio: textRatio,
            entropy: entropy
        )

        print("[ScreenAnalyzer] Analysis: faces=\(Int(faceCoverage * 100))%, text=\(Int(textRatio * 100))%, entropy=\(String(format: "%.2f", entropy)) → \(shouldInclude ? "INCLUDE" : "SKIP (\(reason?.rawValue ?? "unknown"))")")

        return AnalysisResult(
            shouldInclude: shouldInclude,
            reason: reason,
            faceCoverage: faceCoverage,
            textRatio: textRatio,
            entropy: entropy,
            analysisTimeMs: timeMs
        )
    }

    /// Quick sync check - entropy only (use when you need immediate result)
    func analyzeQuick(_ imageData: Data) -> Bool {
        guard let cgImage = createCGImage(from: imageData) else {
            return true // Default to include on error
        }

        let entropy = calculateEntropy(cgImage)
        if entropy < entropySkipThreshold {
            print("[ScreenAnalyzer] Quick entropy check: \(String(format: "%.2f", entropy)) → SKIP")
            return false
        }
        return true
    }

    // MARK: - Private Methods

    private func createCGImage(from data: Data) -> CGImage? {
        guard let nsImage = NSImage(data: data),
              let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }
        return cgImage
    }

    /// Calculate image entropy (complexity/variation)
    /// Low entropy = uniform/empty screen, High entropy = varied content
    private func calculateEntropy(_ image: CGImage) -> Float {
        let width = image.width
        let height = image.height

        // Downsample for faster calculation
        let sampleSize = 64
        let scaledWidth = min(width, sampleSize)
        let scaledHeight = min(height, sampleSize)

        guard let context = CGContext(
            data: nil,
            width: scaledWidth,
            height: scaledHeight,
            bitsPerComponent: 8,
            bytesPerRow: scaledWidth * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return 1.0 // Default to high entropy on error
        }

        context.draw(image, in: CGRect(x: 0, y: 0, width: scaledWidth, height: scaledHeight))

        guard let data = context.data else {
            return 1.0
        }

        let pixels = data.assumingMemoryBound(to: UInt8.self)
        let totalPixels = scaledWidth * scaledHeight

        // Calculate histogram of grayscale values
        var histogram = [Int](repeating: 0, count: 256)

        for i in 0..<totalPixels {
            let offset = i * 4
            let r = Int(pixels[offset])
            let g = Int(pixels[offset + 1])
            let b = Int(pixels[offset + 2])
            let gray = (r + g + b) / 3
            histogram[gray] += 1
        }

        // Calculate Shannon entropy
        var entropy: Float = 0.0
        let totalFloat = Float(totalPixels)

        for count in histogram where count > 0 {
            let probability = Float(count) / totalFloat
            entropy -= probability * log2(probability)
        }

        // Normalize to 0-1 range (max entropy for 256 values is 8 bits)
        return entropy / 8.0
    }

    /// Detect faces using Vision framework
    private func detectFaces(in image: CGImage) async -> Float {
        return await withCheckedContinuation { continuation in
            let request = VNDetectFaceRectanglesRequest { request, error in
                guard error == nil,
                      let results = request.results as? [VNFaceObservation] else {
                    continuation.resume(returning: 0)
                    return
                }

                // Calculate total face coverage
                var totalFaceArea: Float = 0
                for face in results {
                    let faceArea = Float(face.boundingBox.width * face.boundingBox.height)
                    totalFaceArea += faceArea
                }

                // Cap at 1.0 (faces can overlap)
                let coverage = min(totalFaceArea, 1.0)
                continuation.resume(returning: coverage)
            }

            let handler = VNImageRequestHandler(cgImage: image, options: [:])
            do {
                try handler.perform([request])
            } catch {
                print("[ScreenAnalyzer] Face detection error: \(error)")
                continuation.resume(returning: 0)
            }
        }
    }

    /// Detect text presence using Vision framework
    private func detectText(in image: CGImage) async -> Float {
        return await withCheckedContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                guard error == nil,
                      let results = request.results as? [VNRecognizedTextObservation] else {
                    continuation.resume(returning: 0)
                    return
                }

                // Calculate approximate text coverage based on bounding boxes
                var totalTextArea: Float = 0
                for observation in results {
                    let textArea = Float(observation.boundingBox.width * observation.boundingBox.height)
                    totalTextArea += textArea
                }

                // Normalize and cap
                let textRatio = min(totalTextArea, 1.0)
                continuation.resume(returning: textRatio)
            }

            // Use fast recognition level for speed
            request.recognitionLevel = .fast
            request.usesLanguageCorrection = false

            let handler = VNImageRequestHandler(cgImage: image, options: [:])
            do {
                try handler.perform([request])
            } catch {
                print("[ScreenAnalyzer] Text detection error: \(error)")
                continuation.resume(returning: 0)
            }
        }
    }

    /// Make the final include/skip decision based on analysis results
    private func makeDecision(faceCoverage: Float, textRatio: Float, entropy: Float) -> (Bool, SkipReason?) {
        // Rule 1: Empty/uniform screen
        if entropy < entropySkipThreshold {
            return (false, .emptyScreen)
        }

        // Rule 2: High face coverage (video call)
        if faceCoverage > faceSkipThreshold {
            // But check for text (shared content)
            if textRatio > textIncludeThreshold {
                // Video call WITH slides/shared content → INCLUDE
                return (true, nil)
            }
            // Video call without shared content → SKIP
            return (false, .videoCallFacesOnly)
        }

        // Rule 3: Low face coverage (not a video call) → INCLUDE
        // Default: INCLUDE
        return (true, nil)
    }
}
