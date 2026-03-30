import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const certPath = 'C:\\Users\\Fatima Miranda\\Proyectos\\Backend\\192.168.1.60+2.pem';
const keyPath  = 'C:\\Users\\Fatima Miranda\\Proyectos\\Backend\\192.168.1.60+2-key.pem';

let httpsConfig = false;
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  httpsConfig = {
    cert: fs.readFileSync(certPath),
    key:  fs.readFileSync(keyPath)
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
