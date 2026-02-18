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
            return "Microphone permission denied. Please enable in Settings."
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

    // MARK: - Initialization

    init() {}

    // MARK: - Permission Handling

    func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func checkMicrophonePermission() -> Bool {
        AVAudioApplication.shared.recordPermission == .granted
    }

    // MARK: - Capture Control

    func startCapture() async throws {
        guard !isCapturing else {
            print("[AudioCapture] Already capturing, skipping start")
            return
        }

        print("[AudioCapture] Starting capture...")

        // Check permission
        let permission = AVAudioApplication.shared.recordPermission
        print("[AudioCapture] Permission status: \(permission)")

        if permission == .granted {
            print("[AudioCapture] Microphone authorized")
        } else if permission == .undetermined {
            print("[AudioCapture] Requesting microphone permission...")
            let granted = await requestMicrophonePermission()
            guard granted else {
                print("[AudioCapture] Permission denied by user")
                throw AudioCaptureError.microphonePermissionDenied
            }
            print("[AudioCapture] Permission granted")
        } else {
            print("[AudioCapture] Permission denied")
            throw AudioCaptureError.microphonePermissionDenied
        }

        // iOS: Configure audio session (required before AVAudioEngine)
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement)
        try audioSession.setActive(true)

        // Setup audio engine
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

        // Deactivate audio session
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: - Private Methods

    private func setupAudioEngine() throws {
        let inputNode = audioEngine.inputNode
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
                return
            }

            // 3. Convert float buffer to 16-bit PCM for Deepgram
            guard let floatData = convertedBuffer.floatChannelData else { return }

            let outputFrameLength = Int(convertedBuffer.frameLength)
            guard outputFrameLength > 0 else {
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
                self.microphoneLevel = meterLevel
                self.audioBufferCount += 1
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
