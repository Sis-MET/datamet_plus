const crypto = require('node:crypto');
const { getPool, sql } = require('../config/db');
const { generateToken } = require('../utils/jwt.utils');
const { crearLimitador } = require('./auth.attempts');
const { motivoSinAcceso } = require('./auth.session');

const limitador = crearLimitador();

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/**
 * Compara la contraseña sin que el tiempo de respuesta delate cuántos
 * caracteres coinciden. DATA_USERS guarda la contraseña sin cifrar porque la
 * app de escritorio DataMET la valida así.
 */
const mismaClave = (guardada, ingresada) => {
  if (typeof guardada !== 'string' || typeof ingresada !== 'string') return false;
  const huella = texto => crypto.createHash('sha256').update(texto, 'utf8').digest();
  return crypto.timingSafeEqual(huella(guardada), huella(ingresada));
};

/**
 * Autentica un usuario contra la tabla DATA_USERS.
 * @param {{ usuario: string, pass: string, ip?: string }} datos
 */
const loginUser = async ({ usuario, pass, ip }) => {
  limitador.verificar({ usuario, ip });

  const result = await getPool().request()
    .input('usuario', sql.NVarChar, usuario)
    .query(`
      SELECT TOP (1) id, usuario, pass, nombre1, apellido1, cargo, area, acceso, acceso_cron, estado
      FROM DATA_USERS
      WHERE usuario = @usuario
    `);
  const user = result.recordset[0];

  if (!user || !mismaClave(user.pass, pass)) {
    limitador.fallo({ usuario, ip });
    throw httpError(401, 'Credenciales inválidas');
  }

  // Contraseña correcta, pero dado de baja o sin acceso a la aplicación.
  const motivo = motivoSinAcceso(user);
  if (motivo) throw httpError(403, motivo);

  limitador.exito({ usuario, ip });

  const token = generateToken({
    id: user.id || user.usuario,
    usuario: user.usuario,
    acceso: user.acceso,
    acceso_cron: user.acceso_cron,
    cargo: user.cargo || ''
  });

  return {
    user: {
      usuario: user.usuario,
      nombre: user.nombre1 || '',
      apellido: user.apellido1 || '',
      cargo: user.cargo || '',
      area: user.area || '',
      acceso: user.acceso || '',
      acceso_cron: user.acceso_cron || ''
    },
    token
  };
};

module.exports = {
  loginUser,
  mismaClave,
};
