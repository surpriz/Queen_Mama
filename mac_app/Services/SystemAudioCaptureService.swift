import Foundation
@preconcurrency import AVFoundation
import CoreMedia

/// Service to capture and process system audio from ScreenCaptureKit.
/// Converts CMSampleBuffer (48kHz stereo Float32) to 16kHz mono PCM16 for Deepgram transcription.
@MainActor
final class SystemAudioCaptureService: ObservableObject {
    // MARK: - Published Properties

    @Published var systemAudioLevel: Float = 0.0

    // MARK: - Callbacks

    var onAudioBuffer: ((Data) -> Void)?

    // MARK: - Private Properties

    // Target format for Deepgram (16kHz, mono, 16-bit PCM)
    private let targetSampleRate: Double = 16000
    private let targetChannelCount: AVAudioChannelCount = 1

    private var audioConverter: AVAudioConverter?
    private var inputFormat: AVAudioFormat?
    private var outputFormat: AVAudioFormat?
    private var bufferCount = 0

    // MARK: - Initialization

    init() {
        // Create output format for Deepgram (16kHz mono Float32 for conversion)
        outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: targetSampleRate,
            channels: targetChannelCount,
            interleaved: false
        )
    }

    // MARK: - Public Methods

    /// Process system audio buffer from ScreenCaptureKit.
    /// Called by ScreenCaptureService when audio frames arrive.
    func processSystemAudioBuffer(_ sampleBuffer: CMSampleBuffer) {
        // Log first few buffers to confirm audio is being received
        if bufferCount < 3 {
            print("[SystemAudio] Received system audio buffer #\(bufferCount)")
        }

        // 1. Get format description from sample buffer
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer) else {
            if bufferCount % 100 == 0 {
                print("[SystemAudio] No format description in sample buffer")
            }
            return
        }

        // 2. Get Audio Stream Basic Description
        guard let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription)?.pointee else {
            if bufferCount % 100 == 0 {
                print("[SystemAudio] Could not get ASBD from format description")
            }
            return
        }

        bufferCount += 1

        // 3. Create or update converter if format changed
        if inputFormat == nil || inputFormat?.sampleRate != asbd.mSampleRate {
            setupConverter(asbd: asbd)
        }

        // 4. Extract audio data from CMSampleBuffer
        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else {
            return
        }

        var lengthAtOffset: Int = 0
        var totalLength: Int = 0
        var dataPointer: UnsafeMutablePointer<Int8>?

        let status = CMBlockBufferGetDataPointer(
            blockBuffer,
            atOffset: 0,
            lengthAtOffsetOut: &lengthAtOffset,
            totalLengthOut: &totalLength,
            dataPointerOut: &dataPointer
        )

        guard status == kCMBlockBufferNoErr, let dataPointer = dataPointer else {
            return
        }

        // 5. Convert to PCM buffer and process
        processAudioData(
            dataPointer: dataPointer,
            totalLength: totalLength,
            asbd: asbd
        )
    }

    /// Reset the service state
    func reset() {
        audioConverter = nil
        inputFormat = nil
        systemAudioLevel = 0.0
        bufferCount = 0
    }

    // MARK: - Private Methods

    private func setupConverter(asbd: AudioStreamBasicDescription) {
        // Create input format from ASBD
        inputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: asbd.mSampleRate,
            channels: AVAudioChannelCount(asbd.mChannelsPerFrame),
            interleaved: false
        )

        guard let inputFormat = inputFormat, let outputFormat = outputFormat else {
            print("[SystemAudio] Failed to create audio formats")
            return
        }

        audioConverter = AVAudioConverter(from: inputFormat, to: outputFormat)

        if audioConverter != nil {
            print("[SystemAudio] Created converter: \(asbd.mSampleRate)Hz \(asbd.mChannelsPerFrame)ch -> \(targetSampleRate)Hz \(targetChannelCount)ch")
        } else {
            print("[SystemAudio] Failed to create audio converter")
        }
    }

    private func processAudioData(
        dataPointer: UnsafeMutablePointer<Int8>,
        totalLength: Int,
        asbd: AudioStreamBasicDescription
    ) {
        guard let converter = audioConverter,
              let inputFormat = inputFormat,
              let outputFormat = outputFormat else {
            return
        }

        // Calculate frame count from data length
        let bytesPerFrame = Int(asbd.mBytesPerFrame)
        guard bytesPerFrame > 0 else { return }

        let frameCount = totalLength / bytesPerFrame

        // Create input buffer
        guard let inputBuffer = AVAudioPCMBuffer(
            pcmFormat: inputFormat,
            frameCapacity: AVAudioFrameCount(frameCount)
        ) else {
            return
        }

        inputBuffer.frameLength = AVAudioFrameCount(frameCount)

        // Copy data to input buffer
        // System audio from ScreenCaptureKit is typically interleaved Float32
        let floatPointer = UnsafeRawPointer(dataPointer).assumingMemoryBound(to: Float.self)
        let channelCount = Int(asbd.mChannelsPerFrame)
        let floatCount = totalLength / MemoryLayout<Float>.size

        // De-interleave stereo to non-interleaved format
        if channelCount == 2 && inputBuffer.floatChannelData != nil {
            let leftChannel = inputBuffer.floatChannelData![0]
            let rightChannel = inputBuffer.floatChannelData![1]

            for i in 0..<min(frameCount, floatCount / 2) {
                leftChannel[i] = floatPointer[i * 2]
                rightChannel[i] = floatPointer[i * 2 + 1]
            }
        } else if channelCount == 1 && inputBuffer.floatChannelData != nil {
            memcpy(inputBuffer.floatChannelData![0], floatPointer, min(totalLength, frameCount * MemoryLayout<Float>.size))
        }

        // Calculate audio level for visualization (use left channel or mono)
        updateAudioLevel(from: inputBuffer)

        // Calculate output frame count based on sample rate ratio
        let ratio = outputFormat.sampleRate / inputFormat.sampleRate
        let outputFrameCount = AVAudioFrameCount(Double(frameCount) * ratio)

        guard let convertedBuffer = AVAudioPCMBuffer(
            pcmFormat: outputFormat,
            frameCapacity: outputFrameCount
        ) else {
            return
        }

        var error: NSError?

        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            outStatus.pointee = .haveData
            return inputBuffer
        }

        converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)

        if let error = error {
            if bufferCount % 100 == 0 {
                print("[SystemAudio] Conversion error: \(error.localizedDescription)")
            }
            return
        }

        // Convert float buffer to 16-bit PCM for Deepgram
        guard let floatData = convertedBuffer.floatChannelData else { return }

        let outputFrameLength = Int(convertedBuffer.frameLength)
        var int16Data = [Int16](repeating: 0, count: outputFrameLength)

        for i in 0..<outputFrameLength {
            let sample = floatData[0][i]
            // Clamp and convert to Int16
            let clampedSample = max(-1.0, min(1.0, sample))
            int16Data[i] = Int16(clampedSample * Float(Int16.max))
        }

        let data = Data(bytes: &int16Data, count: outputFrameLength * 2)

        // Log progress periodically
        if bufferCount % 100 == 0 {
            print("[SystemAudio] Processed \(bufferCount) buffers, sending \(data.count) bytes")
        }

        // Send to transcription service
        if onAudioBuffer != nil {
            onAudioBuffer?(data)
        } else if bufferCount < 5 {
            print("[SystemAudio] WARNING: onAudioBuffer callback not set!")
        }
    }

    private func updateAudioLevel(from buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData else { return }

        let channelDataValue = channelData[0]
        let frameLength = Int(buffer.frameLength)

        var sum: Float = 0
        for i in 0..<frameLength {
            sum += channelDataValue[i] * channelDataValue[i]
        }

        let rms = sqrt(sum / Float(frameLength))
        let avgPower = 20 * log10(rms)
        let meterLevel = scalePower(avgPower)

        // Update on main thread
        DispatchQueue.main.async { [weak self] in
            self?.systemAudioLevel = meterLevel
        }
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
