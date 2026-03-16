export interface TrayStrings {
  startSession: string
  stopSession: string
  showHideWidget: string
  openDashboard: string
  quit: string
}

const TRAY_TRANSLATIONS: Record<string, TrayStrings> = {
  en: {
    startSession: 'Start Session',
    stopSession: 'Stop Session',
    showHideWidget: 'Show/Hide Widget',
    openDashboard: 'Open Dashboard',
    quit: 'Quit Queen Mama',
  },
  fr: {
    startSession: 'Démarrer la session',
    stopSession: 'Arrêter la session',
    showHideWidget: 'Afficher/Masquer le widget',
    openDashboard: 'Ouvrir le tableau de bord',
    quit: 'Quitter Queen Mama',
  },
}

export function getTrayStrings(lang: string): TrayStrings {
  return TRAY_TRANSLATIONS[lang] ?? TRAY_TRANSLATIONS['en']
}
