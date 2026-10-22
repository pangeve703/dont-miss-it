import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// `base: './'` emits relative asset paths, so the same build works at a domain
// root (Cloudflare Pages) and under a sub-path such as
// https://<user>.github.io/<repo>/ (GitHub Pages) without extra configuration.
// Navigation uses the URL hash, so no server rewrite rules are needed either.
export default defineConfig({
  base: './',
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
