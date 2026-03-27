import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const certPath = 'C:\\Users\\Fatima Miranda\\Proyectos\\Backend\\metrica_server.pfx';
let httpsConfig = false;
if (fs.existsSync(certPath)) {
  httpsConfig = {
    pfx: fs.readFileSync(certPath),
    passphrase: 'M3trica2026!'
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Para que escuche en la IP de la red local
    port: 3000,
    https: httpsConfig
  }
})
