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
                    LiveTranscriptPanel(
                        transcript: appState.currentTranscript,
                        interimText: appState.transcriptionService.interimTranscript
                    )

                    // Right: AI Responses
                    AIResponsePanel(aiService: appState.aiService)
                }
            } else {
                // No Active Session
                NoSessionView()
            }
        }
    }
}

// MARK: - Live Transcript Panel

struct LiveTranscriptPanel: View {
    let transcript: String
    let interimText: String

    @State private var autoScroll = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Label("Live Transcript", systemImage: "text.quote")
                    .font(.headline)

                Spacer()

                Toggle("Auto-scroll", isOn: $autoScroll)
                    .toggleStyle(.switch)
                    .controlSize(.small)

                Button(action: copyTranscript) {
                    Image(systemName: "doc.on.doc")
                }
                .buttonStyle(.plain)
                .help("Copy transcript")
            }
            .padding()
            .background(Color.gray.opacity(0.1))

            // Transcript Content
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(transcript)
                            .font(.body)
                            .textSelection(.enabled)

                        if !interimText.isEmpty {
                            Text(interimText)
                                .font(.body)
                                .foregroundColor(.secondary)
                                .italic()
                        }

                        Color.clear
                            .frame(height: 1)
                            .id("bottom")
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .onChange(of: transcript) {
                    if autoScroll {
                        withAnimation {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                }
            }
        }
        .frame(minWidth: 300)
    }

    private func copyTranscript() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(transcript, forType: .string)
    }
}

// MARK: - AI Response Panel

struct AIResponsePanel: View {
    @ObservedObject var aiService: AIService

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Label("AI Assistant", systemImage: "sparkles")
                    .font(.headline)

                Spacer()

                if let provider = aiService.lastProvider {
                    Text(provider.displayName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.gray.opacity(0.2))
                        .clipShape(Capsule())
                }

                Button(action: { aiService.clearResponses() }) {
                    Image(systemName: "trash")
                }
                .buttonStyle(.plain)
                .help("Clear responses")
            }
            .padding()
            .background(Color.gray.opacity(0.1))

            // Responses
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    // Current streaming response
                    if aiService.isProcessing || !aiService.currentResponse.isEmpty {
                        ResponseBubble(
                            type: .assist,
                            content: aiService.currentResponse,
                            isProcessing: aiService.isProcessing,
                            provider: aiService.lastProvider
                        )
                    }

                    // Historical responses
                    ForEach(aiService.responses) { response in
                        ResponseBubble(
                            type: response.type,
                            content: response.content,
                            isProcessing: false,
                            provider: response.provider
                        )
                    }
                }
                .padding()
            }
        }
        .frame(minWidth: 300)
    }
}

// MARK: - Response Bubble

struct ResponseBubble: View {
    let type: AIResponse.ResponseType
    let content: String
    let isProcessing: Bool
    let provider: AIProviderType?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: type.icon)
                    .foregroundColor(.blue)
                Text(type.rawValue)
                    .font(.caption)
                    .fontWeight(.semibold)

                Spacer()

                if isProcessing {
                    ProgressView()
                        .scaleEffect(0.7)
                }
            }

            // Content
            if content.isEmpty && isProcessing {
                Text("Thinking...")
                    .foregroundColor(.secondary)
                    .italic()
            } else {
                Text(content)
                    .textSelection(.enabled)
            }
        }
        .padding()
        .background(Color.blue.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - No Session View

struct NoSessionView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sessionManager: SessionManager

    var body: some View {
        ContentUnavailableView {
            Label("No Active Session", systemImage: "waveform.slash")
        } description: {
            Text("Start a session to begin real-time transcription and AI assistance.")
        } actions: {
            Button(action: {
                Task {
                    await appState.startSession()
                    OverlayWindowController.shared.showOverlay(
                        appState: appState,
                        sessionManager: sessionManager
                    )
                }
            }) {
                Label("Start Session", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
        }
    }
}
