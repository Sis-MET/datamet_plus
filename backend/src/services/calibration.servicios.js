/**
 * Lectura de los servicios de calibración de ServiceMET
 * (DATA_SERVICIOS_DATOS_CALIBRACION) para DataMET+ (fase 2).
 *
 * Fila vigente: como en Soporte técnico, la última fila de cada
 * `codigo_registro` (ORDER BY n DESC) sin las anuladas. El modelo y los avisos
 * de calidad de datos los arma calibration.fuente.js.
 */
const { getPool, sql } = require('../config/db');
const { EQUIPO_SELECT, clean, httpError, mapEquipo } = require('./calibration.db');
const { expiryDate } = require('./calibration.equipment');
const { clave, modeloDeFila } = require('./calibration.fuente');
const { cargarTodos } = require('./calibration.puntos');

const TABLA = 'dbo.DATA_SERVICIOS_DATOS_CALIBRACION';

const VIGENTES = `
  WITH vigentes AS (
    SELECT t.*,
      ROW_NUMBER() OVER (PARTITION BY t.codigo_registro ORDER BY t.n DESC) AS rn,
      COUNT(*) OVER (PARTITION BY t.codigo_registro) AS versiones
    FROM ${TABLA} t
    WHERE t.codigo_registro IS NOT NULL AND ISNULL(t.estado_servicio_csv, N'') <> N'ANULADO'
  )`;

// ─── Contexto: usuarios y patrones ─────────────────────────────────────────

const existe = async (tabla) => {
  const result = await getPool().request()
    .input('tabla', sql.NVarChar(128), tabla)
    .query('SELECT OBJECT_ID(@tabla, \'U\') AS id');
  return result.recordset[0].id != null;
};

/** Usuarios para reconocer al técnico (también los dados de baja). Sin contraseñas. */
const cargarUsuarios = async () => {
  const result = await getPool().request().query(`
    SELECT id, usuario, nombre1, apellido1, apellido2, inicial, estado FROM DATA_USERS
  `);
  return result.recordset;
};

/**
 * Patrones del gestor de equipos con su historial de certificados y si sus
 * valores están transcritos (fase 1). Map(código normalizado → patrón).
 */
const cargarPatrones = async () => {
  const pool = getPool();
  const equipos = (await pool.request().query(EQUIPO_SELECT)).recordset.map(mapEquipo);
  const conHistorial = await existe('dbo.CAL_CERTIFICADOS');
  const conValores = conHistorial && await existe('dbo.CAL_CERT_TRANSCRIPCION');
  const certificados = conHistorial ? (await pool.request().query(`
    SELECT c.id, c.equipo_id, c.certificado, CONVERT(varchar(10), c.cert_fecha, 23) AS fecha,
      CONVERT(varchar(10), COALESCE(c.cert_fechaven, CASE WHEN c.cert_periodo > 0 THEN DATEADD(day, c.cert_periodo, c.cert_fecha) END), 23) AS vence,
      c.anulado, c.revisado_por,
      ${conValores ? 'CASE WHEN t.certificado_id IS NULL THEN 0 ELSE 1 END' : '0'} AS transcrito
    FROM dbo.CAL_CERTIFICADOS c
    ${conValores ? 'LEFT JOIN dbo.CAL_CERT_TRANSCRIPCION t ON t.certificado_id = c.id' : ''}
  `)).recordset : [];

  const porEquipo = new Map();
  for (const row of certificados) {
    const lista = porEquipo.get(row.equipo_id) || [];
    lista.push({
      id: row.id,
      numero: clean(row.certificado),
      fecha: row.fecha,
      vence: row.vence,
      anulado: Boolean(row.anulado),
      revisadoPor: clean(row.revisado_por),
      transcrito: Boolean(row.transcrito),
    });
    porEquipo.set(row.equipo_id, lista);
  }

  const patrones = new Map();
  for (const equipo of equipos) {
    const lista = porEquipo.get(equipo.id) || [];
    // El vigente de DATA_EQUIPOS_CAL que aún no pasó a CAL_CERTIFICADOS.
    if (equipo.certFecha && !lista.some(cert => cert.fecha === equipo.certFecha && !cert.anulado)) {
      lista.push({
        id: 0,
        numero: equipo.certificado,
        fecha: equipo.certFecha,
        vence: expiryDate(equipo.certFecha, equipo.periodoDias),
        anulado: false,
        revisadoPor: null,
        transcrito: false,
      });
    }
    const codigo = clave(equipo.codigo);
    // Si un código se repite, manda el equipo activo.
    if (patrones.has(codigo) && equipo.estado !== 'ACTIVO') continue;
    patrones.set(codigo, { id: equipo.id, codigo: equipo.codigo, estado: equipo.estado, certificados: lista });
  }
  return patrones;
};

const cargarContexto = async () => {
  const [usuarios, patrones, puntosAcordados] = await Promise.all([cargarUsuarios(), cargarPatrones(), cargarTodos()]);
  return { usuarios, patrones, puntosAcordados };
};

// ─── Consultas ─────────────────────────────────────────────────────────────

const filtrosSql = (request, { desde, hasta, q }) => {
  const condiciones = ['rn = 1'];
  if (desde) {
    request.input('desde', sql.Date, desde);
    condiciones.push('fecha_servicio >= @desde');
  }
  if (hasta) {
    request.input('hasta', sql.Date, hasta);
    condiciones.push('fecha_servicio <= @hasta');
  }
  if (q) {
    request.input('q', sql.NVarChar(110), `%${q}%`);
    condiciones.push(`(codigo_registro LIKE @q OR seca LIKE @q OR cliente LIKE @q OR razon_social LIKE @q OR planta LIKE @q
      OR cod_metrica LIKE @q OR cod_int LIKE @q OR marca LIKE @q OR modelo LIKE @q OR serie LIKE @q OR personal LIKE @q)`);
  }
  return condiciones.join(' AND ');
};

/** Estado del registro de cada servicio; vacío sin la migración 018. */
const estadosDeRegistros = async () => {
  const existe = await getPool().request().query("SELECT OBJECT_ID('dbo.CAL_REGISTROS', 'U') AS id");
  if (existe.recordset[0].id == null) return new Map();
  const result = await getPool().request().query('SELECT codigo_registro, estado FROM dbo.CAL_REGISTROS');
  return new Map(result.recordset.map(row => [row.codigo_registro, row.estado]));
};

/**
 * Resumen de un servicio para la lista: identificación, cliente,
 * instrumento, técnico reconocido y cuántos avisos tiene por nivel.
 */
const resumenDe = (modelo, avisos, versiones = 1, estado = 'PENDIENTE') => {
  const { servicio, cliente, instrumento } = modelo;
  const cuenta = (nivel) => avisos.filter(aviso => aviso.nivel === nivel).length;
  return {
    codigo: servicio.codigo,
    fecha: servicio.fecha,
    seca: servicio.seca?.original || null,
    secaLibro: servicio.seca?.libro || null,
    negociacion: servicio.seca?.negociacion || null,
    reca: servicio.reca?.texto || servicio.reca?.original || null,
    sticker: servicio.sticker,
    tipoServicio: servicio.tipo,
    tecnico: {
      original: servicio.tecnico.original,
      usuario: servicio.tecnico.usuario || null,
      iniciales: servicio.tecnico.iniciales || null,
      nombre: servicio.tecnico.nombre || null,
    },
    cliente: cliente.nombre,
    razonSocial: cliente.razonSocial,
    planta: cliente.planta,
    departamento: cliente.departamento,
    instrumento: {
      codigoMetrica: instrumento.codigoMetrica,
      codigoInterno: instrumento.codigoInterno,
      tipo: instrumento.tipo,
      marca: instrumento.marca,
      modelo: instrumento.modelo,
      serie: instrumento.serie,
      max: instrumento.rangos.length ? instrumento.rangos[instrumento.rangos.length - 1].max : null,
      unidad: instrumento.unidad,
      multirango: instrumento.multirango,
    },
    avisos: {
      errores: cuenta('error'),
      avisos: cuenta('aviso'),
      notas: cuenta('info'),
      codigos: [...new Set(avisos.filter(aviso => aviso.nivel !== 'info').map(aviso => aviso.codigo))],
    },
    // Estado del registro de calibración (migración 018); PENDIENTE si aún no tiene.
    estado,
    versiones,
  };
};

/**
 * Lista de servicios del período, del más reciente al más antiguo, con sus
 * avisos (se leen completos: un año entero tarda menos de un segundo).
 * `tecnico` es el usuario de DATA_USERS reconocido en el servicio.
 */
const listarServicios = async ({ desde = null, hasta = null, q = null, tecnico = null } = {}) => {
  const request = getPool().request();
  const where = filtrosSql(request, { desde, hasta, q });
  const [result, contexto, estados] = await Promise.all([
    request.query(`${VIGENTES} SELECT * FROM vigentes WHERE ${where} ORDER BY fecha_servicio DESC, seca, codigo_registro`),
    cargarContexto(),
    estadosDeRegistros(),
  ]);
  const servicios = result.recordset.map((fila) => {
    const { modelo, avisos } = modeloDeFila(fila, contexto);
    return resumenDe(modelo, avisos, fila.versiones, estados.get(fila.codigo_registro) || 'PENDIENTE');
  });
  return {
    servicios: tecnico
      ? servicios.filter(servicio => servicio.tecnico.usuario && clave(servicio.tecnico.usuario) === clave(tecnico))
      : servicios,
  };
};

/** Fila vigente de un servicio tal como la subió ServiceMET (404 si no existe). */
const filaVigente = async (codigo, createRequest = () => getPool().request()) => {
  const result = await createRequest()
    .input('codigo', sql.NVarChar(100), codigo)
    .query(`${VIGENTES} SELECT * FROM vigentes WHERE rn = 1 AND codigo_registro = @codigo`);
  const fila = result.recordset[0];
  if (!fila) throw httpError(404, 'El servicio no existe o fue anulado en ServiceMET.');
  return fila;
};

/** Fila vigente de un servicio y su modelo. */
const leerServicio = async (codigo) => {
  const fila = await filaVigente(codigo);
  const contexto = await cargarContexto();
  const { modelo, avisos } = modeloDeFila(fila, contexto);
  return { fila, modelo, avisos };
};

/** Un servicio con su modelo completo y los avisos de calidad de datos. */
const getServicio = async (codigo) => {
  const { fila, modelo, avisos } = await leerServicio(codigo);
  return { modelo, avisos, versiones: fila.versiones };
};

/**
 * Revisa todos los servicios del período: cuántos se leen, cuántos tienen
 * errores (no se podrían calcular) y qué avisos aparecen más.
 */
const revisarServicios = async ({ desde = null, hasta = null } = {}) => {
  const request = getPool().request();
  const where = filtrosSql(request, { desde, hasta, q: null });
  const [result, contexto] = await Promise.all([
    request.query(`${VIGENTES} SELECT * FROM vigentes WHERE ${where} ORDER BY fecha_servicio, codigo_registro`),
    cargarContexto(),
  ]);

  const porCodigo = new Map();
  const fallos = [];
  let conErrores = 0;
  let sinAvisos = 0;
  for (const fila of result.recordset) {
    try {
      const { avisos } = modeloDeFila(fila, contexto);
      if (avisos.some(aviso => aviso.nivel === 'error')) conErrores += 1;
      if (!avisos.some(aviso => aviso.nivel !== 'info')) sinAvisos += 1;
      for (const aviso of avisos) {
        const llave = `${aviso.seccion}:${aviso.codigo}`;
        const item = porCodigo.get(llave) || { codigo: aviso.codigo, nivel: aviso.nivel, seccion: aviso.seccion, servicios: new Set(), ejemplos: [] };
        item.servicios.add(fila.codigo_registro);
        if (item.ejemplos.length < 3) item.ejemplos.push({ servicio: fila.codigo_registro, mensaje: aviso.mensaje });
        porCodigo.set(llave, item);
      }
    } catch (error) {
      fallos.push({ servicio: fila.codigo_registro, mensaje: error.message });
    }
  }

  const orden = { error: 0, aviso: 1, info: 2 };
  return {
    total: result.recordset.length,
    leidos: result.recordset.length - fallos.length,
    conErrores,
    sinAvisos,
    fallos,
    avisos: [...porCodigo.values()]
      .map(item => ({ ...item, servicios: item.servicios.size }))
      .sort((a, b) => orden[a.nivel] - orden[b.nivel] || b.servicios - a.servicios),
  };
};

module.exports = {
  cargarContexto,
  resumenDe,
  filaVigente,
  getServicio,
  leerServicio,
  listarServicios,
  revisarServicios,
};
