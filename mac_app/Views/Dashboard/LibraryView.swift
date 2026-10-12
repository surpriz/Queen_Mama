//
//  LibraryView.swift
//  QueenMama
//
//  Sessions, contacts and modes behind one segmented control.
//  The three list views are reused unchanged.
//

import SwiftUI
import SwiftData

enum LibraryTab: String, CaseIterable, Identifiable {
    case sessions
    case contacts
    case modes

    var id: String { rawValue }

    var localizedName: String {
        switch self {
        case .sessions: return String(localized: "dashboard.section.sessions")
        case .contacts: return String(localized: "dashboard.section.contacts")
        case .modes: return String(localized: "dashboard.section.modes")
        }
    }
}

struct LibraryView: View {
    @Binding var selectedTab: LibraryTab
    /// Session another screen asked us to show (Home → recent session row).
    @Binding var requestedSession: Session?

    @State private var searchText = ""

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedTab) {
                ForEach(LibraryTab.allCases) { tab in
                    Text(tab.localizedName).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(maxWidth: 360)
            .padding(.vertical, QMDesign.Spacing.sm)
            .frame(maxWidth: .infinity)
            .background(QMDesign.Colors.backgroundPrimary)

            Divider()

            Group {
                switch selectedTab {
                case .sessions:
                    SessionListView(searchText: $searchText, requestedSession: $requestedSession)
                case .contacts:
                    ContactsListView()
                case .modes:
                    ModesListView()
                }
            }
            .animation(.none, value: selectedTab)
        }
    }
}
