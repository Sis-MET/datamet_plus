/**
 * Acceso a los apartados de cada área (NB/ISO/IEC 17025, 7.11.3 a): los usa
 * el personal de su área, y Sistemas (nivel 3) entra a todos para revisar
 * errores y dar soporte. El resto del personal ve el apartado bloqueado.
 *
 * El área se lee de DATA_USERS en cada petición, así un cambio de área o una
 * baja rige de inmediato aunque la sesión siga abierta.
 */
const { getPool, sql } = require('../config/db');
const { normalizeArea } = require('./calibration.db');

const MODULOS = {
  calibracion: { area: 'calibracion', nombre: 'Calibración' },
  soporte: { area: 'soporte tecnico', nombre: 'Soporte Técnico' },
};

/** Sistemas: el nivel 3, la administración del sistema. */
const esSistemas = (user) => String(user?.acceso_cron) === '3';

/** ¿Puede usar el apartado quien tiene esta área y este nivel? */
const permiteArea = (modulo, { area, acceso_cron: accesoCron } = {}) => {
  const definicion = MODULOS[modulo];
  if (!definicion) throw new Error(`Apartado desconocido: ${modulo}`);
  return String(accesoCron) === '3' || normalizeArea(area) === definicion.area;
};

/** Área del usuario activo, o null si no existe o está desactivado. */
const areaActiva = async (user) => {
  const id = Number(user?.id);
  if (!Number.isInteger(id)) return null;
  const result = await getPool().request()
    .input('id', sql.Int, id)
    .query(`SELECT TOP (1) area FROM DATA_USERS WHERE id = @id AND estado = 'ACTIVO'`);
  return result.recordset[0]?.area ?? null;
};

const tieneAcceso = async (user, modulo) => esSistemas(user)
  || permiteArea(modulo, { area: await areaActiva(user) });

const mensajeSinAcceso = (modulo) => `Este apartado es del área de ${MODULOS[modulo].nombre}. `
  + 'No perteneces al área o no estás autorizado para acceder.';

module.exports = {
  MODULOS,
  esSistemas,
  permiteArea,
  areaActiva,
  tieneAcceso,
  mensajeSinAcceso,
};
