//
//  TalkTimeIndicator.swift
//  QueenMama
//
//  Horizontal bar showing talk-time ratio between "Moi" and "Interlocuteur"
//  Helps sales/commercial users maintain good listening balance
//

import SwiftUI

struct TalkTimeIndicator: View {
    let stats: Session.TalkTimeStats

    @State private var animatedMyPercentage: Double = 0

    var body: some View {
        VStack(alignment: .leading, spacing: QMDesign.Spacing.xs) {
            // Header with balance indicator
            HStack(spacing: QMDesign.Spacing.xs) {
                Image(systemName: "person.2.fill")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(stats.balanceState.color)

                Text("Temps de parole")
                    .font(QMDesign.Typography.caption)
                    .foregroundColor(QMDesign.Colors.textSecondary)

                Spacer()

                // Balance state badge
                Text(stats.balanceState.label)
                    .font(QMDesign.Typography.captionSmall)
                    .foregroundColor(stats.balanceState.color)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(stats.balanceState.color.opacity(0.15))
                    )
            }

            // Horizontal bar showing ratio
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background bar
                    Capsule()
                        .fill(QMDesign.Colors.surfaceLight)

                    // Foreground segments
                    HStack(spacing: 0) {
                        // "Moi" segment (purple gradient)
                        if animatedMyPercentage > 0 {
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            QMDesign.Colors.gradientStart,
                                            QMDesign.Colors.accent
                                        ],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geometry.size.width * animatedMyPercentage)
                        }

                        Spacer(minLength: 0)

                        // "Interlocuteur" segment (blue gradient)
                        if stats.theirPercentage > 0 {
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            QMDesign.Colors.info.opacity(0.7),
                                            QMDesign.Colors.gradientEnd
                                        ],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geometry.size.width * stats.theirPercentage)
                        }
                    }
                    .clipShape(Capsule())
                }
            }
            .frame(height: 8)

            // Labels with percentages
            HStack {
                // "Moi" label
                HStack(spacing: 4) {
                    Circle()
                        .fill(QMDesign.Colors.gradientStart)
                        .frame(width: 6, height: 6)
                    Text("Moi")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                    Text("\(Int(stats.myPercentage * 100))%")
                        .font(QMDesign.Typography.monoSmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                }

                Spacer()

                // "Interlocuteur" label
                HStack(spacing: 4) {
                    Text("\(Int(stats.theirPercentage * 100))%")
                        .font(QMDesign.Typography.monoSmall)
                        .foregroundColor(QMDesign.Colors.textPrimary)
                    Text("Interlocuteur")
                        .font(QMDesign.Typography.captionSmall)
                        .foregroundColor(QMDesign.Colors.textSecondary)
                    Circle()
                        .fill(QMDesign.Colors.gradientEnd)
                        .frame(width: 6, height: 6)
                }
            }
        }
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceMedium)
                .overlay(
                    RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                        .stroke(stats.balanceState.color.opacity(0.2), lineWidth: 1)
                )
        )
        .onAppear {
            // Animate bar on appear
            withAnimation(QMDesign.Animation.smooth.delay(0.1)) {
                animatedMyPercentage = stats.myPercentage
            }
        }
        .onChange(of: stats.myPercentage) { _, newValue in
            // Animate when percentage changes
            withAnimation(QMDesign.Animation.smooth) {
                animatedMyPercentage = newValue
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Temps de parole")
        .accessibilityValue("\(Int(stats.myPercentage * 100)) pourcent moi, \(Int(stats.theirPercentage * 100)) pourcent interlocuteur. \(stats.balanceState.label)")
    }
}

// MARK: - Balance State Colors & Labels

extension Session.BalanceState {
    var color: Color {
        switch self {
        case .noData:
            return QMDesign.Colors.textTertiary
        case .balanced:
            return QMDesign.Colors.success
        case .slightImbalance:
            return QMDesign.Colors.warning
        case .strongImbalance:
            return QMDesign.Colors.error
        }
    }

    var label: String {
        switch self {
        case .noData:
            return "En attente"
        case .balanced:
            return "Equilibre"
        case .slightImbalance:
            return "Attention"
        case .strongImbalance:
            return "Desequilibre"
        }
    }
}

// MARK: - Empty State

extension TalkTimeIndicator {
    /// Empty state when no transcript data is available
    static var emptyState: some View {
        HStack(spacing: QMDesign.Spacing.xs) {
            Image(systemName: "person.2.fill")
                .font(.system(size: 10))
                .foregroundColor(QMDesign.Colors.textTertiary)
            Text("Parlez pour voir le ratio temps de parole")
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(QMDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: QMDesign.Radius.md)
                .fill(QMDesign.Colors.surfaceLight)
        )
    }
}

// MARK: - Preview

#Preview("Balanced (50/50)") {
    TalkTimeIndicator(
        stats: Session.TalkTimeStats(
            myCharCount: 500,
            theirCharCount: 500,
            totalCharCount: 1000
        )
    )
    .padding()
    .background(QMDesign.Colors.backgroundSecondary)
}

#Preview("Slight Imbalance (65/35)") {
    TalkTimeIndicator(
        stats: Session.TalkTimeStats(
            myCharCount: 650,
            theirCharCount: 350,
            totalCharCount: 1000
        )
    )
    .padding()
    .background(QMDesign.Colors.backgroundSecondary)
}

#Preview("Strong Imbalance (80/20)") {
    TalkTimeIndicator(
        stats: Session.TalkTimeStats(
            myCharCount: 800,
            theirCharCount: 200,
            totalCharCount: 1000
        )
    )
    .padding()
    .background(QMDesign.Colors.backgroundSecondary)
}

#Preview("Empty State") {
    TalkTimeIndicator.emptyState
        .padding()
        .background(QMDesign.Colors.backgroundSecondary)
}
