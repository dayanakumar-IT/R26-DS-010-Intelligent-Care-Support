import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy SCRIBE API in dev so the browser uses same-origin requests (avoids CORS /
    // "Failed to fetch" when the backend returns errors without CORS headers).
    proxy: {
      '/api/scribe': {
        target: 'http://127.0.0.1:8004',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/scribe/, ''),
      },
    },
  },
})
