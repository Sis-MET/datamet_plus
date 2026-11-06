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
const { clave, identificarTecnico, leerReca, leerSeca, modeloDeFila } = require('./calibration.fuente');

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
  const [usuarios, patrones] = await Promise.all([cargarUsuarios(), cargarPatrones()]);
  return { usuarios, patrones };
};

// ─── Consultas ─────────────────────────────────────────────────────────────

const fechaTexto = (valor) => (valor instanceof Date ? valor.toISOString().slice(0, 10) : (valor ? String(valor).slice(0, 10) : null));

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

/**
 * Lista de servicios (columnas livianas), del más reciente al más antiguo.
 * `tecnico` es el usuario de DATA_USERS: se compara con el técnico reconocido.
 */
const listarServicios = async ({ desde = null, hasta = null, q = null, tecnico = null } = {}) => {
  const request = getPool().request();
  const where = filtrosSql(request, { desde, hasta, q });
  const [result, usuarios] = await Promise.all([
    request.query(`${VIGENTES}
      SELECT codigo_registro, seca, n_reca, sticker, fecha_servicio, personal, cliente, razon_social, planta,
        dep_planta, cod_metrica, cod_int, tipo_equipo, marca, modelo, serie, unidades, cap_max1, cap_max2,
        tipo_servicio, versiones
      FROM vigentes WHERE ${where}
      ORDER BY fecha_servicio DESC, seca, codigo_registro`),
    cargarUsuarios(),
  ]);

  const servicios = result.recordset.map((row) => {
    const tecnicoReconocido = identificarTecnico(row.personal, usuarios);
    const seca = leerSeca(row.seca);
    return {
      codigo: clean(row.codigo_registro),
      fecha: fechaTexto(row.fecha_servicio),
      seca: seca?.original || null,
      negociacion: seca?.negociacion || null,
      secaLibro: seca?.libro || null,
      reca: leerReca(row.n_reca)?.texto || clean(row.n_reca),
      sticker: clean(row.sticker),
      tipoServicio: clean(row.tipo_servicio),
      tecnico: {
        original: tecnicoReconocido.original,
        usuario: tecnicoReconocido.usuario || null,
        iniciales: tecnicoReconocido.iniciales || null,
      },
      cliente: clean(row.cliente),
      razonSocial: clean(row.razon_social),
      planta: clean(row.planta),
      departamento: clean(row.dep_planta),
      instrumento: {
        codigoMetrica: clean(row.cod_metrica),
        codigoInterno: clean(row.cod_int),
        tipo: clean(row.tipo_equipo),
        marca: clean(row.marca),
        modelo: clean(row.modelo),
        serie: clean(row.serie),
        max: row.cap_max1 == null ? null : Number(row.cap_max1),
        multirango: Number(row.cap_max2) > 0,
        unidad: clean(row.unidades),
      },
      // Aún no hay registro de calibración en DataMET+ (fase 4).
      estado: 'PENDIENTE',
      versiones: row.versiones,
    };
  });

  return {
    servicios: tecnico
      ? servicios.filter(servicio => servicio.tecnico.usuario && clave(servicio.tecnico.usuario) === clave(tecnico))
      : servicios,
  };
};

/** Un servicio con su modelo completo y los avisos de calidad de datos. */
const getServicio = async (codigo) => {
  const result = await getPool().request()
    .input('codigo', sql.NVarChar(100), codigo)
    .query(`${VIGENTES} SELECT * FROM vigentes WHERE rn = 1 AND codigo_registro = @codigo`);
  const fila = result.recordset[0];
  if (!fila) throw httpError(404, 'El servicio no existe o fue anulado en ServiceMET.');
  const contexto = await cargarContexto();
  const { modelo, avisos } = modeloDeFila(fila, contexto);
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
  getServicio,
  listarServicios,
  revisarServicios,
};
