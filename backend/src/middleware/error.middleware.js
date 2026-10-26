const env = require('../config/env');
const { recordFailure } = require('../services/system.failures');

const MENSAJE_INTERNO = 'Error interno del servidor';

const errorHandler = (err, req, res, _next) => {
  console.error('🔥 Error Handler Capturado:', err);

  // Solo los errores lanzados a propósito traen statusCode, y su mensaje es
  // para el usuario. Los demás (SQL, programación) se registran completos en
  // el registro de fallas, pero no se le muestran al cliente fuera de
  // desarrollo: pueden revelar tablas, columnas o consultas.
  const intencional = Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600;
  const statusCode = intencional ? err.statusCode : 500;
  const desarrollo = env.nodeEnv === 'development';
  if (statusCode >= 500) recordFailure({ origen: 'SERVIDOR', error: err, req });

  res.status(statusCode).json({
    success: false,
    message: (intencional || desarrollo) && err.message ? err.message : MENSAJE_INTERNO,
    stack: desarrollo ? err.stack : undefined
  });
};

const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada - ${req.originalUrl}`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
