/**
 * Revisiones de los informes de Soporte técnico (migración 010).
 *
 * Cada revisión emitida (la emisión original es la Rev. 0) guarda una copia
 * completa en ST_INFORMES_REVISIONES: la fila del servicio tal como estaba,
 * las correcciones del área, las fotos (id, orden y descripción; las fotos
 * nunca se borran) y el número con que se emitió (cambia con la OTST,
 * migración 015). Con ella se vuelve a imprimir la revisión tal como se
 * entregó y se vuelve a la vigente si se cancela una revisión abierta.
 *
 * Este módulo no depende de soporte.informes.js: lo usa.
 */
const { sql } = require('../config/db');

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const leerJson = (json, vacio) => {
  try {
    const valor = JSON.parse(json);
    return valor ?? vacio;
  } catch {
    return vacio;
  }
};

const iso = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null);

// ─── Reglas ────────────────────────────────────────────────────────────────

/**
 * Un informe emitido no se cambia en el acto: hay que abrir una revisión.
 * Sin informe, en borrador o con la revisión abierta, se puede editar.
 */
const exigirEditable = (informe) => {
  if (informe?.estado === 'EMITIDO') {
    throw httpError(409, 'El informe ya fue emitido: abra una revisión para cambiarlo.');
  }
};

/** Revisión a la que pertenece un cambio: la siguiente si hay una abierta. */
const revisionDeCambio = (informe) => (informe?.revision ?? 0) + (informe?.estado === 'EN_REVISION' ? 1 : 0);

const ordenarClaves = (objeto) => Object.fromEntries(Object.keys(objeto || {}).sort().map(clave => [clave, objeto[clave]]));

const mismoValor = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Diferencias entre dos juegos de correcciones (campo -> valor), con el valor
 * efectivo (corrección o, si no hay, el original del servicio).
 */
const diferenciasDatos = ({ desde, hasta, fuente = {} }) => {
  const efectivo = (datos, campo) => (Object.prototype.hasOwnProperty.call(datos, campo) ? datos[campo] : (fuente[campo] ?? null));
  const campos = [...new Set([...Object.keys(desde || {}), ...Object.keys(hasta || {})])].sort();
  return campos
    .map(campo => ({ campo, antes: efectivo(desde || {}, campo), despues: efectivo(hasta || {}, campo) }))
    .filter(cambio => !mismoValor(cambio.antes, cambio.despues));
};

/** Fotos como se guardan en la copia: en el orden en que se imprimen. */
const copiaFotos = (fotos) => [...fotos]
  .sort((a, b) => a.orden - b.orden || a.id - b.id)
  .map(foto => ({ id: foto.id, orden: foto.orden, descripcion: foto.descripcion ?? null }));

const mismasFotos = (a, b) => JSON.stringify(copiaFotos(a).map(({ id, descripcion }, index) => [id, descripcion, index]))
  === JSON.stringify(copiaFotos(b).map(({ id, descripcion }, index) => [id, descripcion, index]));

/**
 * ¿La revisión abierta cambió algo respecto de la vigente? Cuentan las
 * correcciones, las fotos y también un servicio que ServiceMET volvió a subir.
 */
const hayCambios = ({ vigente, actual }) => (
  diferenciasDatos({ desde: vigente.datos, hasta: actual.datos, fuente: actual.fuente }).length > 0
  || !mismasFotos(vigente.fotos, actual.fotos)
  || JSON.stringify(ordenarClaves(vigente.fuente)) !== JSON.stringify(ordenarClaves(actual.fuente))
);

/**
 * Qué hacer con las fotos para volver a las de la copia: reponer las que se
 * quitaron, quitar las agregadas y devolver orden y descripción.
 * `todas` son todas las fotos del informe (también las quitadas).
 */
const planFotos = ({ copia, todas }) => {
  const enCopia = new Map(copia.map(foto => [foto.id, foto]));
  const reponer = [];
  const quitar = [];
  const ajustar = [];
  for (const foto of todas) {
    const destino = enCopia.get(foto.id);
    const vigente = !foto.quitada_en;
    if (destino && !vigente) reponer.push({ id: foto.id, orden: destino.orden, descripcion: destino.descripcion });
    else if (!destino && vigente) quitar.push(foto.id);
    else if (destino && (foto.orden !== destino.orden || (foto.descripcion ?? null) !== destino.descripcion)) {
      ajustar.push({ id: foto.id, orden: destino.orden, descripcion: destino.descripcion });
    }
  }
  return { reponer, quitar, ajustar };
};

// ─── Base de datos ─────────────────────────────────────────────────────────

const COPIA_SELECT = `
  SELECT revision, numero, motivo, emitido_por, emitido_nombre, emitido_en, posterior
  FROM dbo.ST_INFORMES_REVISIONES`;

const mapCopia = (row) => ({
  revision: row.revision,
  numero: row.numero || null,
  motivo: row.motivo || null,
  emitidoPor: row.emitido_por ? { usuario: row.emitido_por, nombre: row.emitido_nombre || null } : null,
  emitidoEn: iso(row.emitido_en),
  posterior: Boolean(row.posterior),
});

/** Revisiones emitidas de un informe (sin el contenido), de la más antigua a la última. */
const listarCopias = async (request, informeId) => {
  const result = await request
    .input('informeCopias', sql.Int, informeId)
    .query(`${COPIA_SELECT} WHERE informe_id = @informeCopias ORDER BY revision;`);
  return result.recordset.map(mapCopia);
};

/** Copia completa de una revisión, o null si no existe. */
const leerCopia = async (request, informeId, revision) => {
  const result = await request
    .input('informeCopia', sql.Int, informeId)
    .input('revisionCopia', sql.Int, revision)
    .query(`
      SELECT revision, numero, fuente, datos, fotos, motivo, emitido_por, emitido_nombre, emitido_en, posterior
      FROM dbo.ST_INFORMES_REVISIONES WHERE informe_id = @informeCopia AND revision = @revisionCopia;`);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    ...mapCopia(row),
    fuente: leerJson(row.fuente, {}),
    datos: leerJson(row.datos, {}),
    fotos: leerJson(row.fotos, []),
  };
};

/** Fotos vigentes del informe (id, orden, descripción). */
const fotosVigentes = async (request, informeId) => {
  const result = await request
    .input('informeFotos', sql.Int, informeId)
    .query(`
      SELECT id, orden, descripcion FROM dbo.ST_INFORMES_FOTOS
      WHERE informe_id = @informeFotos AND quitada_en IS NULL ORDER BY orden, id;`);
  return copiaFotos(result.recordset);
};

/**
 * Guarda la copia de una revisión emitida con el número con que se emite.
 * `emitidoEn` nulo = ahora (hora del servidor).
 */
const guardarCopia = (request, {
  informeId, revision, numero, fuente, datos, fotos, motivo = null, emitidoPor, emitidoNombre = null, emitidoEn = null, posterior = false,
}) => request
  .input('informe', sql.Int, informeId)
  .input('revision', sql.Int, revision)
  .input('numero', sql.NVarChar(80), numero || null)
  .input('fuente', sql.NVarChar(sql.MAX), JSON.stringify(fuente || {}))
  .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(ordenarClaves(datos)))
  .input('fotos', sql.NVarChar(sql.MAX), JSON.stringify(copiaFotos(fotos || [])))
  .input('motivo', sql.NVarChar(500), motivo)
  .input('por', sql.NVarChar(50), emitidoPor)
  .input('nombre', sql.NVarChar(120), emitidoNombre)
  .input('en', sql.DateTime2, emitidoEn)
  .input('posterior', sql.Bit, posterior)
  .query(`
    INSERT INTO dbo.ST_INFORMES_REVISIONES
      (informe_id, revision, numero, fuente, datos, fotos, motivo, emitido_por, emitido_nombre, emitido_en, posterior)
    VALUES (@informe, @revision, @numero, @fuente, @datos, @fotos, @motivo, @por, @nombre, ISNULL(@en, SYSUTCDATETIME()), @posterior);`);

/** Deja las fotos del informe como en la copia. Devuelve cuántas cambió. */
const restaurarFotos = async (newRequest, { informeId, copia, actor }) => {
  const todas = await newRequest()
    .input('informeTodas', sql.Int, informeId)
    .query(`
      SELECT id, orden, descripcion, quitada_en FROM dbo.ST_INFORMES_FOTOS WITH (UPDLOCK, HOLDLOCK)
      WHERE informe_id = @informeTodas;`);
  const plan = planFotos({ copia, todas: todas.recordset });
  for (const foto of [...plan.reponer, ...plan.ajustar]) {
    await newRequest()
      .input('foto', sql.Int, foto.id)
      .input('orden', sql.Int, foto.orden)
      .input('descripcion', sql.NVarChar(300), foto.descripcion)
      .query(`
        UPDATE dbo.ST_INFORMES_FOTOS
        SET orden = @orden, descripcion = @descripcion, quitada_por = NULL, quitada_en = NULL, quitada_motivo = NULL
        WHERE id = @foto;`);
  }
  for (const id of plan.quitar) {
    await newRequest()
      .input('foto', sql.Int, id)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`
        UPDATE dbo.ST_INFORMES_FOTOS
        SET quitada_por = @usuario, quitada_en = SYSUTCDATETIME(), quitada_motivo = N'Revisión cancelada'
        WHERE id = @foto;`);
  }
  return plan;
};

module.exports = {
  copiaFotos,
  diferenciasDatos,
  exigirEditable,
  fotosVigentes,
  guardarCopia,
  hayCambios,
  leerCopia,
  listarCopias,
  mismasFotos,
  planFotos,
  restaurarFotos,
  revisionDeCambio,
};
