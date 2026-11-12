/**
 * Patrones de calibración: qué tipo de patrón es cada equipo, las piezas de
 * cada juego de pesas y, para el certificado vigente, los valores que usará
 * el cálculo de los certificados de balanzas: corrección, U y k de cada
 * pieza, o de cada punto de temperatura, humedad y presión.
 *
 * Reemplaza lo que el libro F-VMET-02-7.2 copia de Access (EQUI_VIGENTE y
 * VALORES). Los valores cuelgan del certificado vigente (CAL_CERTIFICADOS):
 * cambiarlos lo deja pendiente de revisión y quien hizo el último cambio no
 * puede revisarlos (NB/ISO/IEC 17025, 7.11.6). Cada cambio guarda en el historial
 * del equipo la versión anterior y la nueva completas (7.5.2).
 */
const { getPool, sql } = require('../config/db');
const { clean, httpError, withTransaction } = require('./calibration.db');
const {
  archiveCurrentIfMissing,
  assertActive,
  expiryDate,
  findActor,
  loadEquipo,
  logAction,
} = require('./calibration.equipment');
const { conflictingAuthor, ultimoAutor } = require('./calibration.history');

// ─── OIML R111-1:2004 ──────────────────────────────────────────────────────

const CLASES = ['E1', 'E2', 'F1', 'F2', 'M1', 'M1-2', 'M2', 'M2-3', 'M3'];
const MAGNITUDES = { T: 'temperatura', HR: 'humedad', P: 'presión' };

const KG = 1e6;
const G = 1e3;

/**
 * Tabla 1: error máximo permitido (± mg) por valor nominal y clase. null: la
 * clase no tiene ese valor nominal (no se extrapola).
 */
const EMP_TABLA = [
  //  nominal     E1     E2     F1      F2      M1      M1-2     M2       M2-3     M3
  [5000 * KG, null, null, 25000, 80000, 250000, 500000, 800000, 1600000, 2500000],
  [2000 * KG, null, null, 10000, 30000, 100000, 200000, 300000, 600000, 1000000],
  [1000 * KG, null, 1600, 5000, 16000, 50000, 100000, 160000, 300000, 500000],
  [500 * KG, null, 800, 2500, 8000, 25000, 50000, 80000, 160000, 250000],
  [200 * KG, null, 300, 1000, 3000, 10000, 20000, 30000, 60000, 100000],
  [100 * KG, null, 160, 500, 1600, 5000, 10000, 16000, 30000, 50000],
  [50 * KG, 25, 80, 250, 800, 2500, 5000, 8000, 16000, 25000],
  [20 * KG, 10, 30, 100, 300, 1000, null, 3000, null, 10000],
  [10 * KG, 5, 16, 50, 160, 500, null, 1600, null, 5000],
  [5 * KG, 2.5, 8, 25, 80, 250, null, 800, null, 2500],
  [2 * KG, 1, 3, 10, 30, 100, null, 300, null, 1000],
  [1 * KG, 0.5, 1.6, 5, 16, 50, null, 160, null, 500],
  [500 * G, 0.25, 0.8, 2.5, 8, 25, null, 80, null, 250],
  [200 * G, 0.1, 0.3, 1, 3, 10, null, 30, null, 100],
  [100 * G, 0.05, 0.16, 0.5, 1.6, 5, null, 16, null, 50],
  [50 * G, 0.03, 0.1, 0.3, 1, 3, null, 10, null, 30],
  [20 * G, 0.025, 0.08, 0.25, 0.8, 2.5, null, 8, null, 25],
  [10 * G, 0.02, 0.06, 0.2, 0.6, 2, null, 6, null, 20],
  [5 * G, 0.016, 0.05, 0.16, 0.5, 1.6, null, 5, null, 16],
  [2 * G, 0.012, 0.04, 0.12, 0.4, 1.2, null, 4, null, 12],
  [1 * G, 0.01, 0.03, 0.1, 0.3, 1, null, 3, null, 10],
  [500, 0.008, 0.025, 0.08, 0.25, 0.8, null, 2.5, null, null],
  [200, 0.006, 0.02, 0.06, 0.2, 0.6, null, 2, null, null],
  [100, 0.005, 0.016, 0.05, 0.16, 0.5, null, 1.6, null, null],
  [50, 0.004, 0.012, 0.04, 0.12, 0.4, null, null, null, null],
  [20, 0.003, 0.01, 0.03, 0.1, 0.3, null, null, null, null],
  [10, 0.003, 0.008, 0.025, 0.08, 0.25, null, null, null, null],
  [5, 0.003, 0.006, 0.02, 0.06, 0.2, null, null, null, null],
  [2, 0.003, 0.006, 0.02, 0.06, 0.2, null, null, null, null],
  [1, 0.003, 0.006, 0.02, 0.06, 0.2, null, null, null, null],
];

const sameNominal = (a, b) => Math.abs(Number(a) - Number(b)) <= Math.abs(Number(b)) * 1e-9;

/** Error máximo permitido en mg, o null si la clase no tiene ese valor nominal. */
const empR111 = (clase, nominalMg) => {
  const columna = CLASES.indexOf(clase);
  if (columna < 0) return null;
  const fila = EMP_TABLA.find(([nominal]) => sameNominal(nominalMg, nominal));
  return fila ? fila[columna + 1] : null;
};

/**
 * Tabla 5: densidad mínima y máxima (kg/m³). La fila «≥ 100 g» vale para
 * todas las pesas de 100 g o más; el resto, solo para su valor nominal. Sin
 * fila o sin clase en la fila: no hay límite.
 */
const DENSIDAD_TABLA = [
  [100 * G, { E1: [7934, 8067], E2: [7810, 8210], F1: [7390, 8730], F2: [6400, 10700], M1: [4400, null], 'M1-2': [3000, null], M2: [2300, null], 'M2-3': [1500, null] }],
  [50 * G, { E1: [7920, 8080], E2: [7740, 8280], F1: [7270, 8890], F2: [6000, 12000], M1: [4000, null] }],
  [20 * G, { E1: [7840, 8170], E2: [7500, 8570], F1: [6600, 10100], F2: [4800, 24000], M1: [2600, null] }],
  [10 * G, { E1: [7740, 8280], E2: [7270, 8890], F1: [6000, 12000], F2: [4000, null], M1: [2000, null] }],
  [5 * G, { E1: [7620, 8420], E2: [6900, 9600], F1: [5300, 16000], F2: [3000, null] }],
  [2 * G, { E1: [7270, 8890], E2: [6000, 12000], F1: [4000, null], F2: [2000, null] }],
  [1 * G, { E1: [6900, 9600], E2: [5300, 16000], F1: [3000, null] }],
  [500, { E1: [6300, 10900], E2: [4400, null], F1: [2200, null] }],
  [200, { E1: [5300, 16000], E2: [3000, null] }],
  [100, { E1: [4400, null] }],
  [50, { E1: [3400, null] }],
  [20, { E1: [2300, null] }],
];

const densidadR111 = (clase, nominalMg) => {
  const fila = Number(nominalMg) >= 100 * G
    ? DENSIDAD_TABLA[0]
    : DENSIDAD_TABLA.find(([nominal]) => sameNominal(nominalMg, nominal));
  const limites = fila?.[1][clase];
  return limites ? { min: limites[0], max: limites[1] } : null;
};

// ─── Reglas puras ──────────────────────────────────────────────────────────

const decimal = (value) => {
  const text = String(Number(Number(value).toPrecision(12)));
  return text.replace('.', ',');
};

/** «500 mg», «1 g», «20 kg». */
const formatNominal = (mg) => {
  const value = Number(mg);
  if (value >= KG) return `${decimal(value / KG)} kg`;
  if (value >= G) return `${decimal(value / G)} g`;
  return `${decimal(value)} mg`;
};

const piezaKey = ({ nominalMg, identificacion }) => `${Number(nominalMg)}|${identificacion || ''}`;
const piezaLabel = (pieza) => `${formatNominal(pieza.nominalMg)}${pieza.identificacion ? ` ${pieza.identificacion}` : ''}`;

/** Tipo de patrón según el nombre del instrumento en DATA_EQUIPOS_CAL. */
const tipoSugerido = (instrumento) => {
  const texto = String(instrumento || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (texto.includes('pesa')) return 'PESAS';
  if (/termo|higro|barom/.test(texto)) return 'AMBIENTE';
  return null;
};

/** Clase según el código del juego (E2-003, F1-101, M1-1-20XX). */
const claseSugerida = (codigo) => {
  const match = String(codigo || '').trim().toUpperCase().match(/^(E1|E2|F1|F2|M1|M2|M3)(?=[-\s])/);
  return match ? match[1] : null;
};

/**
 * Pieza apta para su clase solo con los valores de su certificado. Con el
 * criterio R111 (el inicial): U (k = 2) ≤ emp/3 (5.2) y |corrección| ≤ emp − U
 * (5.3). Con SUMA_EMP, el que puede elegir el laboratorio en el método:
 * |corrección| + U ≤ emp (la 5.3); la 5.2 se informa pero no decide.
 * Devuelve { apta, emp, u2, cumpleU, cumpleCorreccion }; apta es null si no se
 * puede decidir (sin clase, valor nominal que la clase no tiene o sin valores).
 */
const aptaR111 = ({ clase, nominalMg, correccionMg, uMg, k, criterio = 'R111' }) => {
  const emp = clase ? empR111(clase, nominalMg) : null;
  const numeros = [correccionMg, uMg, k].map(v => (v == null || v === '' ? Number.NaN : Number(v)));
  if (emp === null || numeros.some(v => !Number.isFinite(v)) || !(numeros[2] > 0)) {
    return { apta: null, emp, u2: null, cumpleU: null, cumpleCorreccion: null };
  }
  const [correccion, u, kValor] = numeros;
  // R111 5.2 expresa U con k = 2.
  const u2 = (u / kValor) * 2;
  const cumpleU = u2 <= emp / 3 + 1e-12;
  const cumpleCorreccion = Math.abs(correccion) <= emp - u2 + 1e-12;
  const apta = criterio === 'SUMA_EMP' ? cumpleCorreccion : cumpleU && cumpleCorreccion;
  return { apta, emp, u2, cumpleU, cumpleCorreccion };
};

/**
 * Avisos de un juego de pesas según la OIML R111 (no bloquean el registro):
 * piezas sin valores, U mayor que un tercio del emp (5.2), masa convencional
 * fuera de emp − U (5.3) y densidad fuera de la Tabla 5. Con el criterio del
 * laboratorio (SUMA_EMP) la 5.2 queda como dato, sin alerta.
 */
const avisosPesas = ({ clase, piezas, valores, criterio = 'R111' }) => {
  const avisos = [];
  const porPieza = new Map(valores.map(valor => [piezaKey(valor), valor]));
  for (const pieza of piezas.filter(item => item.activa)) {
    const key = piezaKey(pieza);
    const label = piezaLabel(pieza);
    const valor = porPieza.get(key);
    const emp = clase ? empR111(clase, pieza.nominalMg) : null;

    if (clase && emp === null) {
      avisos.push({ tipo: 'aviso', pieza: key, mensaje: `${label}: la clase ${clase} no tiene ese valor nominal (R111, Tabla 1).` });
    }
    if (!valor) {
      avisos.push({ tipo: 'falta', pieza: key, mensaje: `${label}: falta la corrección, la U y el k del certificado.` });
    } else if (emp !== null) {
      const { u2, cumpleU, cumpleCorreccion } = aptaR111({ clase, nominalMg: pieza.nominalMg, ...valor });
      if (cumpleU === false) {
        avisos.push(criterio === 'SUMA_EMP'
          ? { tipo: 'info', pieza: key, mensaje: `${label}: U (k = 2) = ${decimal(u2)} mg supera un tercio del emp de ${clase} (${decimal(emp / 3)} mg; R111 5.2); el criterio del laboratorio no lo exige.` }
          : { tipo: 'aviso', pieza: key, mensaje: `${label}: U (k = 2) = ${decimal(u2)} mg supera un tercio del emp de ${clase} (${decimal(emp / 3)} mg; R111 5.2).` });
      }
      if (cumpleCorreccion === false) {
        avisos.push({ tipo: 'aviso', pieza: key, mensaje: `${label}: la corrección ${decimal(valor.correccionMg)} mg sale de ± (emp − U) = ± ${decimal(Math.max(emp - u2, 0))} mg (R111 5.3).` });
      }
    }

    if (pieza.densidad == null) {
      avisos.push({ tipo: 'info', pieza: key, mensaje: `${label}: sin densidad; el cálculo usará la supuesta por material.` });
    } else {
      const limites = clase ? densidadR111(clase, pieza.nominalMg) : null;
      if (limites && (pieza.densidad < limites.min || (limites.max != null && pieza.densidad > limites.max))) {
        const rango = limites.max != null ? `${limites.min} a ${limites.max}` : `al menos ${limites.min}`;
        avisos.push({ tipo: 'aviso', pieza: key, mensaje: `${label}: densidad ${decimal(pieza.densidad)} kg/m³ fuera de ${rango} kg/m³ para ${clase} (R111, Tabla 5).` });
      }
      if (pieza.densidadU == null) {
        avisos.push({ tipo: 'info', pieza: key, mensaje: `${label}: falta la incertidumbre de la densidad.` });
      }
    }
  }
  return avisos;
};

/** Avisos de un instrumento de condiciones ambientales. */
const avisosAmbiente = ({ puntos }) => {
  const avisos = [];
  const tiene = new Set(puntos.map(punto => punto.magnitud));
  if (puntos.length === 0) {
    avisos.push({ tipo: 'falta', mensaje: 'Faltan los puntos calibrados del certificado.' });
    return avisos;
  }
  for (const magnitud of ['T', 'HR']) {
    if (!tiene.has(magnitud)) {
      avisos.push({ tipo: 'aviso', mensaje: `Sin puntos de ${MAGNITUDES[magnitud]}: el cálculo no podrá usar este certificado para esa magnitud.` });
    }
  }
  if (!tiene.has('P')) {
    avisos.push({ tipo: 'info', mensaje: 'Sin puntos de presión: el cálculo usará la incertidumbre de presión por defecto del método.' });
  }
  return avisos;
};

/**
 * Certificado que regía en una fecha: el último no anulado emitido hasta esa
 * fecha y que no había vencido. null si no había ninguno.
 */
const vigenteEn = (certificados, fecha) => certificados
  .filter(cert => !cert.anulado && cert.fecha && cert.fecha <= fecha && (!cert.vence || cert.vence >= fecha))
  .sort((a, b) => (a.fecha === b.fecha ? b.id - a.id : b.fecha.localeCompare(a.fecha)))[0] || null;

// ─── Historial ─────────────────────────────────────────────────────────────

const piezaVersion = (pieza) => ({
  nominalMg: Number(pieza.nominalMg),
  identificacion: pieza.identificacion || '',
  material: pieza.material || null,
  densidad: pieza.densidad ?? null,
  densidadU: pieza.densidadU ?? null,
  densidadK: pieza.densidadK ?? null,
  densidadOrigen: pieza.densidadOrigen || null,
  activa: Boolean(pieza.activa),
});

const valorVersion = (valor) => ({
  pieza: piezaKey(valor),
  documento: valor.documento || null,
  correccionMg: Number(valor.correccionMg),
  uMg: Number(valor.uMg),
  k: Number(valor.k),
});

const puntoVersion = (punto) => ({
  magnitud: punto.magnitud,
  documento: punto.documento || null,
  temperatura: punto.temperatura ?? null,
  punto: Number(punto.punto),
  correccion: Number(punto.correccion),
  expresadoComo: punto.expresadoComo || 'CORRECCION',
  u: Number(punto.u),
  k: Number(punto.k),
});

const transcripcionVersion = ({
  temperatura, humedad, presion, temperaturaU, humedadU, presionU, condicionesK, observaciones, valores, puntos,
}) => ({
  temperatura: temperatura ?? null,
  humedad: humedad ?? null,
  presion: presion ?? null,
  temperaturaU: temperaturaU ?? null,
  humedadU: humedadU ?? null,
  presionU: presionU ?? null,
  condicionesK: condicionesK ?? null,
  observaciones: observaciones || null,
  valores: [...valores].map(valorVersion).sort((a, b) => a.pieza.localeCompare(b.pieza)),
  puntos: [...puntos].map(puntoVersion).sort((a, b) => (
    `${a.magnitud}|${a.temperatura ?? ''}|${a.punto}`.localeCompare(`${b.magnitud}|${b.temperatura ?? ''}|${b.punto}`)
  )),
});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Una transcripción sin valores, puntos, condiciones ni observaciones. */
const transcripcionVacia = (version) => version.valores.length === 0 && version.puntos.length === 0
  && ['temperatura', 'humedad', 'presion', 'temperaturaU', 'humedadU', 'presionU', 'condicionesK', 'observaciones']
    .every(campo => version[campo] == null);

/** «2 piezas nuevas · 1 modificada · 1 desactivada». */
const resumenPiezas = (antes, despues) => {
  const previas = new Map(antes.map(pieza => [pieza.id, pieza]));
  let nuevas = 0;
  let modificadas = 0;
  let desactivadas = 0;
  for (const pieza of despues) {
    const previa = pieza.id ? previas.get(pieza.id) : null;
    if (!previa) nuevas += 1;
    else if (previa.activa && !pieza.activa) desactivadas += 1;
    else if (!same(piezaVersion(previa), piezaVersion(pieza))) modificadas += 1;
  }
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  return [
    nuevas && plural(nuevas, 'pieza nueva', 'piezas nuevas'),
    modificadas && plural(modificadas, 'pieza modificada', 'piezas modificadas'),
    desactivadas && plural(desactivadas, 'pieza desactivada', 'piezas desactivadas'),
  ].filter(Boolean).join(' · ');
};

// ─── Acceso a datos ────────────────────────────────────────────────────────

const mapPieza = (row) => ({
  id: row.id,
  nominalMg: Number(row.nominal_mg),
  identificacion: row.identificacion || '',
  material: clean(row.material),
  densidad: row.densidad == null ? null : Number(row.densidad),
  densidadU: row.densidad_u == null ? null : Number(row.densidad_u),
  densidadK: row.densidad_k == null ? null : Number(row.densidad_k),
  densidadOrigen: row.densidad_origen || null,
  activa: Boolean(row.activa),
  orden: row.orden,
});

const loadPiezas = async (createRequest, equipoId, { lock = false } = {}) => {
  const result = await createRequest()
    .input('eid', sql.Int, equipoId)
    .query(`
      SELECT id, nominal_mg, identificacion, material, densidad, densidad_u, densidad_k,
        densidad_origen, activa, orden
      FROM dbo.CAL_PATRON_PIEZAS ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
      WHERE equipo_id = @eid
      ORDER BY nominal_mg DESC, identificacion, id
    `);
  return result.recordset.map(mapPieza);
};

const loadConfig = async (createRequest, equipoId, { lock = false } = {}) => {
  const result = await createRequest()
    .input('eid', sql.Int, equipoId)
    .query(`
      SELECT tipo, clase, actualizado_por, CONVERT(varchar(19), actualizado_en, 126) AS actualizado_en
      FROM dbo.CAL_PATRONES ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE equipo_id = @eid
    `);
  const row = result.recordset[0];
  return row ? { tipo: row.tipo, clase: row.clase || null, actualizadoPor: clean(row.actualizado_por) } : null;
};

/** Fila de CAL_CERTIFICADOS del certificado vigente, sin crearla. */
const findVigente = async (createRequest, equipo) => {
  if (!equipo.certFecha) return null;
  const result = await createRequest()
    .input('eid', sql.Int, equipo.id)
    .input('fecha', sql.Date, equipo.certFecha)
    .input('numero', sql.NVarChar(100), equipo.certificado || '')
    .query(`
      SELECT TOP 1 id, registrado_por, CONVERT(varchar(23), registrado_en, 126) AS registrado_en,
        corregido_por, CONVERT(varchar(23), corregido_en, 126) AS corregido_en, revisado_por,
        CONVERT(varchar(19), revisado_en, 126) AS revisado_en, revision_obs
      FROM dbo.CAL_CERTIFICADOS
      WHERE equipo_id = @eid AND cert_fecha = @fecha AND anulado = 0 AND ISNULL(certificado, '') = @numero
      ORDER BY id DESC
    `);
  return result.recordset[0] || null;
};

// Las consultas van una tras otra: dentro de una transacción mssql no admite
// dos peticiones a la vez en la misma conexión.
const loadTranscripcion = async (createRequest, certificadoId, { lock = false } = {}) => {
  const hint = lock ? 'WITH (UPDLOCK, HOLDLOCK)' : '';
  const cabecera = await createRequest().input('cid', sql.Int, certificadoId).query(`
    SELECT temperatura, humedad, presion, temperatura_u, humedad_u, presion_u, condiciones_k,
      observaciones, transcrito_por, CONVERT(varchar(23), transcrito_en, 126) AS transcrito_en, version
    FROM dbo.CAL_CERT_TRANSCRIPCION ${hint} WHERE certificado_id = @cid
  `);
  const valores = await createRequest().input('cid', sql.Int, certificadoId).query(`
    SELECT v.pieza_id, p.nominal_mg, p.identificacion, v.documento, v.correccion_mg, v.u_mg, v.k, v.conforme
    FROM dbo.CAL_CERT_VALORES v ${hint}
    JOIN dbo.CAL_PATRON_PIEZAS p ON p.id = v.pieza_id
    WHERE v.certificado_id = @cid
    ORDER BY p.nominal_mg DESC, p.identificacion
  `);
  const puntos = await createRequest().input('cid', sql.Int, certificadoId).query(`
    SELECT magnitud, documento, temperatura, punto, correccion, expresado_como, u, k
    FROM dbo.CAL_CERT_PUNTOS ${hint} WHERE certificado_id = @cid
    ORDER BY CASE magnitud WHEN 'T' THEN 1 WHEN 'HR' THEN 2 ELSE 3 END, temperatura, punto
  `);
  const row = cabecera.recordset[0];
  const numero = (value) => (value == null ? null : Number(value));
  return {
    cabecera: row ? {
      temperatura: row.temperatura == null ? null : Number(row.temperatura),
      humedad: row.humedad == null ? null : Number(row.humedad),
      presion: row.presion == null ? null : Number(row.presion),
      temperaturaU: numero(row.temperatura_u),
      humedadU: numero(row.humedad_u),
      presionU: numero(row.presion_u),
      condicionesK: numero(row.condiciones_k),
      observaciones: clean(row.observaciones),
      transcritoPor: clean(row.transcrito_por),
      transcritoEn: row.transcrito_en ? `${row.transcrito_en}Z` : null,
      version: row.version,
    } : null,
    valores: valores.recordset.map(item => ({
      piezaId: item.pieza_id,
      nominalMg: Number(item.nominal_mg),
      identificacion: item.identificacion || '',
      documento: clean(item.documento),
      correccionMg: Number(item.correccion_mg),
      uMg: Number(item.u_mg),
      k: Number(item.k),
      conforme: item.conforme == null ? null : Boolean(item.conforme),
    })),
    puntos: puntos.recordset.map(item => ({
      magnitud: item.magnitud,
      documento: clean(item.documento),
      temperatura: numero(item.temperatura),
      punto: Number(item.punto),
      correccion: Number(item.correccion),
      expresadoComo: item.expresado_como || 'CORRECCION',
      u: Number(item.u),
      k: Number(item.k),
    })),
  };
};

/** Estado de la verificación de los valores, visto por quien consulta. */
const verificacionDe = ({ vigente, transcripcion, who }) => {
  if (!transcripcion) return { estado: 'SIN_VALORES' };
  if (vigente?.revisado_por) {
    return {
      estado: 'VERIFICADO',
      revisadoPor: clean(vigente.revisado_por),
      revisadoEn: vigente.revisado_en ? `${vigente.revisado_en}Z` : null,
      observaciones: clean(vigente.revision_obs),
    };
  }
  // Solo quien hizo el último cambio (registrar, corregir o transcribir) queda fuera.
  const ultimo = ultimoAutor([
    { usuario: clean(vigente?.registrado_por), en: vigente?.registrado_en },
    { usuario: clean(vigente?.corregido_por), en: vigente?.corregido_en },
    { usuario: transcripcion.transcritoPor, en: transcripcion.transcritoEn },
  ]);
  const autor = conflictingAuthor([who.usuario, who.registro], [ultimo]);
  return {
    estado: 'PENDIENTE',
    puedeRevisar: !autor,
    motivo: autor ? 'Hiciste el último cambio de este certificado o de sus valores: debe verificarlo otra persona.' : null,
  };
};

// ─── Operaciones ───────────────────────────────────────────────────────────

/** Ficha del patrón: tipo, clase, piezas y valores del certificado vigente. */
const getPatron = async (equipoId, user = null) => {
  const createRequest = () => getPool().request();
  const equipo = await loadEquipo(createRequest, equipoId);
  const [config, piezasGuardadas, conValores, vigente, who] = await Promise.all([
    loadConfig(createRequest, equipoId),
    loadPiezas(createRequest, equipoId),
    piezasConValores(createRequest, equipoId),
    findVigente(createRequest, equipo),
    user ? findActor(createRequest, user) : Promise.resolve({ usuario: null, registro: null }),
  ]);
  // conValores: corregir su valor nominal o su identificación pide motivo.
  const piezas = piezasGuardadas.map(pieza => ({ ...pieza, conValores: conValores.has(pieza.id) }));
  const datos = vigente
    ? await loadTranscripcion(createRequest, vigente.id)
    : { cabecera: null, valores: [], puntos: [] };

  const tipo = config?.tipo || tipoSugerido(equipo.instrumento);
  const clase = config ? config.clase : claseSugerida(equipo.codigo);
  // Materiales de la tabla de densidades del método vigente (R111, Tabla B.7).
  // Se carga aquí: calibration.metodo depende de este módulo.
  const { motor } = await require('./calibration.metodo').configuracionVigente();
  const materiales = (motor.densidades || []).map(({ material, claves, rho, u }) => ({ material, claves, rho, u }));
  // Criterio de aptitud de las pesas que eligió el laboratorio en el método vigente.
  const criterio = motor.pesas?.aptitud || 'R111';
  let avisos = [];
  if (tipo === 'PESAS' && equipo.certFecha) avisos = avisosPesas({ clase, piezas, valores: datos.valores, criterio });
  if (tipo === 'AMBIENTE' && equipo.certFecha) avisos = avisosAmbiente({ puntos: datos.puntos });

  return {
    equipo: {
      id: equipo.id,
      codigo: equipo.codigo,
      instrumento: equipo.instrumento,
      planta: equipo.planta,
      estado: equipo.estado,
    },
    patron: { configurado: Boolean(config), tipo, clase },
    piezas,
    certificado: equipo.certFecha ? {
      id: vigente?.id ?? null,
      numero: equipo.certificado,
      fecha: equipo.certFecha,
      vence: expiryDate(equipo.certFecha, equipo.periodoDias),
      ente: equipo.enteCalibrador,
    } : null,
    transcripcion: datos.cabecera,
    valores: datos.valores.map(valor => ({ ...valor, apta: aptaR111({ clase, ...valor, criterio }).apta })),
    criterioPesas: criterio,
    puntos: datos.puntos,
    // Para calcular «Apta» mientras se escribe, con la clase elegida.
    r111: { clases: CLASES, emp: EMP_TABLA },
    materiales,
    verificacion: equipo.certFecha ? verificacionDe({ vigente, transcripcion: datos.cabecera, who }) : null,
    avisos,
  };
};

const pesoInput = (request, name, value) => request.input(name, sql.Decimal(18, 6), value);

const writeConfig = (createRequest, equipoId, { tipo, clase }, usuario, existe) => createRequest()
  .input('eid', sql.Int, equipoId)
  .input('tipo', sql.VarChar(10), tipo)
  .input('clase', sql.VarChar(5), tipo === 'PESAS' ? clase : null)
  .input('usuario', sql.NVarChar(50), usuario)
  .query(existe
    ? `UPDATE dbo.CAL_PATRONES SET tipo = @tipo, clase = @clase, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
       WHERE equipo_id = @eid`
    : 'INSERT INTO dbo.CAL_PATRONES (equipo_id, tipo, clase, actualizado_por) VALUES (@eid, @tipo, @clase, @usuario)');

/**
 * Piezas con valores de algún certificado: corregir su valor nominal o su
 * identificación exige motivo y queda en el historial (NB/ISO/IEC 17025, 7.5.2).
 */
const piezasConValores = async (createRequest, equipoId) => {
  const result = await createRequest().input('eid', sql.Int, equipoId).query(`
    SELECT DISTINCT v.pieza_id FROM dbo.CAL_CERT_VALORES v
    JOIN dbo.CAL_PATRON_PIEZAS p ON p.id = v.pieza_id
    WHERE p.equipo_id = @eid
  `);
  return new Set(result.recordset.map(row => row.pieza_id));
};

const savePiezas = async (createRequest, equipoId, piezas, usuario) => {
  const antes = await loadPiezas(createRequest, equipoId, { lock: true });
  const porId = new Map(antes.map(pieza => [pieza.id, pieza]));
  const usadas = await piezasConValores(createRequest, equipoId);

  // Las claves (valor nominal + identificación) no se repiten en el juego,
  // contando las piezas que no se enviaron.
  const enviados = new Set(piezas.filter(pieza => pieza.id).map(pieza => pieza.id));
  const claves = new Map(antes.filter(pieza => !enviados.has(pieza.id)).map(pieza => [piezaKey(pieza), pieza]));
  // Piezas con valores de un certificado a las que se corrige el valor nominal
  // o la identificación (un error de transcripción): se permite con motivo.
  const corregidas = [];
  for (const pieza of piezas) {
    if (pieza.id && !porId.has(pieza.id)) throw httpError(400, 'Una de las piezas no pertenece a este equipo.');
    const key = piezaKey(pieza);
    if (claves.has(key)) throw httpError(400, `La pieza ${piezaLabel(pieza)} está repetida. Distínguelas con una identificación (por ejemplo, «*»).`);
    claves.set(key, pieza);
    const previa = pieza.id ? porId.get(pieza.id) : null;
    if (previa && usadas.has(previa.id) && piezaKey(previa) !== key) {
      corregidas.push({ id: previa.id, antes: piezaLabel(previa), despues: piezaLabel(pieza) });
    }
  }

  // La base no admite dos piezas con la misma clave ni por un instante: las que
  // cambian de clave pasan antes por una temporal. Así se puede, por ejemplo,
  // pasar el «*» de una pieza de 200 g a la otra.
  for (const pieza of piezas) {
    const previa = pieza.id ? porId.get(pieza.id) : null;
    if (!previa || piezaKey(previa) === piezaKey(pieza)) continue;
    await createRequest()
      .input('pid', sql.Int, previa.id)
      .input('eid', sql.Int, equipoId)
      .query(`UPDATE dbo.CAL_PATRON_PIEZAS SET identificacion = CONCAT(N'~', id) WHERE id = @pid AND equipo_id = @eid`);
  }

  const despues = [];
  let orden = 0;
  for (const pieza of piezas) {
    orden += 1;
    const previa = pieza.id ? porId.get(pieza.id) : null;
    if (previa && same(piezaVersion(previa), piezaVersion(pieza)) && previa.orden === orden) {
      despues.push(previa);
      continue;
    }
    const request = createRequest()
      .input('eid', sql.Int, equipoId)
      .input('ident', sql.NVarChar(20), pieza.identificacion || '')
      .input('material', sql.NVarChar(40), pieza.material || null)
      .input('densidad', sql.Decimal(9, 2), pieza.densidad ?? null)
      .input('densidadU', sql.Decimal(9, 2), pieza.densidadU ?? null)
      .input('densidadK', sql.Decimal(5, 2), pieza.densidadK ?? null)
      .input('origen', sql.VarChar(10), pieza.densidadOrigen || null)
      .input('activa', sql.Bit, pieza.activa)
      .input('orden', sql.Int, orden)
      .input('usuario', sql.NVarChar(50), usuario);
    pesoInput(request, 'nominal', pieza.nominalMg);
    if (previa) {
      await request.input('pid', sql.Int, previa.id).query(`
        UPDATE dbo.CAL_PATRON_PIEZAS
        SET nominal_mg = @nominal, identificacion = @ident, material = @material, densidad = @densidad,
          densidad_u = @densidadU, densidad_k = @densidadK, densidad_origen = @origen, activa = @activa,
          orden = @orden, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
        WHERE id = @pid AND equipo_id = @eid
      `);
      despues.push({ ...pieza, id: previa.id, orden });
    } else {
      const result = await request.query(`
        INSERT INTO dbo.CAL_PATRON_PIEZAS
          (equipo_id, nominal_mg, identificacion, material, densidad, densidad_u, densidad_k,
           densidad_origen, activa, orden, registrado_por)
        OUTPUT INSERTED.id
        VALUES (@eid, @nominal, @ident, @material, @densidad, @densidadU, @densidadK, @origen, @activa, @orden, @usuario)
      `);
      despues.push({ ...pieza, id: result.recordset[0].id, orden });
    }
  }

  const resumen = resumenPiezas(antes, despues);
  const todas = [...antes.filter(pieza => !enviados.has(pieza.id)), ...despues];
  return {
    resumen,
    piezas: todas,
    antes: antes.map(piezaVersion),
    despues: todas.map(piezaVersion),
    cambio: Boolean(resumen),
    corregidas,
  };
};

const writeTranscripcion = async (createRequest, certificadoId, piezas, datos, clase, usuario, existe, criterio = 'R111') => {
  const porClave = new Map(piezas.map(pieza => [piezaKey(pieza), pieza]));
  for (const valor of datos.valores) {
    const pieza = porClave.get(piezaKey(valor));
    if (!pieza) throw httpError(400, `La pieza ${piezaLabel(valor)} no está registrada en el juego.`);
    if (!pieza.activa) throw httpError(400, `La pieza ${piezaLabel(valor)} está desactivada: no puede tener valores del certificado vigente.`);
  }

  await createRequest().input('cid', sql.Int, certificadoId).query(`
    DELETE FROM dbo.CAL_CERT_VALORES WHERE certificado_id = @cid;
    DELETE FROM dbo.CAL_CERT_PUNTOS WHERE certificado_id = @cid;
  `);
  for (const valor of datos.valores) {
    const request = createRequest()
      .input('cid', sql.Int, certificadoId)
      .input('pid', sql.Int, porClave.get(piezaKey(valor)).id)
      .input('documento', sql.NVarChar(40), valor.documento || null)
      .input('k', sql.Decimal(5, 2), valor.k)
      // Apta para su clase con los valores del certificado, según el criterio del método vigente.
      .input('conforme', sql.Bit, aptaR111({ clase, ...valor, criterio }).apta);
    pesoInput(request, 'correccion', valor.correccionMg);
    pesoInput(request, 'u', valor.uMg);
    await request.query(`
      INSERT INTO dbo.CAL_CERT_VALORES (certificado_id, pieza_id, documento, correccion_mg, u_mg, k, conforme)
      VALUES (@cid, @pid, @documento, @correccion, @u, @k, @conforme)
    `);
  }
  for (const punto of datos.puntos) {
    await createRequest()
      .input('cid', sql.Int, certificadoId)
      .input('magnitud', sql.VarChar(2), punto.magnitud)
      .input('documento', sql.NVarChar(40), punto.documento || null)
      .input('temperatura', sql.Decimal(6, 2), punto.magnitud === 'HR' ? punto.temperatura ?? null : null)
      .input('punto', sql.Decimal(12, 4), punto.punto)
      .input('correccion', sql.Decimal(12, 4), punto.correccion)
      .input('expresado', sql.VarChar(10), punto.expresadoComo === 'ERROR' ? 'ERROR' : 'CORRECCION')
      .input('u', sql.Decimal(12, 4), punto.u)
      .input('k', sql.Decimal(5, 2), punto.k)
      .query(`
        INSERT INTO dbo.CAL_CERT_PUNTOS (certificado_id, magnitud, documento, temperatura, punto, correccion, expresado_como, u, k)
        VALUES (@cid, @magnitud, @documento, @temperatura, @punto, @correccion, @expresado, @u, @k)
      `);
  }

  const request = createRequest()
    .input('cid', sql.Int, certificadoId)
    .input('t', sql.Decimal(6, 2), datos.temperatura ?? null)
    .input('hr', sql.Decimal(6, 2), datos.humedad ?? null)
    .input('p', sql.Decimal(8, 2), datos.presion ?? null)
    .input('tU', sql.Decimal(6, 2), datos.temperaturaU ?? null)
    .input('hrU', sql.Decimal(6, 2), datos.humedadU ?? null)
    .input('pU', sql.Decimal(8, 2), datos.presionU ?? null)
    .input('k', sql.Decimal(5, 2), datos.condicionesK ?? null)
    .input('obs', sql.NVarChar(300), datos.observaciones || null)
    .input('usuario', sql.NVarChar(50), usuario);
  await request.query(existe
    ? `UPDATE dbo.CAL_CERT_TRANSCRIPCION
       SET temperatura = @t, humedad = @hr, presion = @p, temperatura_u = @tU, humedad_u = @hrU, presion_u = @pU,
         condiciones_k = @k, observaciones = @obs,
         transcrito_por = @usuario, transcrito_en = SYSUTCDATETIME(), version = version + 1
       WHERE certificado_id = @cid`
    : `INSERT INTO dbo.CAL_CERT_TRANSCRIPCION
         (certificado_id, temperatura, humedad, presion, temperatura_u, humedad_u, presion_u, condiciones_k, observaciones, transcrito_por)
       VALUES (@cid, @t, @hr, @p, @tU, @hrU, @pU, @k, @obs, @usuario)`);

  // Cambiar lo transcrito obliga a verificarlo de nuevo contra el original.
  await createRequest().input('cid', sql.Int, certificadoId).query(`
    UPDATE dbo.CAL_CERTIFICADOS SET revisado_por = NULL, revisado_en = NULL, revision_obs = NULL WHERE id = @cid
  `);
};

/**
 * Guarda el tipo y la clase del patrón, sus piezas y los valores del
 * certificado vigente, todo en una transacción.
 */
const savePatron = async (equipoId, data, actor) => withTransaction(async (createRequest) => {
  const equipo = await loadEquipo(createRequest, equipoId, { lock: true });
  assertActive(equipo);
  const who = await findActor(createRequest, actor);
  let cambios = 0;

  // Tipo y clase.
  const config = await loadConfig(createRequest, equipoId, { lock: true });
  const nuevaConfig = { tipo: data.tipo, clase: data.tipo === 'PESAS' ? data.clase : null };
  if (!config || config.tipo !== nuevaConfig.tipo || (config.clase || null) !== nuevaConfig.clase) {
    await writeConfig(createRequest, equipoId, nuevaConfig, who.usuario, Boolean(config));
    const etiqueta = (c) => (c ? `${c.tipo === 'PESAS' ? 'Juego de pesas' : 'Condiciones ambientales'}${c.clase ? ` ${c.clase}` : ''}` : '—');
    await logAction(createRequest, equipoId, 'PATRON', `Tipo de patrón: ${etiqueta(config)} → ${etiqueta(nuevaConfig)}`, who.usuario, {
      antes: config ? { tipo: config.tipo, clase: config.clase } : null,
      despues: nuevaConfig,
    });
    cambios += 1;
  }

  // Piezas.
  let piezas = await loadPiezas(createRequest, equipoId, { lock: true });
  // Como estaban antes de guardar: los valores transcritos se comparan con la
  // pieza que tenían, aunque ahora se corrija su valor nominal o identificación.
  const previasPorId = new Map(piezas.map(pieza => [pieza.id, pieza]));
  if (data.tipo === 'PESAS' && data.piezas) {
    const guardadas = await savePiezas(createRequest, equipoId, data.piezas, who.usuario);
    piezas = guardadas.piezas;
    const { corregidas } = guardadas;
    if (corregidas.length > 0 && !data.motivo) {
      throw httpError(400, `Escribe el motivo de la corrección: ${corregidas[0].antes} ya tiene valores de un certificado.`);
    }
    if (guardadas.cambio) {
      const detalle = corregidas.length > 0
        ? ` · corregida${corregidas.length === 1 ? '' : 's'}: ${corregidas.map(item => `${item.antes} → ${item.despues}`).join(', ')}`
        : '';
      await logAction(createRequest, equipoId, 'PIEZAS', `${guardadas.resumen}${detalle}`, who.usuario, {
        antes: guardadas.antes,
        despues: guardadas.despues,
        motivo: corregidas.length > 0 ? data.motivo : null,
      });
      cambios += 1;
    }
  }

  // Valores del certificado vigente.
  if (data.certificado) {
    if (!equipo.certFecha) throw httpError(409, 'El equipo no tiene certificado vigente. Regístralo antes de transcribir sus valores.');
    if (data.tipo === 'PESAS' && data.certificado.puntos.length > 0) throw httpError(400, 'Un juego de pesas no lleva puntos de temperatura, humedad o presión.');
    if (data.tipo === 'AMBIENTE' && data.certificado.valores.length > 0) throw httpError(400, 'Un instrumento de condiciones ambientales no lleva valores por pieza.');

    const certificadoId = await archiveCurrentIfMissing(createRequest, equipo, who.usuario);
    const previo = await loadTranscripcion(createRequest, certificadoId, { lock: true });
    if (previo.cabecera && data.certificado.version !== previo.cabecera.version) {
      throw httpError(409, `${previo.cabecera.transcritoPor || 'Otra persona'} cambió los valores mientras editabas. Recarga la ficha y vuelve a aplicar tus cambios.`);
    }
    // Con la pieza de antes: corregir el valor nominal o la identificación de
    // una pieza con valores cambia lo transcrito y vuelve a pedir verificación.
    const valoresPrevios = previo.valores.map((valor) => {
      const previa = previasPorId.get(valor.piezaId);
      return previa ? { ...valor, nominalMg: previa.nominalMg, identificacion: previa.identificacion } : valor;
    });
    const antes = previo.cabecera ? transcripcionVersion({ ...previo.cabecera, valores: valoresPrevios, puntos: previo.puntos }) : null;
    const despues = transcripcionVersion(data.certificado);
    // Guardar solo las piezas no transcribe un certificado vacío: dejaría el
    // certificado por verificar sin valores y pediría motivo al transcribirlo.
    const cambia = antes ? !same(antes, despues) : !transcripcionVacia(despues);
    if (cambia) {
      if (antes && !data.motivo) throw httpError(400, 'Escribe el motivo del cambio: los valores de este certificado ya estaban transcritos.');
      const { motor } = await require('./calibration.metodo').configuracionVigente();
      await writeTranscripcion(createRequest, certificadoId, piezas, data.certificado, nuevaConfig.clase, who.usuario, Boolean(previo.cabecera),
        motor.pesas?.aptitud || 'R111');
      const cantidad = data.tipo === 'PESAS' ? `${despues.valores.length} piezas` : `${despues.puntos.length} puntos`;
      await logAction(
        createRequest,
        equipoId,
        'VALORES',
        `${antes ? 'Valores corregidos' : 'Valores transcritos'} de ${equipo.certificado || 'el certificado vigente'} (${cantidad})`,
        who.usuario,
        { antes, despues, motivo: data.motivo || null }
      );
      cambios += 1;
    }
  }

  return { id: equipoId, cambios };
});

/**
 * Valores que usará el cálculo de un certificado de balanza: los del
 * certificado que regía en la fecha de la calibración. `verificado` es falso
 * si nadie los comparó todavía con el original.
 */
const valoresVigentesEn = async (equipoId, fecha) => {
  const createRequest = () => getPool().request();
  const result = await createRequest().input('eid', sql.Int, equipoId).query(`
    SELECT id, certificado, CONVERT(varchar(10), cert_fecha, 23) AS fecha,
      CONVERT(varchar(10), cert_fechaven, 23) AS vence, anulado, revisado_por
    FROM dbo.CAL_CERTIFICADOS WHERE equipo_id = @eid
  `);
  const certificados = result.recordset.map(row => ({
    id: row.id,
    numero: clean(row.certificado),
    fecha: row.fecha,
    vence: row.vence,
    anulado: Boolean(row.anulado),
    revisadoPor: clean(row.revisado_por),
  }));
  const certificado = vigenteEn(certificados, fecha);
  if (!certificado) return null;
  const datos = await loadTranscripcion(createRequest, certificado.id);
  return {
    certificado,
    verificado: Boolean(datos.cabecera && certificado.revisadoPor),
    condiciones: datos.cabecera,
    valores: datos.valores,
    puntos: datos.puntos,
  };
};

module.exports = {
  CLASES,
  empR111,
  aptaR111,
  densidadR111,
  formatNominal,
  piezaKey,
  tipoSugerido,
  claseSugerida,
  avisosPesas,
  avisosAmbiente,
  vigenteEn,
  resumenPiezas,
  transcripcionVersion,
  transcripcionVacia,
  getPatron,
  savePatron,
  valoresVigentesEn,
};
