//
//  OverlayBottomSheet.swift
//  QueenMamaIOS
//
//  Bottom sheet container replacing macOS NSPanel overlay.
//  Presented as a sheet with .medium and .large detents.
//

import SwiftUI

struct OverlayBottomSheet: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let sessionManager = appState.sessionManager {
                    OverlayContentView(appState: appState, sessionManager: sessionManager)
                } else {
                    ContentUnavailableView("No Session", systemImage: "waveform.slash", description: Text("Start a session to use AI assistance"))
                }
            }
            .navigationTitle("AI Assistant")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }
                    }
                }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(QMDesign.Radius.xl)
    }
}
