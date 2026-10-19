import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// In the compose dev container this points at the backend service;
// on the host it falls back to the backend's published port.
const proxyTarget = process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:8081'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on all interfaces so Docker can publish the port.
    host: true,
    proxy: {
      '/api': proxyTarget,
    },
  },
})
