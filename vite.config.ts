import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'

export default defineConfig({
  plugins: [react(), {
    name: 'production-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
          .filter((match) => match[1].trim())
          .map((match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`)
        return [{ tag: 'meta', injectTo: 'head-prepend', attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: `default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'`,
        } }]
      },
    },
  }],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
