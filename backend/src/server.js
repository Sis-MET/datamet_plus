const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

const startServer = async () => {
  try {
    // 1. Iniciar conexión a base de datos
    await connectDB();

    // 2. Levantar servidor Express Seguro (HTTPS)
    const fs = require('fs');
    const https = require('https');
    
    const opcionesSsl = {
      pfx: fs.readFileSync('C:\\Users\\Fatima Miranda\\Proyectos\\Backend\\metrica_server.pfx'),
      passphrase: 'M3trica2026!'
    };

    const server = https.createServer(opcionesSsl, app).listen(env.port, '0.0.0.0', () => {
      console.log(`Servidor backend HTTPS corriendo seguro en el puerto ${env.port}`);
      console.log(`Entorno: ${env.nodeEnv}`);
    });

    // Manejo de cierres gráciles (Graceful Shutdown)
    const shutdown = () => {
      console.log('Apagando servidor...');
      server.close(() => {
        console.log('Servidor HTTP cerrado.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();
