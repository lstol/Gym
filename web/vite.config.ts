/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function buildHash() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_HASH__: JSON.stringify(buildHash()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Installability and app-shell caching only — see CLAUDE.md §2.
      // No runtime data caching: workout/program data always comes from Supabase.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/api/],
      },
      manifest: {
        name: 'Treningslogg',
        short_name: 'Treningslogg',
        description: 'Personlig treningslogg og progresjonssporer',
        theme_color: '#1c2f4a',
        background_color: '#f7f6f3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'dist', 'e2e'],
    // src/domain/ is test-first (CLAUDE.md §8) and empty until phase 3 — don't
    // fail the pre-commit gate on an empty suite before then.
    passWithNoTests: true,
  },
})
