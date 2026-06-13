import Foundation

/// DeepL target languages (subset of DeepL's full language list).
/// Raw values are DeepL's language codes — passed as `target_lang` in API calls.
/// See: https://developers.deepl.com/docs/getting-started/supported-languages
enum DeepLLanguage: String, CaseIterable, Identifiable, Sendable {
    case bulgarian      = "BG"
    case czech          = "CS"
    case danish         = "DA"
    case german         = "DE"
    case greek          = "EL"
    case englishUS      = "EN-US"
    case englishGB      = "EN-GB"
    case spanish        = "ES"
    case estonian       = "ET"
    case finnish        = "FI"
    case french         = "FR"
    case hungarian      = "HU"
    case indonesian     = "ID"
    case italian        = "IT"
    case japanese       = "JA"
    case korean         = "KO"
    case lithuanian     = "LT"
    case latvian        = "LV"
    case norwegianBokmal = "NB"
    case dutch          = "NL"
    case polish         = "PL"
    case portugueseBR   = "PT-BR"
    case portuguesePT   = "PT-PT"
    case romanian       = "RO"
    case russian        = "RU"
    case slovak         = "SK"
    case slovenian      = "SL"
    case swedish        = "SV"
    case turkish        = "TR"
    case ukrainian      = "UK"
    case chinese        = "ZH"

    var id: String { rawValue }

    /// Human-readable name in English (used in pickers).
    var displayName: String {
        switch self {
        case .bulgarian:        return "Bulgarian"
        case .czech:            return "Czech"
        case .danish:           return "Danish"
        case .german:           return "German"
        case .greek:            return "Greek"
        case .englishUS:        return "English (US)"
        case .englishGB:        return "English (UK)"
        case .spanish:          return "Spanish"
        case .estonian:         return "Estonian"
        case .finnish:          return "Finnish"
        case .french:           return "French"
        case .hungarian:        return "Hungarian"
        case .indonesian:       return "Indonesian"
        case .italian:          return "Italian"
        case .japanese:         return "Japanese"
        case .korean:           return "Korean"
        case .lithuanian:       return "Lithuanian"
        case .latvian:          return "Latvian"
        case .norwegianBokmal:  return "Norwegian"
        case .dutch:            return "Dutch"
        case .polish:           return "Polish"
        case .portugueseBR:     return "Portuguese (Brazil)"
        case .portuguesePT:     return "Portuguese (Portugal)"
        case .romanian:         return "Romanian"
        case .russian:          return "Russian"
        case .slovak:           return "Slovak"
        case .slovenian:        return "Slovenian"
        case .swedish:          return "Swedish"
        case .turkish:          return "Turkish"
        case .ukrainian:        return "Ukrainian"
        case .chinese:          return "Chinese"
        }
    }

    /// Flag emoji (best-effort, regional variants share base flag).
    var flag: String {
        switch self {
        case .bulgarian:        return "🇧🇬"
        case .czech:            return "🇨🇿"
        case .danish:           return "🇩🇰"
        case .german:           return "🇩🇪"
        case .greek:            return "🇬🇷"
        case .englishUS:        return "🇺🇸"
        case .englishGB:        return "🇬🇧"
        case .spanish:          return "🇪🇸"
        case .estonian:         return "🇪🇪"
        case .finnish:          return "🇫🇮"
        case .french:           return "🇫🇷"
        case .hungarian:        return "🇭🇺"
        case .indonesian:       return "🇮🇩"
        case .italian:          return "🇮🇹"
        case .japanese:         return "🇯🇵"
        case .korean:           return "🇰🇷"
        case .lithuanian:       return "🇱🇹"
        case .latvian:          return "🇱🇻"
        case .norwegianBokmal:  return "🇳🇴"
        case .dutch:            return "🇳🇱"
        case .polish:           return "🇵🇱"
        case .portugueseBR:     return "🇧🇷"
        case .portuguesePT:     return "🇵🇹"
        case .romanian:         return "🇷🇴"
        case .russian:          return "🇷🇺"
        case .slovak:           return "🇸🇰"
        case .slovenian:        return "🇸🇮"
        case .swedish:          return "🇸🇪"
        case .turkish:          return "🇹🇷"
        case .ukrainian:        return "🇺🇦"
        case .chinese:          return "🇨🇳"
        }
    }

    /// Short badge label (2-3 chars for compact UI badges).
    var badge: String {
        switch self {
        case .englishUS:        return "EN"
        case .englishGB:        return "EN"
        case .portugueseBR:     return "PT"
        case .portuguesePT:     return "PT"
        default:                return rawValue
        }
    }

    /// Maps a BCP-47 / ISO language code (as used in `ConfigurationManager.primaryLanguage`)
    /// to a DeepL language. Returns nil if no reasonable mapping exists.
    static func fromBCP47(_ code: String) -> DeepLLanguage? {
        let normalized = code.uppercased().replacingOccurrences(of: "_", with: "-")
        // Exact match first
        if let exact = DeepLLanguage(rawValue: normalized) {
            return exact
        }
        // Strip region for two-letter primary codes
        let primary = String(normalized.split(separator: "-").first ?? "")
        switch primary {
        case "EN": return .englishUS
        case "PT": return .portuguesePT
        case "ZH": return .chinese
        default:
            return DeepLLanguage(rawValue: primary)
        }
    }
}
