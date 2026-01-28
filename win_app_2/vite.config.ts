import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@electron': resolve(__dirname, 'electron'),
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron',
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'electron/preload.ts'),
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist',
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
})
