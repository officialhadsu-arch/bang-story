import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared },
    // Puppeteer is an OPTIONAL runtime dependency of the motion renderer
    // (Fase 4): it is never installed with the app, only loaded lazily via
    // dynamic import when the user installed it. It must stay external so
    // the main bundle builds without it.
    build: { rollupOptions: { external: ['puppeteer'] } }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: {
      alias: { ...shared, '@renderer': resolve('src/renderer/src') }
    },
    plugins: [react(), tailwindcss()]
  }
})
