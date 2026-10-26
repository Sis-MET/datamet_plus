const { getPool } = require('../config/db');

/**
 * Comprueba el estado de la conexión a DB y que Node esté vivo.
 * @route GET /api/health
 */
const checkHealth = async (_req, res, _next) => {
  try {
    const pool = getPool();
    
    // Verificamos conexión
    await pool.request().query('SELECT 1 as isAlive');

    res.status(200).json({
      success: true,
      message: 'API DataMET+ operativa',
      timestamp: new Date().toISOString(),
      database: 'Conectada'
    });
  } catch (error) {
    // Ruta pública: el detalle queda en el registro del servidor.
    console.error('Health: la base de datos no responde:', error.message);
    res.status(503).json({
      success: false,
      message: 'Servicio degradado. La API está arriba pero la Base de Datos falló.'
    });
  }
};

module.exports = {
  checkHealth
};
