import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary Gradient
        qm: {
          'gradient-start': '#7C3AED',
          'gradient-end': '#3B82F6',
          // Accent
          accent: '#8B5CF6',
          'accent-light': '#A78BFA',
          'accent-dark': '#6D28D9',
          'accent-soft': 'rgba(139, 92, 246, 0.08)',
          'accent-soft-hover': 'rgba(139, 92, 246, 0.14)',
          // Secondary accent (status, highlights)
          cyan: '#22D3EE',
          'cyan-soft': 'rgba(34, 211, 238, 0.10)',
          // Backgrounds — deeper, more contrast between layers
          'bg-primary': '#0E0E11',
          'bg-secondary': '#16161A',
          'bg-tertiary': '#1E1E24',
          'bg-elevated': '#2A2A33',
          'bg-glass': 'rgba(22, 22, 26, 0.72)',
          // Surfaces
          'surface-light': 'rgba(255, 255, 255, 0.04)',
          'surface-medium': 'rgba(255, 255, 255, 0.07)',
          'surface-hover': 'rgba(255, 255, 255, 0.10)',
          'surface-pressed': 'rgba(255, 255, 255, 0.14)',
          // Semantic
          success: '#10B981',
          'success-light': 'rgba(16, 185, 129, 0.15)',
          warning: '#F59E0B',
          'warning-light': 'rgba(245, 158, 11, 0.15)',
          error: '#EF4444',
          'error-light': 'rgba(239, 68, 68, 0.15)',
          info: '#3B82F6',
          'info-light': 'rgba(59, 130, 246, 0.15)',
          // Text
          'text-primary': '#FFFFFF',
          'text-secondary': 'rgba(255, 255, 255, 0.7)',
          'text-tertiary': 'rgba(255, 255, 255, 0.5)',
          'text-disabled': 'rgba(255, 255, 255, 0.3)',
          // Borders
          'border-subtle': 'rgba(255, 255, 255, 0.08)',
          'border-medium': 'rgba(255, 255, 255, 0.15)',
          'border-strong': 'rgba(255, 255, 255, 0.25)',
          // Overlay
          overlay: '#000000',
          'overlay-light': 'rgba(0, 0, 0, 0.5)',
          // Auto-Answer
          'auto-answer': '#F97316',
          'auto-answer-light': 'rgba(249, 115, 22, 0.2)',
        },
      },
      fontSize: {
        'title-lg': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        'title-md': ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'title-sm': ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        headline: ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        subheadline: ['14px', { lineHeight: '1.4', fontWeight: '500' }],
        'body-lg': ['15px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-md': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['11px', { lineHeight: '1.4', fontWeight: '500' }],
        'caption-sm': ['10px', { lineHeight: '1.4', fontWeight: '400' }],
        'label-lg': ['13px', { lineHeight: '1.4', fontWeight: '600' }],
        'label-md': ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '1.4', fontWeight: '500' }],
      },
      spacing: {
        qm: {
          xxxs: '2px',
          xxs: '4px',
          xs: '8px',
          sm: '12px',
          md: '16px',
          lg: '20px',
          xl: '24px',
          xxl: '32px',
          xxxl: '48px',
        },
      },
      borderRadius: {
        'qm-xs': '4px',
        'qm-sm': '6px',
        'qm-md': '8px',
        'qm-lg': '12px',
        'qm-xl': '16px',
        'qm-xxl': '20px',
        'qm-pill': '9999px',
      },
      boxShadow: {
        'qm-sm': '0 2px 4px rgba(0, 0, 0, 0.15)',
        'qm-md': '0 4px 8px rgba(0, 0, 0, 0.2)',
        'qm-lg': '0 8px 16px rgba(0, 0, 0, 0.25)',
        // Elevation system with baked-in hairline border (1px inner ring)
        'qm-elev-1': '0 1px 2px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
        'qm-elev-2': '0 8px 24px -8px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'qm-elev-3': '0 20px 48px -16px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.06)',
        // Glass: outer drop + inner highlight for depth
        'qm-glass': '0 16px 48px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
        // Violet glow — layered (inner halo + outer bloom)
        'qm-glow': '0 0 0 1px rgba(139, 92, 246, 0.3), 0 4px 16px -2px rgba(139, 92, 246, 0.35)',
        'qm-glow-strong': '0 0 0 1px rgba(139, 92, 246, 0.45), 0 8px 32px -4px rgba(139, 92, 246, 0.55), 0 0 24px rgba(139, 92, 246, 0.35)',
        'qm-glow-cyan': '0 0 0 1px rgba(34, 211, 238, 0.3), 0 4px 16px -2px rgba(34, 211, 238, 0.35)',
      },
      backdropBlur: {
        'qm-sm': '8px',
        'qm-md': '16px',
        'qm-lg': '24px',
        'qm-xl': '32px',
      },
      fontFamily: {
        display: [
          '"Inter Display"',
          '"InterVariable"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        sans: [
          '"InterVariable"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      animation: {
        'qm-pulse': 'qm-pulse 1s ease-in-out infinite alternate',
        'qm-fade-in': 'qm-fade-in 0.25s ease-in-out',
        'qm-slide-up': 'qm-slide-up 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'pulsing-ring': 'pulsing-ring 1.5s ease-in-out infinite',
        'pulsing-ring-play': 'pulsing-ring-play 1.2s ease-in-out infinite',
        'qm-shimmer': 'qm-shimmer 1.6s ease-in-out infinite',
      },
      keyframes: {
        'qm-pulse': {
          '0%': { opacity: '0.5', transform: 'scale(0.8)' },
          '100%': { opacity: '0', transform: 'scale(1.2)' },
        },
        'qm-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'qm-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'shrink-width': {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
        'pulsing-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        'pulsing-ring-play': {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '100%': { transform: 'scale(1.2)', opacity: '0' },
        },
        'qm-shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      transitionDuration: {
        quick: '150ms',
        standard: '250ms',
        slow: '400ms',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
