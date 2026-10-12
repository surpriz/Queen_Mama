//
//  OverlayStatePill.swift
//  QueenMama
//
//  One capsule that sums up the session state in the overlay header.
//  Leaf view: it observes the services itself so their frequent publishes
//  never re-render the whole header.
//

import SwiftUI

struct OverlayStatePill: View {
    let isSessionActive: Bool
    let isFinalizingSession: Bool
    let detectedMoment: MomentDetectionService.DetectedMoment?
    let isAutoAnswerEnabled: Bool
    let isSmartModeEnabled: Bool
    let sessionDuration: TimeInterval
    @ObservedObject var transcriptionService: TranscriptionService
    @ObservedObject var systemAudioService: SystemAudioCaptureService
    @ObservedObject var preGenerationService: PreGenerationService
    let onRetryConnection: () -> Void
    let onTap: () -> Void

    @ObservedObject private var config = ConfigurationManager.shared
    @State private var isPulsing = false

    private enum Primary {
        case connection
        case summarizing
        case micOnly
        case moment(MomentDetectionService.DetectedMoment)
        case answerReady
        case listening
        case idle
    }

    private var primary: Primary {
        if isSessionActive {
            switch transcriptionService.connectionState {
            case .reconnecting, .failed: return .connection
            default: break
            }
        }
        if isFinalizingSession { return .summarizing }
        guard isSessionActive else { return .idle }
        if sessionDuration > 5,
           !(transcriptionService.isSystemAudioConnected && systemAudioService.isReceivingAudio) {
            return .micOnly
        }
        if let moment = detectedMoment { return .moment(moment) }
        if case .ready = preGenerationService.state { return .answerReady }
        return .listening
    }

    var body: some View {
        switch primary {
        case .connection:
            TranscriptionConnectionBanner(
                transcriptionService: transcriptionService,
                onRetry: onRetryConnection
            )
        case .summarizing:
            capsule(color: QMDesign.Colors.accent, label: String(localized: "overlay.summarizing")) {
                ProgressView()
                    .scaleEffect(0.5)
                    .frame(width: 10, height: 10)
            }
        case .micOnly:
            capsule(color: QMDesign.Colors.warning, label: String(localized: "overlay.status.micOnly")) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 9, weight: .semibold))
            }
            .help(String(localized: "overlay.tooltip.systemAudioDown"))
        case .moment(let moment):
            let color = Color(red: moment.type.color.red, green: moment.type.color.green, blue: moment.type.color.blue)
            capsule(color: color, label: moment.type.label) {
                Image(systemName: moment.type.icon)
                    .font(.system(size: 9, weight: .semibold))
            }
            .help(String(localized: "overlay.tooltip.proactiveDetected \(moment.type.label)"))
        case .answerReady:
            capsule(color: QMDesign.Colors.success, label: String(localized: "overlay.status.answerReady")) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 9, weight: .semibold))
            }
            .help(String(localized: "overlay.tooltip.preGenReady"))
        case .listening:
            capsule(color: QMDesign.Colors.accent, label: String(localized: "overlay.status.listening")) {
                Circle()
                    .fill(QMDesign.Colors.accent)
                    .frame(width: 6, height: 6)
                    .scaleEffect(isPulsing ? 1.3 : 1.0)
                    .opacity(isPulsing ? 0.5 : 1.0)
                    .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isPulsing)
                    .onAppear { isPulsing = true }
                    .onDisappear { isPulsing = false }
            }
        case .idle:
            capsule(color: QMDesign.Colors.textTertiary, label: String(localized: "overlay.status.idle")) {
                Circle()
                    .fill(QMDesign.Colors.textTertiary)
                    .frame(width: 6, height: 6)
            }
        }
    }

    /// Capsule with a leading glyph, the label, then one dot per active modifier (stealth, smart, auto).
    private func capsule<Glyph: View>(color: Color, label: String, @ViewBuilder glyph: () -> Glyph) -> some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                glyph()
                Text(label)
                    .font(.system(size: 9, weight: .medium))
                    .lineLimit(1)
                modifierDots
            }
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(0.18)))
            .foregroundColor(color)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .help(modifiersHelp)
    }

    @ViewBuilder
    private var modifierDots: some View {
        let dots = activeModifiers
        if !dots.isEmpty {
            HStack(spacing: 3) {
                ForEach(dots, id: \.label) { dot in
                    Circle()
                        .fill(dot.color)
                        .frame(width: 5, height: 5)
                }
            }
            .padding(.leading, 2)
        }
    }

    private var activeModifiers: [(label: String, color: Color)] {
        var result: [(String, Color)] = []
        if config.isUndetectabilityEnabled {
            result.append((String(localized: "overlay.status.hidden"), QMDesign.Colors.success))
        }
        if isSmartModeEnabled {
            result.append((String(localized: "overlay.status.smart"), QMDesign.Colors.accent))
        }
        if isAutoAnswerEnabled {
            result.append((String(localized: "overlay.status.auto"), QMDesign.Colors.autoAnswer))
        }
        return result.map { (label: $0.0, color: $0.1) }
    }

    private var modifiersHelp: String {
        let base = String(localized: "overlay.pill.tooltip")
        let names = activeModifiers.map(\.label)
        return names.isEmpty ? base : base + " · " + names.joined(separator: ", ")
    }
}
