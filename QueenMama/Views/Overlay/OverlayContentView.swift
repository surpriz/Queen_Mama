import SwiftUI

struct OverlayContentView: View {
    @ObservedObject var appState: AppState
    @ObservedObject var sessionManager: SessionManager
    @ObservedObject var overlayController: OverlayWindowController

    @State private var inputText = ""
    @State private var selectedTab: TabItem = .assist
    @State private var isSmartModeEnabled = false
    @State private var lastScreenshotTime: Date?
    @State private var hasScreenshot = false

    var body: some View {
        VStack(spacing: 0) {
            // Pill Header
            PillHeaderView(
                isExpanded: overlayController.isExpanded,
                isSessionActive: appState.isSessionActive,
                onToggleExpand: { overlayController.toggleExpanded() },
                onHide: { overlayController.hideOverlay() },
                onStop: { Task { await appState.stopSession() } }
            )

            // Expanded Content
            if overlayController.isExpanded {
                ExpandedContentView(
                    appState: appState,
                    aiService: appState.aiService,
                    selectedTab: $selectedTab,
                    inputText: $inputText,
                    isSmartModeEnabled: $isSmartModeEnabled,
                    hasScreenshot: hasScreenshot,
                    lastScreenshotTime: lastScreenshotTime,
                    onSubmit: handleSubmit
                )
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OverlayBackground())
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: overlayController.isExpanded)
    }

    private func handleSubmit() {
        // Assist, Recap, and Follow-up don't require input text
        // What to Say can work with or without input
        let requiresInput = false  // All tabs can work without input using transcript
        if requiresInput && inputText.isEmpty {
            return
        }

        print("[Overlay] Submitting request for tab: \(selectedTab.rawValue)")

        Task {
            do {
                let screenshot = try? await appState.screenService.captureScreenshot()
                hasScreenshot = screenshot != nil
                if hasScreenshot {
                    lastScreenshotTime = Date()
                }

                switch selectedTab {
                case .assist:
                    for try await chunk in appState.aiService.assistStreaming(
                        transcript: appState.currentTranscript,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    ) {
                        // Response is updated automatically via AIService
                        _ = chunk
                    }
                case .whatToSay:
                    let response = try await appState.aiService.whatToSay(
                        transcript: appState.currentTranscript,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    )
                    appState.aiService.currentResponse = response.content
                case .followUp:
                    let response = try await appState.aiService.followUpQuestions(
                        transcript: appState.currentTranscript,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    )
                    appState.aiService.currentResponse = response.content
                case .recap:
                    let response = try await appState.aiService.recap(
                        transcript: appState.currentTranscript,
                        screenshot: screenshot,
                        mode: appState.selectedMode
                    )
                    appState.aiService.currentResponse = response.content
                }

                inputText = ""
                print("[Overlay] Request completed successfully")
            } catch {
                print("[Overlay] Error: \(error)")
                appState.errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Tab Item

enum TabItem: String, CaseIterable {
    case assist = "Assist"
    case whatToSay = "What should I say?"
    case followUp = "Follow-up questions"
    case recap = "Recap"

    var icon: String {
        switch self {
        case .assist: return "sparkles"
        case .whatToSay: return "text.bubble"
        case .followUp: return "questionmark.bubble"
        case .recap: return "arrow.counterclockwise"
        }
    }
}

// MARK: - Pill Header View

struct PillHeaderView: View {
    let isExpanded: Bool
    let isSessionActive: Bool
    let onToggleExpand: () -> Void
    let onHide: () -> Void
    let onStop: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            // Logo/Icon
            Image(systemName: "waveform.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(.blue)

            // Expand/Collapse Button
            Button(action: onToggleExpand) {
                HStack(spacing: 4) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                    Text(isExpanded ? "Hide" : "Ask")
                        .font(.system(size: 13, weight: .medium))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isExpanded ? Color.gray.opacity(0.3) : Color.blue)
                .foregroundColor(isExpanded ? .primary : .white)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            // Stop Button (when session active)
            if isSessionActive {
                Button(action: onStop) {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.primary)
                        .frame(width: 28, height: 28)
                        .background(Color.gray.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Expanded Content View

struct ExpandedContentView: View {
    @ObservedObject var appState: AppState
    @ObservedObject var aiService: AIService  // Observe AIService directly for updates
    @Binding var selectedTab: TabItem
    @Binding var inputText: String
    @Binding var isSmartModeEnabled: Bool
    let hasScreenshot: Bool
    let lastScreenshotTime: Date?
    let onSubmit: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // Tab Bar - clicking a tab triggers the request immediately
            TabBarView(selectedTab: $selectedTab) { tab in
                // Trigger request when tab is clicked
                onSubmit()
            }

            // Response Area - showing history of all responses
            ResponseHistoryView(
                responses: aiService.responses,
                currentResponse: aiService.currentResponse,
                isProcessing: aiService.isProcessing,
                hasScreenshot: hasScreenshot,
                lastScreenshotTime: lastScreenshotTime
            )

            // Screen-only mode hint
            if !appState.isSessionActive {
                HStack {
                    Image(systemName: "display")
                        .foregroundColor(.orange)
                    Text("Mode écran seul - Pas de session audio active")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }

            // Input Area (for custom questions)
            InputAreaView(
                inputText: $inputText,
                isSmartModeEnabled: $isSmartModeEnabled,
                placeholder: "Ask about your screen or conversation...",
                onSubmit: onSubmit
            )
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }
}

// MARK: - Tab Bar View

struct TabBarView: View {
    @Binding var selectedTab: TabItem
    let onTabSelected: (TabItem) -> Void  // Callback when tab is clicked

    var body: some View {
        HStack(spacing: 4) {
            ForEach(TabItem.allCases, id: \.self) { tab in
                TabButton(
                    title: tab.rawValue,
                    icon: tab.icon,
                    isSelected: selectedTab == tab
                ) {
                    selectedTab = tab
                    onTabSelected(tab)  // Trigger request immediately
                }
            }
        }
        .padding(4)
        .background(Color.gray.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct TabButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 11))
                Text(title)
                    .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(isSelected ? Color.blue.opacity(0.2) : Color.clear)
            .foregroundColor(isSelected ? .blue : .secondary)
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Response History View

struct ResponseHistoryView: View {
    let responses: [AIResponse]
    let currentResponse: String
    let isProcessing: Bool
    let hasScreenshot: Bool
    let lastScreenshotTime: Date?

    @State private var scrollProxy: ScrollViewProxy?

    var body: some View {
        VStack(spacing: 0) {
            // Screenshot indicator
            if hasScreenshot, let time = lastScreenshotTime {
                HStack(spacing: 6) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 11))
                        .foregroundColor(.green)
                    Text("Screen captured and analyzed")
                        .font(.system(size: 11))
                        .foregroundColor(.green)
                    Spacer()
                    Text(timeAgoString(from: time))
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.green.opacity(0.1))
            }

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Show processing state
                        if isProcessing && currentResponse.isEmpty {
                            HStack(spacing: 8) {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("Analyzing...")
                                    .font(.system(size: 13))
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .id("processing")
                        }

                        // Show current streaming response
                        if !currentResponse.isEmpty && isProcessing {
                            ResponseItemView(
                                type: responses.first?.type ?? .assist,
                                content: currentResponse,
                                timestamp: Date(),
                                provider: responses.first?.provider ?? .openai,
                                isStreaming: true
                            )
                            .id("current")
                        }

                        // Show history of completed responses (most recent first)
                        ForEach(responses) { response in
                            ResponseItemView(
                                type: response.type,
                                content: response.content,
                                timestamp: response.timestamp,
                                provider: response.provider,
                                isStreaming: false
                            )
                            .id(response.id)
                        }

                        // Empty state
                        if responses.isEmpty && !isProcessing {
                            Text("Ask about your screen or conversation, or press Cmd+Enter for Assist")
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(12)
                }
                .onAppear {
                    scrollProxy = proxy
                }
                .onChange(of: responses.count) { _ in
                    // Auto-scroll to top when new response arrives
                    if let firstResponse = responses.first {
                        withAnimation {
                            proxy.scrollTo(firstResponse.id, anchor: .top)
                        }
                    }
                }
                .onChange(of: currentResponse) { _ in
                    // Auto-scroll during streaming
                    if isProcessing {
                        withAnimation {
                            proxy.scrollTo("current", anchor: .top)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 120, maxHeight: 200)
        .background(Color.gray.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func timeAgoString(from date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 5 {
            return "now"
        } else if seconds < 60 {
            return "\(seconds)s ago"
        } else {
            return "\(seconds / 60)m ago"
        }
    }
}

// MARK: - Response Item View

struct ResponseItemView: View {
    let type: AIResponse.ResponseType
    let content: String
    let timestamp: Date
    let provider: AIProviderType
    let isStreaming: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header with type, provider, and timestamp
            HStack(spacing: 8) {
                Image(systemName: type.icon)
                    .font(.system(size: 11))
                    .foregroundColor(.blue)

                Text(type.rawValue)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.blue)

                Spacer()

                Image(systemName: provider.icon)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)

                Text(formatTimestamp(timestamp))
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)

                if isStreaming {
                    ProgressView()
                        .scaleEffect(0.6)
                }
            }

            // Content
            Text(content)
                .font(.system(size: 13))
                .foregroundColor(.primary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(10)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }
}

// MARK: - Response Area View (Legacy - kept for reference)

struct ResponseAreaView: View {
    let response: String
    let isProcessing: Bool
    let hasScreenshot: Bool
    let lastScreenshotTime: Date?

    var body: some View {
        VStack(spacing: 0) {
            // Screenshot indicator
            if hasScreenshot, let time = lastScreenshotTime {
                HStack(spacing: 6) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 11))
                        .foregroundColor(.green)
                    Text("Screen captured and analyzed")
                        .font(.system(size: 11))
                        .foregroundColor(.green)
                    Spacer()
                    Text(timeAgoString(from: time))
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.green.opacity(0.1))
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    if isProcessing && response.isEmpty {
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Analyzing...")
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    } else if response.isEmpty {
                        Text("Ask about your screen or conversation, or press Cmd+Enter for Assist")
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        Text(response)
                            .font(.system(size: 13))
                            .foregroundColor(.primary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(12)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 120, maxHeight: 200)
        .background(Color.gray.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func timeAgoString(from date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 5 {
            return "now"
        } else if seconds < 60 {
            return "\(seconds)s ago"
        } else {
            return "\(seconds / 60)m ago"
        }
    }
}

// MARK: - Input Area View

struct InputAreaView: View {
    @Binding var inputText: String
    @Binding var isSmartModeEnabled: Bool
    let placeholder: String
    let onSubmit: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            // Smart Mode Toggle
            Button(action: { isSmartModeEnabled.toggle() }) {
                Text("Smart")
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(isSmartModeEnabled ? Color.blue.opacity(0.2) : Color.gray.opacity(0.15))
                    .foregroundColor(isSmartModeEnabled ? .blue : .secondary)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .buttonStyle(.plain)

            // Text Field
            TextField(placeholder, text: $inputText)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .onSubmit(onSubmit)

            // Submit Button
            Button(action: onSubmit) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.blue)
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.return, modifiers: .command)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.gray.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Overlay Background

struct OverlayBackground: View {
    var body: some View {
        ZStack {
            // Glass effect
            VisualEffectView(material: .hudWindow, blendingMode: .behindWindow)

            // Slight tint
            Color.black.opacity(0.3)
        }
    }
}

// MARK: - Visual Effect View

struct VisualEffectView: NSViewRepresentable {
    let material: NSVisualEffectView.Material
    let blendingMode: NSVisualEffectView.BlendingMode

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
    }
}
