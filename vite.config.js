import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// HTTPS Configuration has been removed to allow HTTP access across all devices
// on the local network via IP (e.g. http://192.168.1.60:3000)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Para que escuche en la IP de la red local
    port: 3000,
    // https: false // No longer using HTTPS
  }
})
