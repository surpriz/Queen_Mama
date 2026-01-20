//
//  LiveSessionView.swift
//  QueenMama
//
//  Modern live session view with gradient accents and improved UX
//

import SwiftUI

struct LiveSessionView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager

    var body: some View {
        VStack(spacing: 0) {
            if appState.isSessionActive {
                // Active Session View
                HSplitView {
                    // Left: Live Transcript
                    ModernLiveTranscriptPanel(
                        transcript: appState.currentTranscript,
                        interimText: appState.transcriptionService.interimTranscript
                    )

                    // Right: AI Responses
                    ModernAIResponsePanel(aiService: appState.aiService)
                }
            } else {
                // No Active Session
                ModernNoSessionView()
            }
        }
        .background(QMDesign.Colors.backgroundPrimary)
    }
}

// MARK: - Modern Live Transcript Panel

struct ModernLiveTranscriptPanel: View {
    let transcript: String
    let interimText: String

    @State private var autoScroll = true
    @State private var isHeaderHovered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Modern Header
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon with gradient background
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 32, height: 32)
                    Image(systemName: "text.quote")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Live Transcript")
                        .font(QMDesign.Typography.headline)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Text("\(wordCount) words")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                // Auto-scroll toggle
                HStack(spacing: QMDesign.Spacing.xs) {
                    Text("Auto-scroll")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                    Toggle("", isOn: $autoScroll)
                        .toggleStyle(.switch)
                        .controlSize(.small)
                        .tint(QMDesign.Colors.accent)
                }

                // Copy button
                Button(action: copyTranscript) {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 14))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                }
                .buttonStyle(.plain)
                .help("Copy transcript")
            }
            .padding(QMDesign.Spacing.md)
            .background(
                Rectangle()
                    .fill(QMDesign.Colors.surfaceLight)
                    .overlay(
                        Rectangle()
                            .fill(QMDesign.Colors.primaryGradient)
                            .frame(height: 2),
                        alignment: .bottom
                    )
            )

            // Transcript Content
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                        if transcript.isEmpty && interimText.isEmpty {
                            // Empty state
                            VStack(spacing: QMDesign.Spacing.md) {
                                Image(systemName: "waveform")
                                    .font(.system(size: 40))
                                    .foregroundStyle(QMDesign.Colors.primaryGradient.opacity(0.5))

                                Text("Waiting for speech...")
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textTertiary)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .padding(QMDesign.Spacing.xl)
                        } else {
                            // Confirmed transcript
                            Text(transcript)
                                .font(QMDesign.Typography.bodyMedium)
                                .foregroundColor(QMDesign.Colors.textPrimary)
                                .textSelection(.enabled)

                            // Interim text with pulse animation
                            if !interimText.isEmpty {
                                HStack(alignment: .top, spacing: QMDesign.Spacing.xs) {
                                    Circle()
                                        .fill(QMDesign.Colors.accent)
                                        .frame(width: 8, height: 8)
                                        .modifier(PulseModifier())

                                    Text(interimText)
                                        .font(QMDesign.Typography.bodyMedium)
                                        .foregroundColor(QMDesign.Colors.textSecondary)
                                        .italic()
                                }
                                .padding(QMDesign.Spacing.sm)
                                .background(
                                    RoundedRectangle(cornerRadius: QMDesign.Radius.sm)
                                        .fill(QMDesign.Colors.accent.opacity(0.05))
                                )
                            }
                        }

                        Color.clear
                            .frame(height: 1)
                            .id("bottom")
                    }
                    .padding(QMDesign.Spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .onChange(of: transcript) {
                    if autoScroll {
                        withAnimation(QMDesign.Animation.smooth) {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                }
            }
        }
        .frame(minWidth: 300)
        .background(QMDesign.Colors.backgroundPrimary)
    }

    private var wordCount: Int {
        transcript.split(separator: " ").count
    }

    private func copyTranscript() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(transcript, forType: .string)
    }
}

// MARK: - Pulse Modifier

struct PulseModifier: ViewModifier {
    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing ? 1.2 : 1.0)
            .opacity(isPulsing ? 0.7 : 1.0)
            .animation(
                Animation.easeInOut(duration: 0.8)
                    .repeatForever(autoreverses: true),
                value: isPulsing
            )
            .onAppear { isPulsing = true }
    }
}

// MARK: - Modern AI Response Panel

struct ModernAIResponsePanel: View {
    @ObservedObject var aiService: AIService

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Modern Header
            HStack(spacing: QMDesign.Spacing.sm) {
                // Icon with gradient background
                ZStack {
                    Circle()
                        .fill(QMDesign.Colors.primaryGradient)
                        .frame(width: 32, height: 32)
                    Image(systemName: "sparkles")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("AI Assistant")
                        .font(QMDesign.Typography.headline)
                        .foregroundColor(QMDesign.Colors.textPrimary)

                    Text("\(aiService.responses.count) responses")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textTertiary)
                }

                Spacer()

                // Provider badge
                if let provider = aiService.lastProvider {
                    AIProviderStatusBadge(provider: provider)
                }

                // Clear button
                Button(action: { aiService.clearHistory() }) {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(QMDesign.Colors.surfaceLight)
                        )
                }
                .buttonStyle(.plain)
                .help("Clear responses")
            }
            .padding(QMDesign.Spacing.md)
            .background(
                Rectangle()
                    .fill(QMDesign.Colors.surfaceLight)
                    .overlay(
                        Rectangle()
                            .fill(QMDesign.Colors.primaryGradient)
                            .frame(height: 2),
                        alignment: .bottom
                    )
            )

            // Responses
            ScrollView {
                LazyVStack(alignment: .leading, spacing: QMDesign.Spacing.md) {
                    // Current streaming response
                    if aiService.isProcessing || !aiService.currentResponse.isEmpty {
                        ModernResponseBubble(
                            type: .assist,
                            content: aiService.currentResponse,
                            isProcessing: aiService.isProcessing,
                            provider: aiService.lastProvider
                        )
                    }

                    // Historical responses
                    ForEach(aiService.responses) { response in
                        ModernResponseBubble(
                            type: response.type,
                            content: response.content,
                            isProcessing: false,
                            provider: response.provider
                        )
                    }

                    // Empty state
                    if !aiService.isProcessing && aiService.currentResponse.isEmpty && aiService.responses.isEmpty {
                        VStack(spacing: QMDesign.Spacing.md) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 40))
                                .foregroundStyle(QMDesign.Colors.primaryGradient.opacity(0.5))

                            Text("No responses yet")
                                .font(QMDesign.Typography.bodyMedium)
                                .foregroundColor(QMDesign.Colors.textTertiary)

                            Text("Use the overlay widget to request AI assistance")
                                .font(QMDesign.Typography.caption)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(QMDesign.Spacing.xl)
                    }
                }
                .padding(QMDesign.Spacing.md)
            }
        }
        .frame(minWidth: 300)
        .background(QMDesign.Colors.backgroundPrimary)
    }
}

// MARK: - AI Provider Status Badge

struct AIProviderStatusBadge: View {
    let provider: AIProviderType

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(providerColor)
                .frame(width: 6, height: 6)
            Text(provider.displayName)
                .font(QMDesign.Typography.captionSmall)
                .foregroundColor(QMDesign.Colors.textSecondary)
        }
        .padding(.horizontal, QMDesign.Spacing.sm)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(QMDesign.Colors.surfaceLight)
        )
    }

    private var providerColor: Color {
        switch provider {
        case .anthropic: return Color.orange
        case .grok: return Color.purple
        case .openai: return Color.green
        case .gemini: return Color.blue
        }
    }
}

// MARK: - Modern Response Bubble

struct ModernResponseBubble: View {
    let type: AIResponse.ResponseType
    let content: String
    let isProcessing: Bool
    let provider: AIProviderType?

    @State private var isHovered = false

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
            // Header
            HStack(spacing: QMDesign.Spacing.sm) {
                // Type icon
                Image(systemName: type.icon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)

                Text(type.rawValue)
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Spacer()

                // Processing indicator
                if isProcessing {
                    HStack(spacing: 4) {
                        ForEach(0..<3, id: \.self) { index in
                            Circle()
                                .fill(QMDesign.Colors.accent)
                                .frame(width: 6, height: 6)
                                .scaleEffect(isProcessing ? 1.0 : 0.5)
                                .animation(
                                    Animation.easeInOut(duration: 0.4)
                                        .repeatForever()
                                        .delay(Double(index) * 0.15),
                                    value: isProcessing
                                )
                        }
                    }
                }

                // Copy button on hover
                if isHovered && !content.isEmpty {
                    Button(action: copyContent) {
                        Image(systemName: "doc.on.doc")
                            .font(.system(size: 11))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                    }
                    .buttonStyle(.plain)
                    .transition(.opacity)
                }
            }

            // Content
            if content.isEmpty && isProcessing {
                Text("Generating response...")
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
                    .italic()
            } else {
                Text(content)
                    .font(QMDesign.Typography.bodySmall)
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .textSelection(.enabled)
            }
        }
        .padding(QMDesign.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .stroke(
                            isHovered ? QMDesign.Colors.accent.opacity(0.3) : QMDesign.Colors.borderSubtle,
                            lineWidth: 1
                        )
                )
        )
        .overlay(
            // Gradient accent on left
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.primaryGradient)
                .frame(width: 3)
                .padding(.vertical, 4),
            alignment: .leading
        )
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.quick, value: isHovered)
    }

    private func copyContent() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(content, forType: .string)
    }
}

// MARK: - Modern No Session View

struct ModernNoSessionView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager

    @State private var isButtonHovered = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            // Hero Icon
            ZStack {
                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.1))
                    .frame(width: 120, height: 120)

                Circle()
                    .fill(QMDesign.Colors.primaryGradient.opacity(0.2))
                    .frame(width: 80, height: 80)

                Image(systemName: "waveform.circle")
                    .font(.system(size: 48))
                    .foregroundStyle(QMDesign.Colors.primaryGradient)
            }

            // Text Content
            VStack(spacing: QMDesign.Spacing.sm) {
                Text("No Active Session")
                    .font(QMDesign.Typography.titleMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("Start a session to begin real-time transcription\nand AI-powered assistance")
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Start Button
            Button(action: startSession) {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Start Session")
                        .font(QMDesign.Typography.labelMedium)
                }
                .padding(.horizontal, QMDesign.Spacing.xl)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(
                    Capsule()
                        .fill(QMDesign.Colors.primaryGradient)
                )
                .foregroundColor(.white)
                .scaleEffect(isButtonHovered ? 1.05 : 1.0)
                .shadow(
                    color: QMDesign.Colors.accent.opacity(isButtonHovered ? 0.4 : 0.2),
                    radius: isButtonHovered ? 16 : 8,
                    y: isButtonHovered ? 8 : 4
                )
            }
            .buttonStyle(.plain)
            .onHover { isButtonHovered = $0 }
            .animation(QMDesign.Animation.smooth, value: isButtonHovered)

            // Keyboard shortcut hint
            KeyboardShortcutBadge(shortcut: "Cmd+Shift+S", size: .medium)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QMDesign.Colors.backgroundPrimary)
    }

    private func startSession() {
        Task {
            await appState.startSession()
            OverlayWindowController.shared.showOverlay(
                appState: appState,
                sessionManager: sessionManager
            )
        }
    }
}

// MARK: - Legacy Support

typealias LiveTranscriptPanel = ModernLiveTranscriptPanel
typealias AIResponsePanel = ModernAIResponsePanel
typealias ResponseBubble = ModernResponseBubble
typealias NoSessionView = ModernNoSessionView
