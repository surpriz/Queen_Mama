//
//  MeetingCostIndicator.swift
//  QueenMama
//
//  Compact real-time meeting cost indicator shown in the overlay header.
//  Displays running cost based on participant count, hourly rate, and session duration.
//

import SwiftUI

// MARK: - Meeting Cost Indicator (Overlay Header)

struct MeetingCostIndicator: View {
    let sessionDuration: TimeInterval
    @Binding var participantCount: Int
    let hourlyRate: Double
    let currency: String
    let detectedFaceCount: Int

    @State private var showStepper = false
    @State private var isHovered = false

    private var liveCost: Double {
        Double(participantCount) * hourlyRate * (sessionDuration / 3600)
    }

    private var currencySymbol: String {
        currency == "USD" ? "$" : "€"
    }

    private var formattedCost: String {
        if liveCost >= 1000 {
            return "\(currencySymbol)\(String(format: "%.0f", liveCost))"
        }
        return "\(currencySymbol)\(String(format: "%.2f", liveCost))"
    }

    private var costColor: Color {
        if liveCost >= hourlyRate {
            return QMDesign.Colors.warning
        }
        return QMDesign.Colors.textSecondary
    }

    var body: some View {
        Button(action: { showStepper.toggle() }) {
            HStack(spacing: 3) {
                Image(systemName: currency == "USD" ? "dollarsign.circle.fill" : "eurosign.circle.fill")
                    .font(.system(size: 10, weight: .medium))

                Text(formattedCost)
                    .font(QMDesign.Typography.monoSmall)
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.3), value: liveCost)

                Text("·")
                    .font(.system(size: 8))

                Image(systemName: "person.fill")
                    .font(.system(size: 8))
                Text("\(participantCount)")
                    .font(QMDesign.Typography.captionSmall)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(
                Capsule()
                    .fill(costColor.opacity(isHovered ? 0.25 : 0.15))
            )
            .foregroundColor(costColor)
            .scaleEffect(isHovered ? 1.05 : 1.0)
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(QMDesign.Animation.quick, value: isHovered)
        .help(String(localized: "meetingcost.indicator.tooltip"))
        .popover(isPresented: $showStepper, arrowEdge: .bottom) {
            ParticipantStepperPopover(
                participantCount: $participantCount,
                detectedFaceCount: detectedFaceCount
            )
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(String(localized: "meetingcost.accessibility.label \(formattedCost) \(participantCount)"))
    }
}

// MARK: - Participant Stepper Popover

private struct ParticipantStepperPopover: View {
    @Binding var participantCount: Int
    let detectedFaceCount: Int

    @State private var isMinusHovered = false
    @State private var isPlusHovered = false

    var body: some View {
        VStack(spacing: QMDesign.Spacing.sm) {
            // Title
            Text(String(localized: "meetingcost.stepper.label"))
                .font(QMDesign.Typography.caption)
                .foregroundColor(QMDesign.Colors.textSecondary)

            // Stepper row
            HStack(spacing: QMDesign.Spacing.sm) {
                // Minus button
                Button(action: { participantCount = max(1, participantCount - 1) }) {
                    Image(systemName: "minus")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(participantCount > 1 ? QMDesign.Colors.textPrimary : QMDesign.Colors.textTertiary)
                        .frame(width: 22, height: 22)
                        .background(
                            Circle()
                                .fill(isMinusHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.surfaceLight)
                        )
                }
                .buttonStyle(.plain)
                .disabled(participantCount <= 1)
                .onHover { isMinusHovered = $0 }

                // Count display
                Text("\(participantCount)")
                    .font(.system(size: 18, weight: .semibold, design: .monospaced))
                    .foregroundColor(QMDesign.Colors.textPrimary)
                    .frame(minWidth: 30)
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.2), value: participantCount)

                // Plus button
                Button(action: { participantCount = min(50, participantCount + 1) }) {
                    Image(systemName: "plus")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(QMDesign.Colors.textPrimary)
                        .frame(width: 22, height: 22)
                        .background(
                            Circle()
                                .fill(isPlusHovered ? QMDesign.Colors.surfaceHover : QMDesign.Colors.surfaceLight)
                        )
                }
                .buttonStyle(.plain)
                .disabled(participantCount >= 50)
                .onHover { isPlusHovered = $0 }
            }

            // Face detection suggestion (+1 for user who isn't visible on screen)
            let suggestedCount = detectedFaceCount + 1
            if detectedFaceCount > 0 && suggestedCount != participantCount {
                Button(action: { participantCount = suggestedCount }) {
                    HStack(spacing: 4) {
                        Image(systemName: "eye.fill")
                            .font(.system(size: 9))
                        Text(String(localized: "meetingcost.detected \(detectedFaceCount)"))
                            .font(QMDesign.Typography.captionSmall)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(QMDesign.Colors.info.opacity(0.15))
                    )
                    .foregroundColor(QMDesign.Colors.info)
                }
                .buttonStyle(.plain)
                .help(String(localized: "meetingcost.detected.tooltip"))
            }
        }
        .padding(QMDesign.Spacing.md)
        .frame(minWidth: 140)
    }
}

// MARK: - Meeting Cost Detail Section (Dashboard Recap)

struct MeetingCostDetailSection: View {
    let snapshot: Session.CostSnapshot

    var body: some View {
        DetailSection(
            title: String(localized: "sessions.detail.meetingCost"),
            icon: "eurosign.circle"
        ) {
            HStack(spacing: QMDesign.Spacing.lg) {
                CostStatView(
                    label: String(localized: "sessions.detail.meetingCost.total"),
                    value: snapshot.formattedCost,
                    color: QMDesign.Colors.warning
                )
                CostStatView(
                    label: String(localized: "sessions.detail.meetingCost.participants"),
                    value: "\(snapshot.participantCount)",
                    color: QMDesign.Colors.textPrimary
                )
                CostStatView(
                    label: String(localized: "sessions.detail.meetingCost.rate"),
                    value: snapshot.formattedRate,
                    color: QMDesign.Colors.textSecondary
                )
            }
        }
    }
}

// MARK: - Cost Stat View

private struct CostStatView: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(label)
                .font(QMDesign.Typography.captionSmall)
                .foregroundColor(QMDesign.Colors.textTertiary)
            Text(value)
                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Previews

#Preview("Active Session - Low Cost") {
    MeetingCostIndicator(
        sessionDuration: 300,
        participantCount: .constant(3),
        hourlyRate: 50.0,
        currency: "EUR",
        detectedFaceCount: 0
    )
    .padding()
    .background(QMDesign.Colors.backgroundSecondary)
}

#Preview("Active Session - High Cost") {
    MeetingCostIndicator(
        sessionDuration: 7200,
        participantCount: .constant(8),
        hourlyRate: 50.0,
        currency: "EUR",
        detectedFaceCount: 6
    )
    .padding()
    .background(QMDesign.Colors.backgroundSecondary)
}

#Preview("Cost Detail Section") {
    MeetingCostDetailSection(
        snapshot: Session.CostSnapshot(
            participantCount: 5,
            hourlyRate: 50.0,
            currency: "EUR",
            durationSeconds: 3600
        )
    )
    .padding()
    .background(QMDesign.Colors.backgroundPrimary)
}
