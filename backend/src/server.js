const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { startCalibrationScheduler, stopCalibrationScheduler } = require('./services/calibration.scheduler');
const { startSoporteScheduler, stopSoporteScheduler } = require('./services/soporte.scheduler');
const { startComercialBitrixScheduler, stopComercialBitrixScheduler } = require('./services/comercial.bitrix.scheduler');
const { recordFailure } = require('./services/system.failures');

// Errores que escapan a las rutas y tareas: también al registro de fallas.
process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin manejar:', reason);
  recordFailure({ origen: 'PROCESO', error: reason instanceof Error ? reason : new Error(String(reason)) });
});

const startServer = async () => {
  try {
    // 1. Iniciar conexión a base de datos
    await connectDB();

    // 2. Levantar servidor Express HTTP Normal
    const server = app.listen(env.port, '0.0.0.0', () => {
      console.log(`Servidor backend HTTP corriendo en el puerto ${env.port}`);
      console.log(`Entorno: ${env.nodeEnv}`);
    });

    // 3. Revisión diaria de alertas de calibración y de los próximos
    //    servicios de soporte técnico por correo
    startCalibrationScheduler();
    startSoporteScheduler();
    // 4. Copia de Bitrix24 para Comercial (solo si hay webhook)
    startComercialBitrixScheduler();

    // Manejo de cierres gráciles (Graceful Shutdown)
    const shutdown = () => {
      console.log('Apagando servidor...');
      stopCalibrationScheduler();
      stopSoporteScheduler();
      stopComercialBitrixScheduler();
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
