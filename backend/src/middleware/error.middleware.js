const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  console.error('🔥 Error Handler Capturado:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  // Si estamos en desarrollo, enviamos la traza (stack) para depurar, de lo contrario lo ocultamos
  res.status(statusCode).json({
    success: false,
    message,
    stack: env.nodeEnv === 'development' ? err.stack : undefined
  });
};

const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada - ${req.originalUrl}`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
