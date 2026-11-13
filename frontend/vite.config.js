import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '')
  const target = env.SHOPDESK_API_TARGET || 'http://127.0.0.1:8088'
  const proxy = Object.fromEntries(['/api', '/auth', '/uploads'].map(path => [path, { target, changeOrigin: true }]))
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      allowedHosts: ['shop.yuezo.com'],
      proxy,
      fs: {
        strict: true,
        allow: [frontendRoot],
        deny: ['**/.env*', '**/.git/**', '**/*.key', '**/*.pem', '**/.token_key', '**/backend/**'],
      },
    },
  }
})
