const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

const startServer = async () => {
  try {
    // 1. Iniciar conexión a base de datos
    await connectDB();

    // 2. Levantar servidor Express
    const server = app.listen(env.port, () => {
      console.log(`🚀 Servidor backend corriendo en http://localhost:${env.port}`);
      console.log(`📌 Entorno: ${env.nodeEnv}`);
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
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();
