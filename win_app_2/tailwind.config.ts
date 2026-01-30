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
          // Backgrounds
          'bg-primary': '#1a1a1e',
          'bg-secondary': '#1F1F23',
          'bg-tertiary': '#27272A',
          'bg-elevated': '#2D2D32',
          // Surfaces
          'surface-light': 'rgba(255, 255, 255, 0.05)',
          'surface-medium': 'rgba(255, 255, 255, 0.08)',
          'surface-hover': 'rgba(255, 255, 255, 0.12)',
          'surface-pressed': 'rgba(255, 255, 255, 0.15)',
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
          overlay: 'rgba(0, 0, 0, 0.85)',
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
        'qm-glow': '0 0 12px rgba(139, 92, 246, 0.4)',
        'qm-glow-strong': '0 0 20px rgba(139, 92, 246, 0.6)',
      },
      animation: {
        'qm-pulse': 'qm-pulse 1s ease-in-out infinite alternate',
        'qm-fade-in': 'qm-fade-in 0.25s ease-in-out',
        'qm-slide-up': 'qm-slide-up 0.25s ease-out',
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
