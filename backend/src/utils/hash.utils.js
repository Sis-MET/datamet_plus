const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hashea una contraseña usando bcrypt
 * @param {string} password Contraseña en texto plano
 * @returns {Promise<string>} Contraseña hasheada
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return await bcrypt.hash(password, salt);
};

/**
 * Compara una contraseña en texto plano contra un hash de DB
 * @param {string} password Contraseña ingresada por el usuario
 * @param {string} hashedPassword Hash recuperado de la Base de Datos
 * @returns {Promise<boolean>}
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword
};
