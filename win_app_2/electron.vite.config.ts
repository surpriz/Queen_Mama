import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load .env file so main process define can access VITE_SENTRY_DSN
  const env = loadEnv(mode, process.cwd(), '')

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          external: ['fsevents'],
          input: {
            index: resolve(__dirname, 'electron/main.ts'),
          },
        },
      },
      define: {
        // SENTRY_DSN for main process — falls back to VITE_SENTRY_DSN from .env
        'process.env.SENTRY_DSN': JSON.stringify(
          env.SENTRY_DSN || env.VITE_SENTRY_DSN || process.env.SENTRY_DSN || ''
        ),
        'process.env.VITE_APP_ENV': JSON.stringify(
          env.VITE_APP_ENV || process.env.VITE_APP_ENV || ''
        ),
      },
      resolve: {
        alias: {
          '@electron': resolve(__dirname, 'electron'),
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          external: ['fsevents'],
          input: {
            index: resolve(__dirname, 'electron/preload.ts'),
          },
        },
      },
    },
    renderer: {
      root: '.',
      build: {
        // Generate source maps so Sentry can symbolicate renderer stack traces.
        // For upload, install `@sentry/vite-plugin` and add it to `plugins` below
        // with SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT env vars set in CI.
        sourcemap: true,
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'index.html'),
          },
        },
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
      plugins: [react()],
    },
  }
})
