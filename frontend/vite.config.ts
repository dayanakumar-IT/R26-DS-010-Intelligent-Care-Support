import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Serve index.html for all routes so React Router handles them.
    // Without this, refreshing on /fall-detection or any sub-route
    // returns a 404 from the Vite dev server.
    historyApiFallback: true,
  },
})
