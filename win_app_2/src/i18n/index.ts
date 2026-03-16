import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import enDashboard from './locales/en/dashboard.json'
import enOverlay from './locales/en/overlay.json'
import enModes from './locales/en/modes.json'
import frCommon from './locales/fr/common.json'
import frDashboard from './locales/fr/dashboard.json'
import frOverlay from './locales/fr/overlay.json'
import frModes from './locales/fr/modes.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code']

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((l) => l.code === lang)
}

export function detectSystemLanguage(): SupportedLanguage {
  const sysLang = (navigator.language ?? 'en').split('-')[0].toLowerCase()
  return isSupportedLanguage(sysLang) ? sysLang : 'en'
}

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'dashboard', 'overlay', 'modes'],
  resources: {
    en: { common: enCommon, dashboard: enDashboard, overlay: enOverlay, modes: enModes },
    fr: { common: frCommon, dashboard: frDashboard, overlay: frOverlay, modes: frModes },
  },
  interpolation: { escapeValue: false },
})

export default i18n
