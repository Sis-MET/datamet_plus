import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El servidor de desarrollo usa HTTP para que lo abran otros equipos de la red
// por IP. El HTTPS de producción lo da Caddy (docs/https-oficina.md).

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'backend/dist',   // Express sirve desde backend/src/../dist = backend/dist
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0', // Para que escuche en la IP de la red local
    port: 3000,

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
