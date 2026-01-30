// Design System - Single source of truth for all design tokens
// Ported from mac_app/Utilities/DesignSystem.swift

export const QMDesign = {
  colors: {
    // Primary Gradient (Purple to Blue)
    gradientStart: '#7C3AED',
    gradientEnd: '#3B82F6',

    // Accent Colors
    accent: '#8B5CF6',
    accentLight: '#A78BFA',
    accentDark: '#6D28D9',

    // Backgrounds
    bgPrimary: '#1a1a1e',
    bgSecondary: '#1F1F23',
    bgTertiary: '#27272A',
    bgElevated: '#2D2D32',

    // Surfaces
    surfaceLight: 'rgba(255, 255, 255, 0.05)',
    surfaceMedium: 'rgba(255, 255, 255, 0.08)',
    surfaceHover: 'rgba(255, 255, 255, 0.12)',
    surfacePressed: 'rgba(255, 255, 255, 0.15)',

    // Semantic
    success: '#10B981',
    successLight: 'rgba(16, 185, 129, 0.15)',
    warning: '#F59E0B',
    warningLight: 'rgba(245, 158, 11, 0.15)',
    error: '#EF4444',
    errorLight: 'rgba(239, 68, 68, 0.15)',
    info: '#3B82F6',
    infoLight: 'rgba(59, 130, 246, 0.15)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textTertiary: 'rgba(255, 255, 255, 0.5)',
    textDisabled: 'rgba(255, 255, 255, 0.3)',

    // Borders
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderMedium: 'rgba(255, 255, 255, 0.15)',
    borderStrong: 'rgba(255, 255, 255, 0.25)',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.85)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',

    // Auto-Answer
    autoAnswer: '#F97316',
    autoAnswerLight: 'rgba(249, 115, 22, 0.2)',
  },

  spacing: {
    xxxs: 2,
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },

  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    pill: 9999,
  },

  shadows: {
    small: '0 2px 4px rgba(0, 0, 0, 0.15)',
    medium: '0 4px 8px rgba(0, 0, 0, 0.2)',
    large: '0 8px 16px rgba(0, 0, 0, 0.25)',
    glow: '0 0 12px rgba(139, 92, 246, 0.4)',
    glowStrong: '0 0 20px rgba(139, 92, 246, 0.6)',
  },

  animation: {
    quick: '150ms ease-in-out',
    standard: '250ms ease-in-out',
    slow: '400ms ease-in-out',
    spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: '400ms cubic-bezier(0.34, 1.2, 0.64, 1)',
    gentle: '500ms cubic-bezier(0.25, 0.1, 0.25, 1)',
  },

  dimensions: {
    overlay: {
      collapsedWidth: 380,
      collapsedHeight: 52,
      expandedWidth: 420,
      expandedHeight: 480,
      headerHeight: 44,
      tabBarHeight: 36,
      inputHeight: 48,
    },
    dashboard: {
      sidebarMinWidth: 220,
      sidebarMaxWidth: 280,
      detailMinWidth: 500,
    },
    card: {
      minHeight: 80,
      padding: 16,
    },
    button: {
      heightSmall: 28,
      heightMedium: 36,
      heightLarge: 44,
      iconSize: 20,
    },
  },

  // Gradient CSS helpers
  gradients: {
    primary: 'linear-gradient(135deg, #7C3AED, #3B82F6)',
    horizontal: 'linear-gradient(90deg, #7C3AED, #3B82F6)',
    primaryText: 'bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end bg-clip-text text-transparent',
  },
} as const

// Response type icons mapping (SF Symbols → Lucide equivalents)
export const RESPONSE_TYPE_ICONS = {
  assist: 'Sparkles',
  whatToSay: 'MessageSquare',
  followUp: 'HelpCircle',
  recap: 'RotateCcw',
  custom: 'MessageCircle',
} as const

// Navigation icons mapping
export const NAV_ICONS = {
  sessions: 'List',
  liveSession: 'Activity',
  modes: 'Users',
  settings: 'Settings',
} as const
