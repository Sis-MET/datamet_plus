/**
 * Estado de los patrones para los certificados (Calibración › Certificados ›
 * Patrones). Un cálculo deja de ser provisional cuando cada juego de pesas y
 * termohigrómetro que usó el servicio tiene, ese día, certificado vigente con
 * sus valores transcritos y verificados por otra persona, y el juego tiene
 * sus piezas registradas (fase 1). Aquí se ve qué le falta a cada patrón hoy
 * y en cuántos servicios del año dejó el cálculo provisional, para saber qué
 * cargar primero. Solo lee.
 */
const { getPool } = require('../config/db');
const { clave } = require('./calibration.fuente');
const { claseSugerida, tipoSugerido } = require('./calibration.patrones');
const { usosDePatrones } = require('./calibration.servicios');

// Lo que le puede faltar a un patrón, en el orden en que se resuelve.
const FALTANTES = {
  NO_EXISTE: 'Darlo de alta en el gestor de equipos',
  DADO_DE_BAJA: 'Está dado de baja en el gestor de equipos',
  SIN_TIPO: 'Indicar si es juego de pesas o termohigrómetro',
  SIN_PIEZAS: 'Registrar sus piezas',
  SIN_CERTIFICADO: 'Registrar su certificado vigente',
  SIN_VALORES: 'Transcribir los valores del certificado',
  SIN_VERIFICAR: 'Que otra persona verifique los valores',
};

/** Hoy en Bolivia (UTC−4), AAAA-MM-DD. */
const hoyBolivia = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);

/** Certificado vigente en un día (el más reciente que lo cubre). */
const vigenteEn = (certificados = [], dia) => certificados
  .filter(cert => !cert.anulado && cert.fecha && cert.fecha <= dia && (!cert.vence || cert.vence >= dia))
  .sort((a, b) => (a.fecha === b.fecha ? b.id - a.id : b.fecha.localeCompare(a.fecha)))[0] || null;

/** Qué le falta hoy a un patrón. */
const estadoActual = ({ equipo, config, piezas, tipoUso, hoy }) => {
  if (!equipo) return { tipo: tipoUso || null, faltan: ['NO_EXISTE'], certificado: null };
  const tipo = config?.tipo || tipoUso || tipoSugerido(equipo.instrumento);
  const faltan = [];
  if (equipo.estado && equipo.estado !== 'ACTIVO') faltan.push('DADO_DE_BAJA');
  if (!config) faltan.push('SIN_TIPO');
  if (tipo === 'PESAS' && !(piezas > 0)) faltan.push('SIN_PIEZAS');
  const cert = vigenteEn(equipo.certificados, hoy);
  if (!cert) faltan.push('SIN_CERTIFICADO');
  else if (!cert.transcrito) faltan.push('SIN_VALORES');
  else if (!cert.revisadoPor) faltan.push('SIN_VERIFICAR');
  return {
    tipo,
    faltan,
    certificado: cert ? { numero: cert.numero, fecha: cert.fecha, vence: cert.vence, transcrito: cert.transcrito, verificado: Boolean(cert.revisadoPor) } : null,
  };
};

/** ¿El patrón dejó provisional el cálculo de ese servicio? (su estado ese día). */
const provisionalEn = (patron, piezas) => patron.estado !== 'VIGENTE'
  || patron.valores !== 'VERIFICADOS'
  || (patron.uso === 'PESAS' && !(piezas > 0));

/**
 * Une el uso en los servicios con lo que hay en el gestor. `configurados`:
 * Map(equipoId → { tipo, clase }); `piezas`: Map(equipoId → piezas activas).
 */
const estadoPatrones = ({ usos, patrones, configurados, piezas, hoy }) => {
  const porCodigo = new Map();
  const serviciosProvisionales = new Set();
  const asegurar = (codigo, base) => {
    const llave = clave(codigo);
    if (!porCodigo.has(llave)) porCodigo.set(llave, { codigo, servicios: 0, provisionales: 0, ultimo: null, ...base });
    return porCodigo.get(llave);
  };

  for (const uso of usos) {
    for (const p of uso.patrones) {
      const item = asegurar(p.codigo, { tipoUso: p.uso });
      item.servicios += 1;
      if (provisionalEn(p, piezas.get(p.equipoId) || 0)) {
        item.provisionales += 1;
        serviciosProvisionales.add(uso.codigo);
      }
      if (uso.fecha && (!item.ultimo || uso.fecha > item.ultimo)) item.ultimo = uso.fecha;
    }
  }
  // Los patrones configurados que no se usaron en el periodo también se muestran.
  for (const equipo of patrones.values()) {
    if (configurados.has(equipo.id)) asegurar(equipo.codigo, { tipoUso: configurados.get(equipo.id).tipo });
  }

  const lista = [...porCodigo.values()].map((item) => {
    const equipo = patrones.get(clave(item.codigo)) || null;
    const config = equipo ? configurados.get(equipo.id) || null : null;
    const n = equipo ? piezas.get(equipo.id) || 0 : 0;
    const actual = estadoActual({ equipo, config, piezas: n, tipoUso: item.tipoUso, hoy });
    return {
      codigo: equipo?.codigo || item.codigo,
      equipoId: equipo?.id ?? null,
      instrumento: equipo?.instrumento || null,
      tipo: actual.tipo,
      clase: actual.tipo === 'PESAS' ? (config?.clase || claseSugerida(item.codigo)) : null,
      piezas: actual.tipo === 'PESAS' ? n : null,
      certificado: actual.certificado,
      listo: actual.faltan.length === 0,
      faltan: actual.faltan.map(codigo => ({ codigo, texto: FALTANTES[codigo] })),
      uso: { servicios: item.servicios, provisionales: item.provisionales, ultimo: item.ultimo },
    };
  });
  // Primero lo que más servicios deja provisionales; después, lo más usado.
  lista.sort((a, b) => Number(a.listo) - Number(b.listo)
    || b.uso.provisionales - a.uso.provisionales
    || b.uso.servicios - a.uso.servicios
    || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));

  return {
    patrones: lista,
    resumen: {
      patrones: lista.length,
      listos: lista.filter(p => p.listo).length,
      servicios: usos.length,
      serviciosProvisionales: serviciosProvisionales.size,
    },
  };
};

const existe = async tabla => (await getPool().request().query(`SELECT OBJECT_ID('${tabla}', 'U') AS id`)).recordset[0].id != null;

/** Estado de los patrones con el uso en los servicios del año. */
const getEstadoPatrones = async ({ anio = Number(hoyBolivia().slice(0, 4)) } = {}) => {
  const conPatrones = await existe('dbo.CAL_PATRONES');
  const [{ usos, patrones }, config, conteo] = await Promise.all([
    usosDePatrones({ desde: `${anio}-01-01`, hasta: `${anio}-12-31` }),
    conPatrones ? getPool().request().query('SELECT equipo_id, tipo, clase FROM dbo.CAL_PATRONES') : { recordset: [] },
    conPatrones ? getPool().request().query('SELECT equipo_id, COUNT(*) AS n FROM dbo.CAL_PATRON_PIEZAS WHERE activa = 1 GROUP BY equipo_id') : { recordset: [] },
  ]);
  const configurados = new Map(config.recordset.map(r => [r.equipo_id, { tipo: r.tipo, clase: r.clase }]));
  const piezas = new Map(conteo.recordset.map(r => [r.equipo_id, r.n]));
  return { anio, hoy: hoyBolivia(), ...estadoPatrones({ usos, patrones, configurados, piezas, hoy: hoyBolivia() }) };
};

module.exports = { FALTANTES, estadoActual, estadoPatrones, getEstadoPatrones, provisionalEn };
