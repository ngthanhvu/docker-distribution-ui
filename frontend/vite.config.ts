import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev mode: forward API calls to the Go backend.
      '/api': 'http://localhost:8080',
    },
  },
})
