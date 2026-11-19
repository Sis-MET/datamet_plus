/**
 * Acceso a los apartados de cada área (NB/ISO/IEC 17025, 7.11.3 a): los usa
 * el personal de su área, y Sistemas (nivel 3) entra a todos para revisar
 * errores y dar soporte. Algunas áreas solo consultan un apartado (`consulta`):
 * Comercial ve los informes emitidos y los próximos servicios de Soporte
 * técnico, sin modificar nada. El resto del personal ve el apartado bloqueado.
 *
 * El área se lee de DATA_USERS en cada petición, así un cambio de área o una
 * baja rige de inmediato aunque la sesión siga abierta.
 */
const { getPool, sql } = require('../config/db');
const { normalizeArea } = require('./calibration.db');

const MODULOS = {
  calibracion: { area: 'calibracion', nombre: 'Calibración', consulta: [] },
  soporte: { area: 'soporte tecnico', nombre: 'Soporte Técnico', consulta: ['comercial'] },
  // Facturas, pagos y cuentas por cobrar: Administración y Gerencia consultan.
  comercial: { area: 'comercial', nombre: 'Comercial', consulta: ['administracion', 'gerencia'] },
};

/** Niveles de acceso a un apartado: el de su área (o Sistemas) y el de solo consulta. */
const NIVEL = Object.freeze({ AREA: 'area', CONSULTA: 'consulta' });

const definicionDe = (modulo) => {
  const definicion = MODULOS[modulo];
  if (!definicion) throw new Error(`Apartado desconocido: ${modulo}`);
  return definicion;
};

/** Sistemas: el nivel 3, la administración del sistema. */
const esSistemas = (user) => String(user?.acceso_cron) === '3';

/** Jefe de área por su cargo («Jefe de Area», sin importar tildes, mayúsculas ni espacios). */
const esJefeDeArea = (user) => normalizeArea(user?.cargo).replace(/\s+/g, ' ') === 'jefe de area';

/** ¿Puede usar el apartado quien tiene esta área y este nivel? */
const permiteArea = (modulo, { area, acceso_cron: accesoCron } = {}) => {
  const definicion = definicionDe(modulo);
  return String(accesoCron) === '3' || normalizeArea(area) === definicion.area;
};

/** ¿El área solo consulta el apartado? (Comercial en Soporte técnico.) */
const permiteConsulta = (modulo, { area } = {}) => {
  const definicion = definicionDe(modulo);
  const clave = normalizeArea(area);
  return Boolean(clave) && definicion.consulta.includes(clave);
};

/** Nivel con que entra al apartado quien tiene esta área y este nivel, o null. */
const nivelDeArea = (modulo, datos = {}) => {
  if (permiteArea(modulo, datos)) return NIVEL.AREA;
  if (permiteConsulta(modulo, datos)) return NIVEL.CONSULTA;
  return null;
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

/** Nivel de acceso del usuario al apartado: 'area', 'consulta' o null. */
const nivelAcceso = async (user, modulo) => {
  if (esSistemas(user)) return NIVEL.AREA;
  return nivelDeArea(modulo, { area: await areaActiva(user) });
};

const tieneAcceso = async (user, modulo) => (await nivelAcceso(user, modulo)) === NIVEL.AREA;

const mensajeSinAcceso = (modulo) => `Este apartado es del área de ${MODULOS[modulo].nombre}. `
  + 'No perteneces al área o no estás autorizado para acceder.';

const mensajeSoloConsulta = (modulo) => `Tu área solo consulta este apartado. Lo modifica el área de ${MODULOS[modulo].nombre}.`;

module.exports = {
  MODULOS,
  NIVEL,
  esJefeDeArea,
  esSistemas,
  permiteArea,
  permiteConsulta,
  nivelDeArea,
  areaActiva,
  nivelAcceso,
  tieneAcceso,
  mensajeSinAcceso,
  mensajeSoloConsulta,
};
