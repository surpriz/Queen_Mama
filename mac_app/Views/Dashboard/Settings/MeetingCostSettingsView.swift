//
//  MeetingCostSettingsView.swift
//  QueenMama
//
//  Advanced › Meeting Cost (beta).
//

import SwiftUI

struct ModernMeetingCostSettingsView: View {
    @StateObject private var config = ConfigurationManager.shared

    var body: some View {
        VStack(spacing: QMDesign.Spacing.lg) {
            SettingsSectionHeader(
                title: String(localized: "settings.meetingCost.title"),
                subtitle: String(localized: "settings.meetingCost.subtitle")
            )

            SettingsCard(title: String(localized: "settings.general.meetingCost"), icon: "eurosign.circle.fill") {
                VStack(spacing: QMDesign.Spacing.md) {
                    ModernToggleRow(
                        title: String(localized: "settings.general.meetingCost.enable"),
                        description: String(localized: "settings.general.meetingCost.enable.description") + " " + String(localized: "settings.general.betaNotice"),
                        isOn: $config.meetingCostEnabled,
                        icon: "eurosign.circle.fill",
                        isBeta: true
                    )

                    if config.meetingCostEnabled {
                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Currency picker
                    HStack {
                        Image(systemName: "banknote")
                            .font(.system(size: 14))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .frame(width: 20)
                        Text(String(localized: "settings.general.meetingCost.currency"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                        Spacer()
                        Picker("", selection: $config.meetingCurrency) {
                            Text("Euro (€)").tag("EUR")
                            Text("Dollar ($)").tag("USD")
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 180)
                    }

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Hourly rate stepper
                    HStack {
                        Image(systemName: "clock")
                            .font(.system(size: 14))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .frame(width: 20)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(String(localized: "settings.general.meetingCost.hourlyRate"))
                                .font(QMDesign.Typography.bodySmall)
                                .foregroundColor(QMDesign.Colors.textPrimary)
                            Text(String(localized: "settings.general.meetingCost.hourlyRate.description"))
                                .font(QMDesign.Typography.captionSmall)
                                .foregroundColor(QMDesign.Colors.textTertiary)
                        }
                        Spacer()
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Button(action: { config.meetingHourlyRate = max(5, config.meetingHourlyRate - 5) }) {
                                Image(systemName: "minus")
                                    .frame(width: 28, height: 28)
                                    .background(QMDesign.Colors.surfaceMedium)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)

                            Text("\(config.meetingCurrency == "USD" ? "$" : "€")\(Int(config.meetingHourlyRate))/h")
                                .font(QMDesign.Typography.bodyMedium)
                                .foregroundColor(QMDesign.Colors.textPrimary)
                                .frame(minWidth: 60)

                            Button(action: { config.meetingHourlyRate = min(500, config.meetingHourlyRate + 5) }) {
                                Image(systemName: "plus")
                                    .frame(width: 28, height: 28)
                                    .background(QMDesign.Colors.surfaceMedium)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Divider()
                        .background(QMDesign.Colors.borderSubtle)

                    // Default participant count stepper
                    HStack {
                        Image(systemName: "person.2")
                            .font(.system(size: 14))
                            .foregroundColor(QMDesign.Colors.textSecondary)
                            .frame(width: 20)
                        Text(String(localized: "settings.general.meetingCost.defaultParticipants"))
                            .font(QMDesign.Typography.bodySmall)
                            .foregroundColor(QMDesign.Colors.textPrimary)
                        Spacer()
                        HStack(spacing: QMDesign.Spacing.sm) {
                            Button(action: { config.meetingDefaultParticipants = max(1, config.meetingDefaultParticipants - 1) }) {
                                Image(systemName: "minus")
                                    .frame(width: 28, height: 28)
                                    .background(QMDesign.Colors.surfaceMedium)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)

                            Text("\(config.meetingDefaultParticipants)")
                                .font(QMDesign.Typography.bodyMedium)
                                .foregroundColor(QMDesign.Colors.textPrimary)
                                .frame(minWidth: 30)

                            Button(action: { config.meetingDefaultParticipants = min(50, config.meetingDefaultParticipants + 1) }) {
                                Image(systemName: "plus")
                                    .frame(width: 28, height: 28)
                                    .background(QMDesign.Colors.surfaceMedium)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    } // end if config.meetingCostEnabled
                }
            }
        }
    }
}
