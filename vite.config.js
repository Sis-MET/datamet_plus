import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// HTTPS Configuration has been removed to allow HTTP access across all devices
// on the local network via IP (e.g. http://192.168.1.60:3000)

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'backend/dist',   // Express sirve desde backend/src/../dist = backend/dist
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0', // Para que escuche en la IP de la red local
    port: 3000,
    // https: false // No longer using HTTPS

    // ── Proxy de desarrollo ──────────────────────────────────────────────────
    // Redirige las llamadas /api al backend local (puerto 5000).
    // Evita CORS y no requiere cambiar ningún archivo de código fuente.
    // Para producción esto no aplica (el build va al mismo servidor Express).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  }
})
