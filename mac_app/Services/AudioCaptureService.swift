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

    private var audioConverter: AVAudioConverter?
    private var convertedBuffer: AVAudioPCMBuffer?

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

        // Install tap on input node
        inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, _ in
            self?.processAudioBufferSync(buffer, inputFormat: inputFormat, floatFormat: floatFormat)
        }

        print("[AudioCapture] Tap installed on input node")
    }

    private var audioBufferCount = 0

    // Synchronous processing to avoid threading issues
    private func processAudioBufferSync(_ buffer: AVAudioPCMBuffer, inputFormat: AVAudioFormat, floatFormat: AVAudioFormat) {
        // Calculate audio level for visualization
        updateAudioLevelSync(from: buffer)

        audioBufferCount += 1

        // Convert to target format
        guard let converter = audioConverter else {
            return
        }

        // Calculate output frame count based on sample rate ratio
        let ratio = floatFormat.sampleRate / inputFormat.sampleRate
        let frameCount = AVAudioFrameCount(Double(buffer.frameLength) * ratio)

        guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: floatFormat, frameCapacity: frameCount) else {
            return
        }

        var error: NSError?

        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }

        converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)

        if let error {
            if audioBufferCount % 100 == 0 {
                print("[AudioCapture] Conversion error: \(error.localizedDescription)")
            }
            return
        }

        // Convert float buffer to 16-bit PCM for Deepgram
        guard let floatData = convertedBuffer.floatChannelData else { return }

        let frameLength = Int(convertedBuffer.frameLength)
        var int16Data = [Int16](repeating: 0, count: frameLength)

        for i in 0..<frameLength {
            let sample = floatData[0][i]
            // Clamp and convert to Int16
            let clampedSample = max(-1.0, min(1.0, sample))
            int16Data[i] = Int16(clampedSample * Float(Int16.max))
        }

        let data = Data(bytes: &int16Data, count: frameLength * 2)

        // Send on main thread
        DispatchQueue.main.async { [weak self] in
            if self?.audioBufferCount ?? 0 % 100 == 0 {
                print("[AudioCapture] Processed \(self?.audioBufferCount ?? 0) buffers, sending \(data.count) bytes")
            }
            self?.onAudioBuffer?(data)
        }
    }

    private func updateAudioLevelSync(from buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData else { return }

        let channelDataValue = channelData.pointee
        let channelDataValueArray = stride(
            from: 0,
            to: Int(buffer.frameLength),
            by: buffer.stride
        ).map { channelDataValue[$0] }

        let rms = sqrt(channelDataValueArray.map { $0 * $0 }.reduce(0, +) / Float(buffer.frameLength))
        let avgPower = 20 * log10(rms)
        let meterLevel = scalePower(avgPower)

        DispatchQueue.main.async { [weak self] in
            self?.microphoneLevel = meterLevel
        }
    }

    // Keep old method for compatibility but unused
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, inputFormat: AVAudioFormat, targetFormat: AVAudioFormat) {
        // Deprecated - use processAudioBufferSync instead
    }

    private func updateAudioLevel(from buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData else { return }

        let channelDataValue = channelData.pointee
        let channelDataValueArray = stride(
            from: 0,
            to: Int(buffer.frameLength),
            by: buffer.stride
        ).map { channelDataValue[$0] }

        let rms = sqrt(channelDataValueArray.map { $0 * $0 }.reduce(0, +) / Float(buffer.frameLength))
        let avgPower = 20 * log10(rms)
        let meterLevel = scalePower(avgPower)

        microphoneLevel = meterLevel
    }

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
