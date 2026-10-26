/**
 * Columnas de las tablas DATA_SERVICIOS_DATOS_* y valores del informe: qué
 * campos se editan, cómo se leen de SQL Server y cómo se convierte lo que
 * llega del formulario al tipo de cada columna.
 */
const { getPool, sql } = require('../config/db');
const { TIPOS } = require('./soporte.tipos');
const { httpError, text } = require('./soporte.validation');

// ─── Columnas ──────────────────────────────────────────────────────────────

/** Columnas de sistema o de identidad del servicio: nunca se editan. */
const PROTEGIDAS = new Set([
  'n', 'id', 'codigo_registro', 'otst', 'cod_metrica', 'cod_planta', 'session_id',
  'tipo_servicio', 'estado_servicio', 'estado_servicio_csv', 'nombre_zip', 'inf_bal',
  'foto_balanza', 'categoria_balanza', 'hora_inicio', 'hora_fin',
]);

const esEditable = (nombre, meta) => Boolean(meta)
  && !PROTEGIDAS.has(nombre)
  && !nombre.endsWith('_foto')
  && meta.tipo !== 'fechahora'
  && meta.tipo !== 'otro';

const TIPO_COLUMNA = {
  nvarchar: 'texto', varchar: 'texto', nchar: 'texto', char: 'texto', ntext: 'texto', text: 'texto',
  int: 'entero', bigint: 'entero', smallint: 'entero', tinyint: 'entero', bit: 'entero',
  decimal: 'decimal', numeric: 'decimal', float: 'decimal', real: 'decimal', money: 'decimal',
  date: 'fecha',
  time: 'hora',
  datetime: 'fechahora', datetime2: 'fechahora', smalldatetime: 'fechahora', datetimeoffset: 'fechahora',
};

/** Fila de INFORMATION_SCHEMA.COLUMNS → { tipo, max }. */
const mapColumna = (row) => {
  const tipo = TIPO_COLUMNA[String(row.DATA_TYPE).toLowerCase()] || 'otro';
  const largo = Number(row.CHARACTER_MAXIMUM_LENGTH);
  return {
    tipo,
    max: tipo === 'texto' ? (largo > 0 ? largo : 4000) : null,
  };
};

const cacheColumnas = new Map();

/** Columnas de la tabla del tipo; se leen una vez por proceso. */
const columnasDe = async (tipo) => {
  if (cacheColumnas.has(tipo)) return cacheColumnas.get(tipo);
  const result = await getPool().request()
    .input('tabla', sql.NVarChar(128), TIPOS[tipo].tabla)
    .query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @tabla
      ORDER BY ORDINAL_POSITION;`);
  const columnas = new Map(result.recordset.map(row => [row.COLUMN_NAME, mapColumna(row)]));
  if (columnas.size === 0) throw httpError(503, `La tabla ${TIPOS[tipo].tabla} no existe en la base.`);
  cacheColumnas.set(tipo, columnas);
  return columnas;
};

// ─── Valores ───────────────────────────────────────────────────────────────

const pad = (value) => String(value).padStart(2, '0');

/** Valor leído de SQL Server, listo para JSON. */
const normalizarValor = (valor, meta) => {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    if (meta?.tipo === 'hora') return `${pad(valor.getUTCHours())}:${pad(valor.getUTCMinutes())}`;
    if (meta?.tipo === 'fecha') return valor.toISOString().slice(0, 10);
    return valor.toISOString();
  }
  if (Buffer.isBuffer(valor)) return null;
  if (typeof valor === 'string') return text(valor) || null;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  return valor;
};

/** Fila original del servicio con valores normalizados. */
const normalizarFuente = (row, columnas) => Object.fromEntries(
  Object.entries(row).map(([campo, valor]) => [campo, normalizarValor(valor, columnas.get(campo))]),
);

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/**
 * Convierte el valor que llega del formulario al tipo de la columna. Vacío
 * es null. Lanza 400 con un mensaje para el usuario si no es válido.
 */
const coercer = (campo, meta, valor) => {
  if (valor === null || valor === undefined) return null;
  const crudo = typeof valor === 'string' ? text(valor) : valor;
  if (crudo === '') return null;

  switch (meta.tipo) {
    case 'texto': {
      const value = String(crudo);
      if (value.length > meta.max) throw httpError(400, `«${campo}» admite como máximo ${meta.max} caracteres.`);
      return value;
    }
    case 'entero':
    case 'decimal': {
      const numero = typeof crudo === 'number' ? crudo : Number(String(crudo).replace(',', '.'));
      if (!Number.isFinite(numero) || Math.abs(numero) >= 1e12) throw httpError(400, `«${campo}» debe ser un número.`);
      if (meta.tipo === 'entero' && !Number.isInteger(numero)) throw httpError(400, `«${campo}» debe ser un número entero.`);
      return numero;
    }
    case 'fecha': {
      const match = FECHA.exec(String(crudo));
      const fecha = match ? new Date(`${crudo}T00:00:00Z`) : null;
      if (!fecha || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== crudo) {
        throw httpError(400, `«${campo}» debe ser una fecha válida.`);
      }
      return crudo;
    }
    case 'hora': {
      const match = HORA.exec(String(crudo));
      if (!match) throw httpError(400, `«${campo}» debe ser una hora (HH:MM).`);
      return `${match[1]}:${match[2]}`;
    }
    default:
      throw httpError(400, `«${campo}» no se puede editar.`);
  }
};

const iguales = (a, b) => {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
};

/** Valor que muestra el informe: el corregido si lo hay, si no el original. */
const valorEfectivo = (campo, fuente, datos) => (
  Object.prototype.hasOwnProperty.call(datos, campo) ? datos[campo] : (fuente[campo] ?? null)
);

/**
 * Aplica los cambios entrantes sobre los datos corregidos del informe. Un
 * campo que vuelve a su valor original deja de figurar como corregido.
 * Devuelve los datos nuevos y la lista de cambios reales (antes → después).
 */
const planCambios = ({ fuente, datos, entrantes, columnas }) => {
  const nuevos = { ...datos };
  const cambios = [];
  for (const [campo, valor] of Object.entries(entrantes)) {
    const meta = columnas.get(campo);
    if (!esEditable(campo, meta)) throw httpError(400, `El campo «${campo}» no se puede editar.`);
    const despues = coercer(campo, meta, valor);
    const antes = valorEfectivo(campo, fuente, datos);
    if (iguales(despues, fuente[campo] ?? null)) delete nuevos[campo];
    else nuevos[campo] = despues;
    if (!iguales(antes, despues)) cambios.push({ campo, antes, despues });
  }
  return { datos: ordenarClaves(nuevos), cambios };
};

const ordenarClaves = (objeto) => Object.fromEntries(
  Object.keys(objeto).sort().map(clave => [clave, objeto[clave]]),
);

const leerDatos = (json) => {
  try {
    const value = JSON.parse(json || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

const iso = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null);
const fechaIso = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : null);

/** Columnas que el formulario puede editar, con su tipo y largo máximo. */
const columnasEditables = (columnas) => Object.fromEntries(
  [...columnas.entries()].filter(([nombre, meta]) => esEditable(nombre, meta)),
);

module.exports = {
  PROTEGIDAS,
  coercer,
  columnasDe,
  columnasEditables,
  esEditable,
  fechaIso,
  iguales,
  iso,
  leerDatos,
  mapColumna,
  normalizarFuente,
  planCambios,
};
