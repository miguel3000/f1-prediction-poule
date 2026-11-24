import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { seoContent } from './vite.seo'

export default defineConfig({
  plugins: [react(), seoContent()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true,
      }
    }
  }
})
