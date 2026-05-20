import Foundation
import AVFoundation
import Combine

enum AudioCaptureError: LocalizedError {
    case microphonePermissionDenied
    case microphoneNotAvailable
    case engineStartFailed(Error)
    case formatMismatch

    var errorDescription: String? {
        switch self {
        case .microphonePermissionDenied:
            return "Microphone permission denied. Please enable in System Settings."
        case .microphoneNotAvailable:
            return "No microphone available."
        case .engineStartFailed(let error):
            return "Failed to start audio engine: \(error.localizedDescription)"
        case .formatMismatch:
            return "Audio format mismatch."
        }
    }
}

@MainActor
final class AudioCaptureService: ObservableObject {
    // MARK: - Published Properties

    @Published var isCapturing = false
    @Published var microphoneLevel: Float = 0.0
    @Published var systemAudioLevel: Float = 0.0
    @Published var errorMessage: String?

    // MARK: - Callbacks

    var onAudioBuffer: ((Data) -> Void)?

    // MARK: - Private Properties

    private let audioEngine = AVAudioEngine()
    private var microphoneTap: AVAudioNodeTapBlock?
    private let config = ConfigurationManager.shared

    // Audio format for Deepgram (16kHz, mono, 16-bit PCM)
    private let targetSampleRate: Double = 16000
    private let targetChannelCount: AVAudioChannelCount = 1

    // nonisolated(unsafe): written once during setup, read from audio render thread
    nonisolated(unsafe) private var audioConverter: AVAudioConverter?

    // Rate-limit Sentry captures from audio tap (runs at high frequency).
    // Capture once per session lifetime to avoid event flooding.
    nonisolated(unsafe) private var conversionErrorCaptured = false

    // MARK: - Initialization

    init() {}

    // MARK: - Permission Handling

    func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func checkMicrophonePermission() -> AVAuthorizationStatus {
        AVCaptureDevice.authorizationStatus(for: .audio)
    }

    // MARK: - Capture Control

    func startCapture() async throws {
        guard !isCapturing else {
            print("[AudioCapture] Already capturing, skipping start")
            return
        }

        print("[AudioCapture] Starting capture...")

        // Check permission
        let status = checkMicrophonePermission()
        print("[AudioCapture] Permission status: \(status.rawValue)")

        switch status {
        case .authorized:
            print("[AudioCapture] Microphone authorized")
        case .notDetermined:
            print("[AudioCapture] Requesting microphone permission...")
            let granted = await requestMicrophonePermission()
            guard granted else {
                print("[AudioCapture] Permission denied by user")
                throw AudioCaptureError.microphonePermissionDenied
            }
            print("[AudioCapture] Permission granted")
        case .denied, .restricted:
            print("[AudioCapture] Permission denied or restricted")
            throw AudioCaptureError.microphonePermissionDenied
        @unknown default:
            throw AudioCaptureError.microphonePermissionDenied
        }

        // Pre-warm AVAudioEngine on background thread to avoid 2+ second
        // main thread hang from XPC call during inputNode hardware initialization
        // (Sentry: App Hanging QUEEN-MAMA-MACOS-K, 5 events, 3 users)
        print("[AudioCapture] Pre-warming audio engine on background thread...")
        let engine = audioEngine
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            DispatchQueue.global(qos: .userInitiated).async {
                _ = engine.inputNode  // Triggers AudioComponentMgr XPC call off main thread
                continuation.resume()
            }
        }

        // Setup audio engine (now fast since inputNode is already initialized)
        print("[AudioCapture] Setting up audio engine...")
        try setupAudioEngine()

        // Start engine
        do {
            try audioEngine.start()
            isCapturing = true
            errorMessage = nil
            print("[AudioCapture] Audio engine started successfully!")
        } catch {
            print("[AudioCapture] Failed to start engine: \(error)")
            throw AudioCaptureError.engineStartFailed(error)
        }
    }

    func stopCapture() {
        guard isCapturing else { return }

        audioEngine.inputNode.removeTap(onBus: 0)
        audioEngine.stop()
        isCapturing = false
        microphoneLevel = 0
        systemAudioLevel = 0
        conversionErrorCaptured = false
    }

    // MARK: - Private Methods

    private func setupAudioEngine() throws {
        // Invalidate converter before any format queries (format may change with AEC)
        audioConverter = nil

        let inputNode = audioEngine.inputNode

        // NOTE: Voice Processing (AEC) via setVoiceProcessingEnabled is DISABLED.
        // It conflicts with ScreenCaptureKit: AEC ducks the system audio output,
        // causing ScreenCaptureKit to capture near-silence for the "Them" stream.
        // Speaker diarization works without AEC: mic captures user voice (+ some
        // speaker bleed), system audio captures remote participants cleanly.

        let inputFormat = inputNode.outputFormat(forBus: 0)

        print("[AudioCapture] Input format: \(inputFormat)")

        // First convert to float format at target sample rate
        guard let floatFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: targetSampleRate,
            channels: targetChannelCount,
            interleaved: false
        ) else {
            throw AudioCaptureError.formatMismatch
        }

        // Create converter to float format first
        audioConverter = AVAudioConverter(from: inputFormat, to: floatFormat)

        if audioConverter == nil {
            print("[AudioCapture] Failed to create audio converter")
            throw AudioCaptureError.formatMismatch
        }

        print("[AudioCapture] Audio converter created successfully")

        // Calculate buffer sizes - use larger buffer for stability
        let bufferSize: AVAudioFrameCount = 4096

        // Capture converter reference for use on audio thread
        let converter = audioConverter!

        // Install tap on input node
        // IMPORTANT: All audio processing happens HERE on the audio render thread
        // to prevent buffer recycling issues (the AVAudioPCMBuffer may be reused
        // by the audio engine after this callback returns)
        inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, _ in
            // === Audio render thread - process immediately before buffer is recycled ===

            let inputFrameLength = buffer.frameLength
            guard inputFrameLength > 0 else { return }

            // 1. Calculate audio level for visualization
            let meterLevel: Float = {
                guard let channelData = buffer.floatChannelData else { return 0 }
                let channelDataValue = channelData.pointee
                let channelDataValueArray = stride(
                    from: 0,
                    to: Int(inputFrameLength),
                    by: buffer.stride
                ).map { channelDataValue[$0] }

                let rms = sqrt(channelDataValueArray.map { $0 * $0 }.reduce(0, +) / Float(inputFrameLength))
                let avgPower = 20 * log10(rms)

                // Scale from dB to 0-1 range
                let minDb: Float = -80
                let maxDb: Float = 0
                if avgPower < minDb { return 0 }
                else if avgPower >= maxDb { return 1 }
                else { return (avgPower - minDb) / (maxDb - minDb) }
            }()

            // 2. Convert to 16kHz Float32 using the pre-created converter
            let ratio = floatFormat.sampleRate / inputFormat.sampleRate
            let frameCount = AVAudioFrameCount(Double(inputFrameLength) * ratio)
            guard frameCount > 0 else { return }

            guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: floatFormat, frameCapacity: frameCount) else {
                return
            }

            // Reset converter state before each conversion - the inputBlock signals
            // .endOfStream after each buffer, which puts the converter in "stream ended"
            // state. Without reset, subsequent calls return .endOfStream with 0 output.
            converter.reset()

            var convError: NSError?
            var hasProvidedInput = false
            let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
                if hasProvidedInput {
                    outStatus.pointee = .endOfStream
                    return nil
                }
                hasProvidedInput = true
                outStatus.pointee = .haveData
                return buffer
            }

            let status = converter.convert(to: convertedBuffer, error: &convError, withInputFrom: inputBlock)

            if let convError {
                print("[AudioCapture] Conversion error: \(convError.localizedDescription)")
                if !(self?.conversionErrorCaptured ?? true) {
                    self?.conversionErrorCaptured = true
                    Task { @MainActor in
                        CrashReporter.shared.captureError(convError, extras: [
                            "service": "audio",
                            "operation": "tap_convert",
                            "input_sample_rate": inputFormat.sampleRate,
                            "target_sample_rate": floatFormat.sampleRate
                        ])
                    }
                }
                return
            }

            // 3. Convert float buffer to 16-bit PCM for Deepgram
            guard let floatData = convertedBuffer.floatChannelData else { return }

            let outputFrameLength = Int(convertedBuffer.frameLength)
            guard outputFrameLength > 0 else {
                // Diagnostic: log when conversion produces 0 frames
                if status != .haveData {
                    print("[AudioCapture] Converter status: \(status.rawValue), input frames: \(inputFrameLength), output: 0")
                }
                return
            }

            var int16Data = [Int16](repeating: 0, count: outputFrameLength)
            for i in 0..<outputFrameLength {
                let sample = floatData[0][i]
                let clampedSample = max(-1.0, min(1.0, sample))
                int16Data[i] = Int16(clampedSample * Float(Int16.max))
            }

            let data = Data(bytes: &int16Data, count: outputFrameLength * 2)

            // === Dispatch results to main thread ===
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.audioBufferCount += 1
                // Update microphoneLevel only every 5 buffers (~500ms) to reduce
                // main thread property updates by 80%. The audio data callback
                // still fires every buffer for transcription accuracy.
                if self.audioBufferCount % 5 == 0 {
                    self.microphoneLevel = meterLevel
                }
                if self.audioBufferCount % 100 == 0 {
                    print("[AudioCapture] Processed \(self.audioBufferCount) buffers, sending \(data.count) bytes")
                }
                self.onAudioBuffer?(data)
            }
        }

        print("[AudioCapture] Tap installed on input node")
    }

    private var audioBufferCount = 0

    private func scalePower(_ power: Float) -> Float {
        // Scale from dB to 0-1 range
        let minDb: Float = -80
        let maxDb: Float = 0

        if power < minDb {
            return 0
        } else if power >= maxDb {
            return 1
        } else {
            return (power - minDb) / (maxDb - minDb)
        }
    }
}

// MARK: - System Audio Capture (macOS 14.2+)

extension AudioCaptureService {
    // Note: System audio capture requires ScreenCaptureKit and
    // is handled separately in ScreenCaptureService for macOS 14.2+
    // This extension is a placeholder for future integration
}
