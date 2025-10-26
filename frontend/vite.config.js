import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This is the crucial part for Docker
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,      // The port we will expose
    // This is the proxy for API calls
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})