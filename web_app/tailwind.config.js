/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./overlay.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Gradient
        'qm-gradient-start': '#7C3AED',
        'qm-gradient-end': '#3B82F6',
        // Accent
        'qm-accent': '#8B5CF6',
        'qm-accent-light': '#A78BFA',
        'qm-accent-dark': '#6D28D9',
        // Backgrounds
        'qm-bg-primary': '#18181B',
        'qm-bg-secondary': '#1F1F23',
        'qm-bg-tertiary': '#27272A',
        'qm-bg-elevated': '#2D2D32',
        // Surfaces
        'qm-surface-light': 'rgba(255, 255, 255, 0.05)',
        'qm-surface-medium': 'rgba(255, 255, 255, 0.08)',
        'qm-surface-hover': 'rgba(255, 255, 255, 0.12)',
        'qm-surface-pressed': 'rgba(255, 255, 255, 0.15)',
        // Semantic
        'qm-success': '#10B981',
        'qm-warning': '#F59E0B',
        'qm-error': '#EF4444',
        'qm-info': '#3B82F6',
        'qm-auto-answer': '#F97316',
        // Text
        'qm-text-primary': '#FFFFFF',
        'qm-text-secondary': 'rgba(255, 255, 255, 0.7)',
        'qm-text-tertiary': 'rgba(255, 255, 255, 0.5)',
        'qm-text-disabled': 'rgba(255, 255, 255, 0.3)',
        // Borders
        'qm-border-subtle': 'rgba(255, 255, 255, 0.08)',
        'qm-border-medium': 'rgba(255, 255, 255, 0.15)',
        'qm-border-strong': 'rgba(255, 255, 255, 0.25)',
      },
      spacing: {
        'qm-xxxs': '2px',
        'qm-xxs': '4px',
        'qm-xs': '8px',
        'qm-sm': '12px',
        'qm-md': '16px',
        'qm-lg': '20px',
        'qm-xl': '24px',
        'qm-xxl': '32px',
        'qm-xxxl': '48px',
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
      fontSize: {
        'qm-title-lg': ['28px', { fontWeight: '700' }],
        'qm-title-md': ['22px', { fontWeight: '600' }],
        'qm-title-sm': ['18px', { fontWeight: '600' }],
        'qm-headline': ['16px', { fontWeight: '600' }],
        'qm-subheadline': ['14px', { fontWeight: '500' }],
        'qm-body-lg': ['15px', { fontWeight: '400' }],
        'qm-body-md': ['13px', { fontWeight: '400' }],
        'qm-body-sm': ['12px', { fontWeight: '400' }],
        'qm-caption': ['11px', { fontWeight: '500' }],
        'qm-caption-sm': ['10px', { fontWeight: '400' }],
        'qm-label-lg': ['13px', { fontWeight: '600' }],
        'qm-label-md': ['12px', { fontWeight: '500' }],
        'qm-label-sm': ['11px', { fontWeight: '500' }],
      },
      animation: {
        'qm-quick': 'all 0.15s ease-in-out',
        'qm-standard': 'all 0.25s ease-in-out',
        'qm-slow': 'all 0.4s ease-in-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'expand': 'expand 0.25s ease-in-out',
        'collapse': 'collapse 0.25s ease-in-out',
        'pulse-ring': 'pulse-ring 1.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'chevron-bounce': 'chevron-bounce 1s ease-in-out infinite',
      },
      keyframes: {
        expand: {
          '0%': { height: '52px', width: '380px', opacity: '0.9' },
          '100%': { height: '480px', width: '420px', opacity: '1' },
        },
        collapse: {
          '0%': { height: '480px', width: '420px', opacity: '1' },
          '100%': { height: '52px', width: '380px', opacity: '0.9' },
        },
        'pulse-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(139, 92, 246, 0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(139, 92, 246, 0.4)' },
          '50%': { boxShadow: '0 0 24px rgba(139, 92, 246, 0.7)' },
        },
        'chevron-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(2px)' },
        },
      },
      boxShadow: {
        'qm-sm': '0 2px 4px rgba(0, 0, 0, 0.15)',
        'qm-md': '0 4px 8px rgba(0, 0, 0, 0.2)',
        'qm-lg': '0 8px 16px rgba(0, 0, 0, 0.25)',
        'qm-glow': '0 0 12px rgba(139, 92, 246, 0.4)',
        'qm-glow-strong': '0 0 20px rgba(139, 92, 246, 0.6)',
      },
    },
  },
  plugins: [],
};
