/**
 * Tiempos de servicio de Calibración (KPI del personal). Cada servicio
 * vigente de DATA_SERVICIOS_DATOS_CALIBRACION (la última fila de su
 * `codigo_registro`, sin los anulados) con:
 *
 * - inicio: `hora_inicio` (no se corrige); si falta, `hora` (la de las
 *   condiciones ambientales iniciales), como en el registro del servicio.
 * - fin: `hora_fin`, la de las condiciones ambientales finales, que se toman
 *   al terminar. Si el registro la corrigió (CAL_REGISTROS), vale la corregida.
 *
 * El técnico se reconoce contra DATA_USERS como en el registro del servicio,
 * así sus variantes («Ing. Jorge Ortuño R.», «JORGE ORTUNO») suman juntas. Los
 * servicios se agrupan por la capacidad máxima del instrumento. Los ve quien
 * tiene el permiso `tiempos.calibracion.ver` de Gestión de permisos (de inicio,
 * Sistemas y los jefes de área de todas las áreas), sea o no del área.
 */
const { getPool, sql } = require('../config/db');
const permisos = require('./permisos');
const { identificarTecnico } = require('./calibration.fuente');
const { claveTecnico } = require('./soporte.lista');
const { fechaTexto, horaTexto, leerPeriodo, texto } = require('./tiempos');

/** Rangos de capacidad máxima (en kg) para comparar servicios parecidos. */
const RANGOS = [
  { id: 'HASTA_1KG', nombre: 'Hasta 1 kg', corto: 'Hasta 1 kg', hasta: 1 },
  { id: 'HASTA_60KG', nombre: 'Más de 1 kg hasta 60 kg', corto: '1 a 60 kg', hasta: 60 },
  { id: 'HASTA_1500KG', nombre: 'Más de 60 kg hasta 1 500 kg', corto: '60 kg a 1,5 t', hasta: 1500 },
  { id: 'MAS_1500KG', nombre: 'Más de 1 500 kg', corto: 'Más de 1,5 t', hasta: Infinity },
];
// Sin capacidad: un grupo «Otros», sin color propio en los gráficos.
const SIN_CAPACIDAD = { id: 'SIN_CAPACIDAD', nombre: 'Sin capacidad registrada', corto: 'Sin capacidad', otros: true };
const GRUPOS = [...RANGOS, SIN_CAPACIDAD].map(({ id, nombre, corto, otros }) => ({ id, nombre, corto, ...(otros ? { otros } : {}) }));

const FACTOR_KG = { mg: 1e-6, g: 1e-3, kg: 1, t: 1000 };

/** Capacidad máxima del instrumento en kg (la mayor de sus rangos), o null. */
const capacidadKg = (fila) => {
  const factor = FACTOR_KG[String(fila.unidades ?? '').trim().toLowerCase()];
  const maximos = [fila.cap_max1, fila.cap_max2, fila.cap_max3].map(Number).filter(valor => Number.isFinite(valor) && valor > 0);
  if (!factor || maximos.length === 0) return null;
  return Math.max(...maximos) * factor;
};

const rangoDe = (kg) => (kg == null ? SIN_CAPACIDAD : RANGOS.find(rango => kg <= rango.hasta)).id;

/** Correcciones del registro (columna → valor), si las hay. */
const columnasCorregidas = (json) => {
  try {
    const datos = JSON.parse(json || '{}');
    return datos?.columnas && typeof datos.columnas === 'object' ? datos.columnas : {};
  } catch {
    return {};
  }
};

/** Nombre con que se agrupa al técnico: el de DATA_USERS o, si no se reconoce, el escrito sin título. */
const tecnicoDe = (personal, usuarios) => {
  const tecnico = identificarTecnico(personal, usuarios);
  if (tecnico.usuario) return tecnico.nombre || tecnico.usuario;
  if (tecnico.motivo === 'GENERICO') return null;
  return claveTecnico(personal);
};

/** Una fila de la consulta como servicio de los tiempos. */
const mapServicio = (fila, usuarios = []) => {
  const corregidas = columnasCorregidas(fila.registro_datos);
  const corregida = (columna, original) => (Object.prototype.hasOwnProperty.call(corregidas, columna)
    ? horaTexto(corregidas[columna]) : horaTexto(original));
  return {
    codigo: fila.codigo_registro,
    grupo: rangoDe(capacidadKg(fila)),
    orden: texto(fila.seca),
    fecha: fechaTexto(fila.fecha_servicio),
    inicio: horaTexto(fila.hora_inicio) || corregida('hora', fila.hora),
    fin: corregida('hora_fin', fila.hora_fin),
    tecnico: tecnicoDe(fila.personal, usuarios),
    cliente: texto(fila.cliente),
    planta: texto(fila.planta),
    codMetrica: texto(fila.cod_metrica),
    equipo: texto(fila.tipo_equipo),
  };
};

/** Permiso con nombre de los tiempos de servicio (Gestión de permisos). */
const PERMISO_TIEMPOS = 'tiempos.calibracion.ver';

const exigirTiempos = (user) => permisos.exigirPermiso(user, PERMISO_TIEMPOS,
  'No tienes permiso para ver los tiempos de servicio de Calibración. Lo concede Sistemas en Gestión de permisos.');

const consultaTiempos = (conRegistros) => `
  WITH vigentes AS (
    SELECT t.codigo_registro, t.seca, t.fecha_servicio, t.hora_inicio, t.hora, t.hora_fin, t.personal,
      t.cliente, t.planta, t.cod_metrica, t.tipo_equipo, t.cap_max1, t.cap_max2, t.cap_max3, t.unidades,
      ROW_NUMBER() OVER (PARTITION BY t.codigo_registro ORDER BY t.n DESC) AS rn
    FROM dbo.DATA_SERVICIOS_DATOS_CALIBRACION t
    WHERE t.codigo_registro IS NOT NULL AND ISNULL(t.estado_servicio_csv, N'') <> N'ANULADO'
  )
  SELECT v.*, ${conRegistros ? 'r.datos' : 'NULL'} AS registro_datos
  FROM vigentes v
  ${conRegistros ? 'LEFT JOIN dbo.CAL_REGISTROS r ON r.codigo_registro = v.codigo_registro' : ''}
  WHERE v.rn = 1 AND v.fecha_servicio BETWEEN @desde AND @hasta
  ORDER BY v.fecha_servicio, v.hora_inicio, v.codigo_registro;`;

/** Servicios del período con sus horas, y los rangos de capacidad con que se agrupan. */
const getTiempos = async (query, user) => {
  await exigirTiempos(user);
  const { desde, hasta } = leerPeriodo(query);
  const pool = getPool();
  const [existe, usuarios] = await Promise.all([
    pool.request().query(`SELECT OBJECT_ID('dbo.CAL_REGISTROS', 'U') AS id`),
    // Para reconocer al técnico (también los dados de baja). Sin contraseñas.
    pool.request().query('SELECT id, usuario, nombre1, apellido1, apellido2, inicial, estado FROM DATA_USERS'),
  ]);
  const [result, primero] = await Promise.all([
    pool.request()
      .input('desde', sql.Date, new Date(`${desde}T00:00:00Z`))
      .input('hasta', sql.Date, new Date(`${hasta}T00:00:00Z`))
      .query(consultaTiempos(existe.recordset[0]?.id != null)),
    // Antes del primer servicio no hay datos: un período anterior a él no sirve para comparar.
    pool.request().query(`SELECT MIN(fecha_servicio) AS primero FROM dbo.DATA_SERVICIOS_DATOS_CALIBRACION
      WHERE codigo_registro IS NOT NULL AND ISNULL(estado_servicio_csv, N'') <> N'ANULADO'`),
  ]);
  return {
    desde,
    hasta,
    primerServicio: fechaTexto(primero.recordset[0]?.primero),
    grupos: GRUPOS,
    servicios: result.recordset.map(fila => mapServicio(fila, usuarios.recordset)),
  };
};

module.exports = { GRUPOS, PERMISO_TIEMPOS, capacidadKg, getTiempos, mapServicio, rangoDe };
