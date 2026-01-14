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
        guard !isCapturing else { return }

        // Check permission
        let status = checkMicrophonePermission()
        switch status {
        case .authorized:
            break
        case .notDetermined:
            let granted = await requestMicrophonePermission()
            guard granted else {
                throw AudioCaptureError.microphonePermissionDenied
            }
        case .denied, .restricted:
            throw AudioCaptureError.microphonePermissionDenied
        @unknown default:
            throw AudioCaptureError.microphonePermissionDenied
        }

        // Setup audio engine
        try setupAudioEngine()

        // Start engine
        do {
            try audioEngine.start()
            isCapturing = true
            errorMessage = nil
        } catch {
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

        // Target format for Deepgram
        guard let targetFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: targetSampleRate,
            channels: targetChannelCount,
            interleaved: true
        ) else {
            throw AudioCaptureError.formatMismatch
        }

        // Create converter
        audioConverter = AVAudioConverter(from: inputFormat, to: targetFormat)

        // Calculate buffer sizes
        let bufferSize: AVAudioFrameCount = 1024

        // Install tap on input node
        inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, _ in
            Task { @MainActor in
                self?.processAudioBuffer(buffer, inputFormat: inputFormat, targetFormat: targetFormat)
            }
        }
    }

    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, inputFormat: AVAudioFormat, targetFormat: AVAudioFormat) {
        // Calculate audio level for visualization
        updateAudioLevel(from: buffer)

        // Convert to target format
        guard let converter = audioConverter else { return }

        let frameCount = AVAudioFrameCount(Double(buffer.frameLength) * targetSampleRate / inputFormat.sampleRate)

        guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: frameCount) else {
            return
        }

        var error: NSError?
        var inputConsumed = false

        converter.convert(to: convertedBuffer, error: &error) { _, outStatus in
            if inputConsumed {
                outStatus.pointee = .noDataNow
                return nil
            }
            inputConsumed = true
            outStatus.pointee = .haveData
            return buffer
        }

        if let error {
            print("Audio conversion error: \(error)")
            return
        }

        // Convert to Data and send to callback
        if let channelData = convertedBuffer.int16ChannelData {
            let data = Data(bytes: channelData[0], count: Int(convertedBuffer.frameLength) * 2)
            onAudioBuffer?(data)
        }
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
