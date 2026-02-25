const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Genera un token JWT
 * @param {Object} payload Datos que se quieren encriptar en el token (ej: userId, role)
 * @returns {string} Token firmado
 */
const generateToken = (payload) => {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
};

/**
 * Verifica un token JWT
 * @param {string} token 
 * @returns {Object} El payload decodificado si es válido, lanza error si no
 */
const verifyToken = (token) => {
  return jwt.verify(token, env.jwt.secret);
};

module.exports = {
  generateToken,
  verifyToken
};
