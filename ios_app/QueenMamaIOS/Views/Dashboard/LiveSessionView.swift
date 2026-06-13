import SwiftUI

struct LiveSessionView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if appState.isSessionActive {
                    ActiveSessionView()
                } else {
                    NoActiveSessionView()
                }
            }
            .background(QMDesign.Colors.backgroundPrimary)
            .navigationTitle("Live Session")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    if appState.isSessionActive {
                        HStack(spacing: QMDesign.Spacing.sm) {
                            // Show overlay button
                            Button {
                                appState.showOverlaySheet = true
                            } label: {
                                Image(systemName: "sparkles")
                                    .foregroundStyle(QMDesign.Colors.primaryGradient)
                            }
                            .accessibilityLabel("AI Assist")

                            // Stop button
                            Button {
                                Task { await appState.stopSession() }
                            } label: {
                                Image(systemName: "stop.circle.fill")
                                    .foregroundColor(QMDesign.Colors.error)
                            }
                            .accessibilityLabel("Stop session")
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Active Session View

struct ActiveSessionView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager
    @ObservedObject private var config = ConfigurationManager.shared
    @ObservedObject private var licenseManager = LicenseManager.shared

    @State private var autoScroll = true
    @State private var showingAI = false

    /// Live translation is active when enabled in settings and licensed.
    /// When active, the transcript renders from SwiftData entries so each
    /// interlocutor line can show its translation underneath.
    private var translationActive: Bool {
        config.translationEnabled && licenseManager.isFeatureAvailable(.liveTranslation)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Session info bar
            HStack(spacing: QMDesign.Spacing.sm) {
                StatusIndicator(status: .active, size: 8)

                Text("Recording")
                    .font(QMDesign.Typography.labelSmall)
                    .foregroundColor(QMDesign.Colors.success)

                Spacer()

                // Audio level
                HStack(spacing: 4) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 10))
                        .foregroundColor(QMDesign.Colors.accent)
                    AudioLevelBar(level: appState.audioLevel)
                        .frame(width: 60, height: 8)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Microphone level")

                // Word count
                Text("\(appState.currentTranscript.split(separator: " ").count) words")
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(QMDesign.Colors.textTertiary)
            }
            .padding(.horizontal, QMDesign.Spacing.md)
            .padding(.vertical, QMDesign.Spacing.sm)
            .background(QMDesign.Colors.surfaceLight)

            // Transcript
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: QMDesign.Spacing.sm) {
                        if appState.currentTranscript.isEmpty && appState.interimTranscript.isEmpty {
                            VStack(spacing: QMDesign.Spacing.md) {
                                Image(systemName: "waveform")
                                    .font(.system(size: 40))
                                    .foregroundStyle(QMDesign.Colors.primaryGradient.opacity(0.5))
                                Text("Waiting for speech...")
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textTertiary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(QMDesign.Spacing.xl)
                        } else if translationActive {
                            // Observe updateTick so SwiftData @Relationship writes re-render.
                            let _ = appState.translationService.updateTick
                            ForEach(sessionManager.currentSession?.entries ?? []) { entry in
                                TranslatedTranscriptRow(entry: entry)
                                    .id(entry.id)
                            }

                            if !appState.interimTranscript.isEmpty {
                                Text(appState.interimTranscript)
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                                    .italic()
                            }
                        } else {
                            ForEach(Array(transcriptLines.enumerated()), id: \.offset) { _, line in
                                Text(line)
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textPrimary)
                                    .textSelection(.enabled)
                            }

                            // Interim text
                            if !appState.interimTranscript.isEmpty {
                                Text(appState.interimTranscript)
                                    .font(QMDesign.Typography.bodyMedium)
                                    .foregroundColor(QMDesign.Colors.textSecondary)
                                    .italic()
                            }
                        }

                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(QMDesign.Spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .onChange(of: appState.currentTranscript) {
                    if autoScroll {
                        withAnimation(QMDesign.Animation.smooth) {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                }
            }

            // Bottom action bar
            HStack(spacing: QMDesign.Spacing.md) {
                // AI Assist button
                Button {
                    appState.showOverlaySheet = true
                } label: {
                    HStack(spacing: QMDesign.Spacing.xs) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 14, weight: .semibold))
                        Text("AI Assist")
                            .font(QMDesign.Typography.labelMedium)
                    }
                    .padding(.horizontal, QMDesign.Spacing.lg)
                    .padding(.vertical, QMDesign.Spacing.sm)
                    .background(QMDesign.Colors.primaryGradient)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
                }

                Spacer()

                // Auto-scroll toggle
                Toggle(isOn: $autoScroll) {
                    Text("Auto-scroll")
                        .font(QMDesign.Typography.caption)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                }
                .toggleStyle(.switch)
                .tint(QMDesign.Colors.accent)
            }
            .padding(QMDesign.Spacing.md)
            .background(QMDesign.Colors.surfaceLight)
        }
    }

    private var transcriptLines: [String] {
        appState.currentTranscript
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
            .filter { !$0.isEmpty }
    }
}

// MARK: - Translated Transcript Row

/// Renders a transcript entry with its translation underneath (mirrors macOS
/// TranslateEntryRow). Only interlocutor entries carry translations; "Moi" lines
/// simply show the original text.
struct TranslatedTranscriptRow: View {
    let entry: TranscriptEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // iOS transcript is a neutral stream (no reliable per-speaker labels
            // on a single mixed mic), so the speaker header is shown only if a
            // label is actually present. The target-language badge marks
            // translated lines.
            if !entry.speaker.isEmpty || entry.translationTargetLang != nil {
                HStack(spacing: 6) {
                    if !entry.speaker.isEmpty {
                        Text(entry.speaker)
                            .font(QMDesign.Typography.labelSmall)
                            .foregroundColor(entry.speaker == "Moi" ? QMDesign.Colors.accent : QMDesign.Colors.textSecondary)
                    }
                    if let lang = entry.translationTargetLang {
                        Text(lang)
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(QMDesign.Colors.accent)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(QMDesign.Colors.accent.opacity(0.15)))
                    }
                }
            }

            Text(entry.text)
                .font(QMDesign.Typography.bodyMedium)
                .foregroundColor(QMDesign.Colors.textPrimary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)

            // Show the translation whenever one is present, regardless of speaker.
            if let translated = entry.translatedText {
                HStack(alignment: .top, spacing: 4) {
                    Image(systemName: "arrow.turn.down.right")
                        .font(.system(size: 10))
                        .foregroundColor(QMDesign.Colors.textTertiary)
                    Text(translated)
                        .font(QMDesign.Typography.bodyMedium)
                        .italic()
                        .foregroundColor(QMDesign.Colors.textSecondary)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Audio Level Bar

struct AudioLevelBar: View {
    let level: Float

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(QMDesign.Colors.surfaceMedium)

                RoundedRectangle(cornerRadius: 4)
                    .fill(levelColor)
                    .frame(width: geometry.size.width * CGFloat(level))
                    .animation(.linear(duration: 0.1), value: level)
            }
        }
    }

    private var levelColor: Color {
        if level > 0.8 { return QMDesign.Colors.error }
        if level > 0.5 { return QMDesign.Colors.warning }
        return QMDesign.Colors.success
    }
}

// MARK: - No Active Session View

struct NoActiveSessionView: View {
    @EnvironmentObject var appState: AppState

    @State private var showingContactPicker = false
    @State private var selectedContact: Contact?

    var body: some View {
        VStack(spacing: QMDesign.Spacing.xl) {
            Spacer()

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

            VStack(spacing: QMDesign.Spacing.sm) {
                Text("No Active Session")
                    .font(QMDesign.Typography.titleMedium)
                    .foregroundColor(QMDesign.Colors.textPrimary)

                Text("Start a session to begin real-time\ntranscription and AI assistance")
                    .font(QMDesign.Typography.bodyMedium)
                    .foregroundColor(QMDesign.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Button { showingContactPicker = true } label: {
                HStack(spacing: QMDesign.Spacing.sm) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Start Session")
                        .font(QMDesign.Typography.labelMedium)
                }
                .padding(.horizontal, QMDesign.Spacing.xl)
                .padding(.vertical, QMDesign.Spacing.md)
                .background(QMDesign.Colors.primaryGradient)
                .foregroundColor(.white)
                .clipShape(Capsule())
                .shadow(color: QMDesign.Colors.accent.opacity(0.3), radius: 12, y: 4)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(QMDesign.Colors.backgroundPrimary)
        .sheet(isPresented: $showingContactPicker) {
            ContactPickerSheet(selectedContact: $selectedContact) { contact in
                Task {
                    await appState.startSession(contact: contact)
                }
            }
        }
    }
}
