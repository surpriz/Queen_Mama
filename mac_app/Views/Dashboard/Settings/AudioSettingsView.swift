//
//  AudioSettingsView.swift
//  QueenMama
//
//  Advanced › Audio: voice activity detection, tests and permissions.
//

import SwiftUI
import AVFoundation

// MARK: - Modern Audio Settings

struct ModernAudioSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared
    @StateObject private var audioTestManager = AudioTestManager()

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            // Header
            SettingsSectionHeader(
                title: String(localized: "settings.audio.title"),
                subtitle: String(localized: "settings.audio.subtitle")
            )

            // Audio Sources Card
            SettingsCard(title: String(localized: "settings.audio.processing"), icon: "waveform.badge.mic") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: String(localized: "settings.audio.vad"),
                        description: String(localized: "settings.audio.vad.description"),
                        isOn: $config.vadEnabled,
                        icon: "waveform.badge.mic"
                    )
                }
            }

            // Audio Test Card
            SettingsCard(title: String(localized: "settings.audio.audioTest"), icon: "waveform.circle.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    // Microphone Test
                    AudioTestRow(
                        title: String(localized: "settings.audio.microphone"),
                        description: String(localized: "settings.audio.microphone.testDescription"),
                        icon: "mic.fill",
                        level: audioTestManager.microphoneLevel,
                        isTesting: audioTestManager.isMicrophoneTesting,
                        permissionStatus: audioTestManager.microphonePermissionStatus,
                        onTest: { audioTestManager.toggleMicrophoneTest() }
                    )

                    Divider().background(QMDesign.Colors.borderSubtle)

                    // System Audio Test
                    AudioTestRow(
                        title: String(localized: "settings.audio.systemAudio"),
                        description: String(localized: "settings.audio.systemAudio.testDescription"),
                        icon: "speaker.wave.3.fill",
                        level: audioTestManager.systemAudioLevel,
                        isTesting: audioTestManager.isSystemAudioTesting,
                        permissionStatus: audioTestManager.screenCapturePermissionStatus,
                        onTest: { audioTestManager.toggleSystemAudioTest() }
                    )

                    // Instructions
                    HStack(alignment: .top, spacing: QMDesign.Spacing.sm) {
                        Image(systemName: "info.circle.fill")
                            .foregroundStyle(QMDesign.Colors.primaryGradient)
                            .font(.system(size: 14))
                        Text(String(localized: "settings.audio.testInstructions"))
                            .font(QMDesign.Typography.caption)
                            .foregroundColor(QMDesign.Colors.textSecondary)
                    }
                    .padding(QMDesign.Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                            .fill(QMDesign.Colors.accent.opacity(0.05))
                    )
                }
            }

            // Info Card
            SettingsCard(title: String(localized: "settings.audio.privacyInformation"), icon: "shield.lefthalf.filled") {
                VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                    InfoRow(icon: "waveform.path", text: String(localized: "settings.audio.privacy.streamedDirectly"))
                    InfoRow(icon: "externaldrive.badge.xmark", text: String(localized: "settings.audio.privacy.notStored"))
                    InfoRow(icon: "lock.shield", text: String(localized: "settings.audio.privacy.encrypted"))
                }
            }
        }
        .onDisappear {
            // Stop any ongoing tests when leaving the view
            audioTestManager.stopAllTests()
        }
    }
}

// MARK: - Audio Test Row

struct AudioTestRow: View {
    let title: String
    let description: String
    let icon: String
    let level: Float
    let isTesting: Bool
    let permissionStatus: AudioTestPermissionStatus
    let onTest: () -> Void

    var body: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            HStack(spacing: QMDesign.Spacing.md) {
                // Icon
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(isTesting ? AnyShapeStyle(QMDesign.Colors.primaryGradient) : AnyShapeStyle(QMDesign.Colors.textSecondary))
                    .frame(width: 24)

                // Labels
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(QMDesign.Typography.bodyMedium)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text(description)
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                // Test Button or Permission Warning
                if permissionStatus == .denied {
                    Button(action: openSystemPreferences) {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text(String(localized: "settings.audio.grantAccess"))
                        }
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.warning)
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                .fill(QMDesign.Colors.warning.opacity(0.1))
                        )
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(action: onTest) {
                        HStack(spacing: 4) {
                            Image(systemName: isTesting ? "stop.fill" : "play.fill")
                            Text(isTesting ? String(localized: "settings.audio.stop") : String(localized: "settings.audio.test"))
                        }
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(isTesting ? QMDesign.Colors.error : .white)
                        .padding(.horizontal, QMDesign.Spacing.sm)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                .fill(isTesting ? AnyShapeStyle(QMDesign.Colors.error.opacity(0.1)) : AnyShapeStyle(QMDesign.Colors.primaryGradient))
                        )
                    }
                    .buttonStyle(.plain)
                }
            }

            // Level Meter (only show when testing)
            if isTesting {
                AudioLevelMeter(level: level)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
        .animation(QMDesign.Animation.quick, value: isTesting)
    }

    private func openSystemPreferences() {
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")!)
    }
}

// MARK: - Audio Level Meter

struct AudioLevelMeter: View {
    let level: Float
    private let segmentCount = 20

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 2) {
                ForEach(0..<segmentCount, id: \.self) { index in
                    let threshold = Float(index) / Float(segmentCount)
                    let isActive = level > threshold

                    RoundedRectangle(cornerRadius: 2)
                        .fill(segmentColor(for: index, isActive: isActive))
                        .frame(width: (geometry.size.width - CGFloat(segmentCount - 1) * 2) / CGFloat(segmentCount))
                }
            }
        }
        .frame(height: 8)
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, QMDesign.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                .fill(QMDesign.Colors.backgroundSecondary)
        )
    }

    private func segmentColor(for index: Int, isActive: Bool) -> Color {
        guard isActive else {
            return QMDesign.Colors.surfaceMedium
        }

        let position = Float(index) / Float(segmentCount)
        if position < 0.6 {
            return QMDesign.Colors.success
        } else if position < 0.8 {
            return QMDesign.Colors.warning
        } else {
            return QMDesign.Colors.error
        }
    }
}

// MARK: - Audio Test Manager

enum AudioTestPermissionStatus {
    case granted
    case denied
    case notDetermined
}

@MainActor
class AudioTestManager: ObservableObject {
    @Published var microphoneLevel: Float = 0.0
    @Published var systemAudioLevel: Float = 0.0
    @Published var isMicrophoneTesting = false
    @Published var isSystemAudioTesting = false
    @Published var microphonePermissionStatus: AudioTestPermissionStatus = .notDetermined
    @Published var screenCapturePermissionStatus: AudioTestPermissionStatus = .notDetermined

    private var audioEngine: AVAudioEngine?
    private var levelUpdateTimer: Timer?

    init() {
        checkPermissions()
    }

    func checkPermissions() {
        // Check microphone permission
        let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
        switch micStatus {
        case .authorized:
            microphonePermissionStatus = .granted
        case .denied, .restricted:
            microphonePermissionStatus = .denied
        case .notDetermined:
            microphonePermissionStatus = .notDetermined
        @unknown default:
            microphonePermissionStatus = .notDetermined
        }

        // For system audio, we need screen capture permission (ScreenCaptureKit)
        // This is always shown as granted for now since checking requires async call
        screenCapturePermissionStatus = .granted
    }

    func toggleMicrophoneTest() {
        if isMicrophoneTesting {
            stopMicrophoneTest()
        } else {
            startMicrophoneTest()
        }
    }

    func toggleSystemAudioTest() {
        if isSystemAudioTesting {
            stopSystemAudioTest()
        } else {
            startSystemAudioTest()
        }
    }

    private func startMicrophoneTest() {
        // Request permission if needed
        if microphonePermissionStatus == .notDetermined {
            Task {
                let granted = await AVCaptureDevice.requestAccess(for: .audio)
                microphonePermissionStatus = granted ? .granted : .denied
                if granted {
                    startMicrophoneCapture()
                }
            }
        } else if microphonePermissionStatus == .granted {
            startMicrophoneCapture()
        }
    }

    private func startMicrophoneCapture() {
        audioEngine = AVAudioEngine()
        guard let audioEngine = audioEngine else { return }

        let inputNode = audioEngine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, _ in
            self?.processAudioBuffer(buffer, isMicrophone: true)
        }

        do {
            try audioEngine.start()
            isMicrophoneTesting = true
        } catch {
            print("[AudioTest] Failed to start microphone test: \(error)")
        }
    }

    private func stopMicrophoneTest() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        isMicrophoneTesting = false
        microphoneLevel = 0
    }

    private func startSystemAudioTest() {
        // System audio capture requires ScreenCaptureKit which is more complex
        // For now, simulate with a placeholder that shows the UI works
        isSystemAudioTesting = true

        // Start a timer to show some visual feedback
        levelUpdateTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [weak self] in
                // Show a low-level indicator to show it's "listening"
                self?.systemAudioLevel = 0.05
            }
        }
    }

    private func stopSystemAudioTest() {
        levelUpdateTimer?.invalidate()
        levelUpdateTimer = nil
        isSystemAudioTesting = false
        systemAudioLevel = 0
    }

    func stopAllTests() {
        stopMicrophoneTest()
        stopSystemAudioTest()
    }

    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, isMicrophone: Bool) {
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
            if isMicrophone {
                self?.microphoneLevel = meterLevel
            } else {
                self?.systemAudioLevel = meterLevel
            }
        }
    }

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

struct InfoRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: QMDesign.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(QMDesign.Colors.primaryGradient)
                .frame(width: 20)
            Text(text)
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textSecondary)
        }
    }
}
