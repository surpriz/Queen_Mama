export interface DeepLLanguageInfo {
  /** DeepL code (passed to API as target_lang). */
  code: string
  displayName: string
  flag: string
  /** Short badge label (2-3 chars). */
  badge: string
}

export const DEEPL_LANGUAGES: DeepLLanguageInfo[] = [
  { code: 'BG', displayName: 'Bulgarian', flag: '🇧🇬', badge: 'BG' },
  { code: 'CS', displayName: 'Czech', flag: '🇨🇿', badge: 'CS' },
  { code: 'DA', displayName: 'Danish', flag: '🇩🇰', badge: 'DA' },
  { code: 'DE', displayName: 'German', flag: '🇩🇪', badge: 'DE' },
  { code: 'EL', displayName: 'Greek', flag: '🇬🇷', badge: 'EL' },
  { code: 'EN-US', displayName: 'English (US)', flag: '🇺🇸', badge: 'EN' },
  { code: 'EN-GB', displayName: 'English (UK)', flag: '🇬🇧', badge: 'EN' },
  { code: 'ES', displayName: 'Spanish', flag: '🇪🇸', badge: 'ES' },
  { code: 'ET', displayName: 'Estonian', flag: '🇪🇪', badge: 'ET' },
  { code: 'FI', displayName: 'Finnish', flag: '🇫🇮', badge: 'FI' },
  { code: 'FR', displayName: 'French', flag: '🇫🇷', badge: 'FR' },
  { code: 'HU', displayName: 'Hungarian', flag: '🇭🇺', badge: 'HU' },
  { code: 'ID', displayName: 'Indonesian', flag: '🇮🇩', badge: 'ID' },
  { code: 'IT', displayName: 'Italian', flag: '🇮🇹', badge: 'IT' },
  { code: 'JA', displayName: 'Japanese', flag: '🇯🇵', badge: 'JA' },
  { code: 'KO', displayName: 'Korean', flag: '🇰🇷', badge: 'KO' },
  { code: 'LT', displayName: 'Lithuanian', flag: '🇱🇹', badge: 'LT' },
  { code: 'LV', displayName: 'Latvian', flag: '🇱🇻', badge: 'LV' },
  { code: 'NB', displayName: 'Norwegian', flag: '🇳🇴', badge: 'NB' },
  { code: 'NL', displayName: 'Dutch', flag: '🇳🇱', badge: 'NL' },
  { code: 'PL', displayName: 'Polish', flag: '🇵🇱', badge: 'PL' },
  { code: 'PT-BR', displayName: 'Portuguese (Brazil)', flag: '🇧🇷', badge: 'PT' },
  { code: 'PT-PT', displayName: 'Portuguese (Portugal)', flag: '🇵🇹', badge: 'PT' },
  { code: 'RO', displayName: 'Romanian', flag: '🇷🇴', badge: 'RO' },
  { code: 'RU', displayName: 'Russian', flag: '🇷🇺', badge: 'RU' },
  { code: 'SK', displayName: 'Slovak', flag: '🇸🇰', badge: 'SK' },
  { code: 'SL', displayName: 'Slovenian', flag: '🇸🇮', badge: 'SL' },
  { code: 'SV', displayName: 'Swedish', flag: '🇸🇪', badge: 'SV' },
  { code: 'TR', displayName: 'Turkish', flag: '🇹🇷', badge: 'TR' },
  { code: 'UK', displayName: 'Ukrainian', flag: '🇺🇦', badge: 'UK' },
  { code: 'ZH', displayName: 'Chinese', flag: '🇨🇳', badge: 'ZH' },
]

const LOOKUP = new Map(DEEPL_LANGUAGES.map((l) => [l.code, l]))

export function getLanguageInfo(code: string | null | undefined): DeepLLanguageInfo | undefined {
  if (!code) return undefined
  return LOOKUP.get(code.toUpperCase())
}

/**
 * Map a BCP-47 / ISO code to a DeepL language. Returns null if no reasonable
 * mapping exists.
 */
export function fromBCP47(code: string): DeepLLanguageInfo | null {
  const normalized = code.toUpperCase().replace(/_/g, '-')
  const exact = LOOKUP.get(normalized)
  if (exact) return exact
  const primary = normalized.split('-')[0]
  switch (primary) {
    case 'EN':
      return LOOKUP.get('EN-US') ?? null
    case 'PT':
      return LOOKUP.get('PT-PT') ?? null
    case 'ZH':
      return LOOKUP.get('ZH') ?? null
    default:
      return LOOKUP.get(primary) ?? null
  }
}
