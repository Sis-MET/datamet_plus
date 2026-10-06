const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { startCalibrationScheduler, stopCalibrationScheduler } = require('./services/calibration.scheduler');

const startServer = async () => {
  try {
    // 1. Iniciar conexión a base de datos
    await connectDB();

    // 2. Levantar servidor Express HTTP Normal
    const server = app.listen(env.port, '0.0.0.0', () => {
      console.log(`Servidor backend HTTP corriendo en el puerto ${env.port}`);
      console.log(`Entorno: ${env.nodeEnv}`);
    });

    // 3. Revisión diaria de alertas de calibración por correo
    startCalibrationScheduler();

    // Manejo de cierres gráciles (Graceful Shutdown)
    const shutdown = () => {
      console.log('Apagando servidor...');
      stopCalibrationScheduler();
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
