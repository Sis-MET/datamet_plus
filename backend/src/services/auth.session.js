/**
 * Vigencia de la sesión (NB/ISO/IEC 17025, 7.11.3 a): el token prueba quién
 * es el usuario, pero su estado, nivel, cargo y área se leen de DATA_USERS en
 * cada petición. Así una baja o un cambio de nivel rige de inmediato aunque
 * el token siga sin caducar (como el acceso por área, `access.areas.js`).
 */
const { getPool, sql } = require('../config/db');

const CAMPOS = 'id, usuario, estado, acceso, acceso_cron, cargo, area';

/** Por qué este usuario no puede usar la aplicación, o null si puede. */
const motivoSinAcceso = (fila) => {
  if (!fila) return 'Tu usuario ya no está registrado.';
  if (String(fila.estado ?? '').trim().toUpperCase() !== 'ACTIVO') {
    return 'Tu usuario está desactivado. Consulta con Sistemas.';
  }
  if (String(fila.acceso_cron ?? '').trim() === '0') {
    return 'Tu perfil no tiene los permisos habilitados para acceder a esta aplicación.';
  }
  return null;
};

const consultarUsuario = async ({ id, usuario }) => {
  const request = getPool().request();
  const result = id !== null
    ? await request.input('id', sql.Int, id)
      .query(`SELECT TOP (1) ${CAMPOS} FROM DATA_USERS WHERE id = @id`)
    : await request.input('usuario', sql.NVarChar, usuario)
      .query(`SELECT TOP (1) ${CAMPOS} FROM DATA_USERS WHERE usuario = @usuario`);
  return result.recordset[0] || null;
};

const mismoUsuario = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * Devuelve una función que, con el payload de un token válido, responde los
 * datos vigentes del usuario o null si ya no puede usar la aplicación.
 */
const crearSesiones = ({ consultar = consultarUsuario } = {}) => async (payload) => {
  const numero = Number(payload?.id);
  const id = Number.isInteger(numero) ? numero : null;
  const usuario = String(payload?.usuario ?? '').trim();
  if (id === null && !usuario) return null;

  const fila = await consultar({ id, usuario });
  if (motivoSinAcceso(fila)) return null;
  // El id debe seguir siendo de la misma persona del token.
  if (usuario && !mismoUsuario(fila.usuario, usuario)) return null;

  return {
    usuario: fila.usuario,
    acceso: fila.acceso ?? '',
    acceso_cron: fila.acceso_cron ?? '',
    cargo: fila.cargo || '',
    area: fila.area || '',
  };
};

const usuarioVigente = crearSesiones();

module.exports = { motivoSinAcceso, crearSesiones, usuarioVigente };
