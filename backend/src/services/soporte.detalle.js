/**
 * Lectura de un informe: la fila original del servicio, lo corregido en
 * ST_INFORMES, sus fotos, su historial y las revisiones emitidas.
 */
const { getPool, sql } = require('../config/db');
const { TIPOS, numeroInforme, otstDe } = require('./soporte.tipos');
const { httpError } = require('./soporte.validation');
const redaccion = require('./soporte.redaccion');
const revisiones = require('./soporte.revisiones');
const { columnasDe, columnasEditables, iso, leerDatos, normalizarFuente } = require('./soporte.columnas');
const { permisos } = require('./soporte.permisos');

const INFORME_SELECT = `
  SELECT id, tipo, codigo_registro, numero, datos, estado, revision, version,
    creado_por, creado_en, actualizado_por, actualizado_en, emitido_por, emitido_en,
    revision_motivo, revision_abierta_por, revision_abierta_en,
    validacion_estado, validacion_huella, validacion_enviada_por, validacion_enviada_en,
    validacion_resuelta_por, validacion_resuelta_en, validacion_observacion
  FROM dbo.ST_INFORMES`;

const leerFuente = async (tipo, codigo, columnas, request = getPool().request(), bloquear = false) => {
  const result = await request
    .input('codigo', sql.NVarChar(100), codigo)
    .query(`
      SELECT TOP (1) * FROM dbo.[${TIPOS[tipo].tabla}]${bloquear ? ' WITH (HOLDLOCK)' : ''}
      WHERE codigo_registro = @codigo AND ISNULL(estado_servicio_csv, N'') <> N'ANULADO'
      ORDER BY n DESC;`);
  const row = result.recordset[0];
  if (!row) throw httpError(404, 'No se encontró el servicio en DataMET (o fue anulado al volver a subirse desde ServiceMET).');
  return normalizarFuente(row, columnas);
};

const leerInforme = async (tipo, codigo, request = getPool().request(), { bloquear = false } = {}) => {
  const result = await request
    .input('tipoInf', sql.VarChar(10), tipo)
    .input('codigoInf', sql.NVarChar(100), codigo)
    .query(`${INFORME_SELECT}${bloquear ? ' WITH (UPDLOCK, HOLDLOCK)' : ''}
      WHERE tipo = @tipoInf AND codigo_registro = @codigoInf;`);
  return result.recordset[0] || null;
};

const nombresDe = async (usuarios) => {
  const lista = [...new Set(usuarios.filter(Boolean))];
  if (lista.length === 0) return new Map();
  const request = getPool().request();
  lista.forEach((usuario, index) => request.input(`u${index}`, sql.NVarChar(50), usuario));
  const result = await request.query(`
    SELECT usuario, LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre
    FROM DATA_USERS WHERE usuario IN (${lista.map((_, index) => `@u${index}`).join(', ')});`);
  return new Map(result.recordset.map(row => [row.usuario, row.nombre]));
};

const dataUrl = (tipo, contenido) => `data:${tipo};base64,${Buffer.from(contenido).toString('base64')}`;

const leerCambios = (json) => {
  try {
    const value = JSON.parse(json || 'null');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const mapHistorial = (row) => ({
  id: Number(row.id),
  accion: row.accion,
  detalle: row.detalle || null,
  motivo: row.motivo || null,
  cambios: leerCambios(row.cambios),
  revision: row.revision,
  usuario: row.usuario,
  usuarioNombre: row.usuario_nombre || null,
  fecha: iso(row.fecha),
});

const mapDetalle = ({ tipo, codigo, fuente, informe, fotos, historial, columnas, nombres, editar, aprobar = false, copias = [] }) => {
  const nombre = (usuario) => (usuario ? { usuario, nombre: nombres.get(usuario) || null } : null);
  const datos = informe ? leerDatos(informe.datos) : {};
  return {
    tipo,
    tipoLabel: TIPOS[tipo].etiqueta,
    codigo,
    numero: informe?.numero || numeroInforme(fuente.otst, fuente.cod_metrica),
    // OTST vigente del informe y la que subió ServiceMET (difieren si se cambió).
    otst: otstDe(fuente, datos),
    otstOriginal: otstDe(fuente),
    fuente,
    datos,
    columnas: columnasEditables(columnas),
    estado: informe ? informe.estado : 'PENDIENTE',
    revision: informe?.revision ?? 0,
    version: informe?.version ?? null,
    trazabilidad: {
      creadoPor: nombre(informe?.creado_por),
      creadoEn: iso(informe?.creado_en),
      actualizadoPor: nombre(informe?.actualizado_por),
      actualizadoEn: iso(informe?.actualizado_en),
      emitidoPor: nombre(informe?.emitido_por),
      emitidoEn: iso(informe?.emitido_en),
    },
    fotos: fotos.map(foto => ({
      id: foto.id,
      orden: foto.orden,
      descripcion: foto.descripcion || null,
      nombre: foto.nombre || null,
      url: dataUrl(foto.tipo, foto.contenido),
      subidoPor: nombre(foto.subido_por),
      subidoEn: iso(foto.subido_en),
    })),
    historial: historial.map(mapHistorial),
    // Revisión abierta (borrador de la siguiente) y revisiones emitidas con copia.
    revisionAbierta: informe?.estado === 'EN_REVISION' ? {
      revision: (informe.revision ?? 0) + 1,
      motivo: informe.revision_motivo,
      abiertaPor: nombre(informe.revision_abierta_por),
      abiertaEn: iso(informe.revision_abierta_en),
    } : null,
    revisiones: copias,
    validacion: {
      estado: informe?.validacion_estado || 'BORRADOR',
      enviadaPor: nombre(informe?.validacion_enviada_por),
      enviadaEn: iso(informe?.validacion_enviada_en),
      resueltaPor: nombre(informe?.validacion_resuelta_por),
      resueltaEn: iso(informe?.validacion_resuelta_en),
      observacion: informe?.validacion_observacion || null,
    },
    acciones: { editar, aprobar, redaccion: editar && redaccion.disponible() },
  };
};

/** Informes que ve quien solo consulta: los emitidos (también con una revisión en borrador). */
const PUBLICADOS = new Set(['EMITIDO', 'EN_REVISION']);
const esPublicado = (informe) => PUBLICADOS.has(informe?.estado);

const NO_EMITIDO = 'Ese informe todavía no se emitió: desde Comercial se consultan solo los informes emitidos.';

/** Exige que el informe esté emitido (para quien solo consulta). */
const exigirPublicado = async (tipo, codigo) => {
  const informe = await leerInforme(tipo, codigo);
  if (!esPublicado(informe)) throw httpError(404, NO_EMITIDO);
  return informe;
};

/**
 * Fotos de una revisión emitida tal como se entregó: las de la copia, en su
 * orden y con su descripción (las fotos nunca se borran, solo se quitan).
 */
const fotosDeCopia = async (informeId, fotosCopia) => {
  const ids = fotosCopia.map(foto => Number(foto.id)).filter(Number.isInteger);
  if (ids.length === 0) return [];
  const request = getPool().request().input('informe', sql.Int, informeId);
  ids.forEach((id, index) => request.input(`f${index}`, sql.Int, id));
  const result = await request.query(`
    SELECT id, nombre, tipo, contenido, subido_por, subido_en FROM dbo.ST_INFORMES_FOTOS
    WHERE informe_id = @informe AND id IN (${ids.map((_, index) => `@f${index}`).join(', ')});`);
  const porId = new Map(result.recordset.map(row => [row.id, row]));
  return fotosCopia
    .filter(foto => porId.has(Number(foto.id)))
    .map(foto => ({ ...porId.get(Number(foto.id)), orden: foto.orden, descripcion: foto.descripcion ?? null }));
};

/**
 * Lo que ve quien solo consulta (Comercial): la revisión emitida vigente tal
 * como se entregó, aunque el área tenga abierta la siguiente en borrador. Sin
 * el historial interno, la validación ni quién la editó.
 */
const getInformeConsulta = async (tipo, codigo, informe, columnas) => {
  if (!esPublicado(informe)) throw httpError(404, NO_EMITIDO);
  const revision = informe.revision ?? 0;
  const copia = await revisiones.leerCopia(getPool().request(), informe.id, revision);
  // Sin copia (emitido antes de que se guardaran) solo sirve lo vigente si no hay borrador encima.
  if (!copia && informe.estado !== 'EMITIDO') {
    throw httpError(404, 'La revisión emitida de este informe no está disponible. Pida una copia al área de Soporte Técnico.');
  }
  const [fuente, fotos, copias] = await Promise.all([
    copia ? copia.fuente : leerFuente(tipo, codigo, columnas),
    copia
      ? fotosDeCopia(informe.id, copia.fotos)
      : getPool().request().input('id', sql.Int, informe.id).query(`
        SELECT id, orden, descripcion, nombre, tipo, contenido, subido_por, subido_en
        FROM dbo.ST_INFORMES_FOTOS WHERE informe_id = @id AND quitada_en IS NULL
        ORDER BY orden, id;`).then(result => result.recordset),
    revisiones.listarCopias(getPool().request(), informe.id),
  ]);
  const emitido = {
    ...informe,
    estado: 'EMITIDO',
    numero: copia?.numero || informe.numero,
    datos: copia ? JSON.stringify(copia.datos) : informe.datos,
  };
  const detalle = mapDetalle({
    tipo, codigo, fuente, informe: emitido, fotos, historial: [], columnas, nombres: new Map(),
    editar: false, copias: copias.filter(item => item.revision <= revision),
  });
  return {
    ...detalle,
    consulta: true,
    trazabilidad: {
      creadoPor: null,
      creadoEn: null,
      actualizadoPor: null,
      actualizadoEn: null,
      emitidoPor: copia?.emitidoPor || (informe.emitido_por ? { usuario: informe.emitido_por, nombre: null } : null),
      emitidoEn: copia?.emitidoEn || iso(informe.emitido_en),
    },
    fotos: detalle.fotos.map(foto => ({ ...foto, subidoPor: null })),
    validacion: { estado: 'APROBADO', enviadaPor: null, enviadaEn: null, resueltaPor: null, resueltaEn: null, observacion: null },
  };
};

const getInforme = async (tipo, codigo, user) => {
  const columnas = await columnasDe(tipo);
  const [informe, actor] = await Promise.all([
    leerInforme(tipo, codigo),
    permisos(user),
  ]);
  if (actor.consulta) return getInformeConsulta(tipo, codigo, informe, columnas);
  // Un PDF emitido usa la fuente congelada al emitir, incluso si ServiceMET
  // repone después el servicio. Los cambios se revisan al abrir otra revisión.
  const publicada = informe?.estado === 'EMITIDO'
    ? await revisiones.leerCopia(getPool().request(), informe.id, informe.revision ?? 0) : null;
  const fuente = publicada?.fuente || await leerFuente(tipo, codigo, columnas);
  const informeVisible = publicada ? { ...informe, datos: JSON.stringify(publicada.datos) } : informe;
  let fotos = [];
  let historial = [];
  let copias = [];
  if (informe) {
    const [fotosResult, historialResult, copiasResult] = await Promise.all([
      getPool().request().input('id', sql.Int, informe.id).query(`
        SELECT id, orden, descripcion, nombre, tipo, contenido, subido_por, subido_en
        FROM dbo.ST_INFORMES_FOTOS WHERE informe_id = @id AND quitada_en IS NULL
        ORDER BY orden, id;`),
      getPool().request().input('id', sql.Int, informe.id).query(`
        SELECT TOP (300) id, accion, detalle, motivo, cambios, revision, usuario, usuario_nombre, fecha
        FROM dbo.ST_INFORMES_HISTORIAL WHERE informe_id = @id ORDER BY id DESC;`),
      revisiones.listarCopias(getPool().request(), informe.id),
    ]);
    fotos = fotosResult.recordset;
    historial = historialResult.recordset;
    copias = copiasResult;
  }
  const nombres = await nombresDe([
    informe?.creado_por, informe?.actualizado_por, informe?.emitido_por, informe?.revision_abierta_por,
    informe?.validacion_enviada_por, informe?.validacion_resuelta_por,
    ...fotos.map(foto => foto.subido_por),
  ]);
  return mapDetalle({ tipo, codigo, fuente, informe: informeVisible, fotos, historial, columnas, nombres, editar: actor.editar, aprobar: actor.aprobar, copias });
};

/** Una revisión emitida tal como se entregó, para verla, imprimirla o guardarla en PDF. */
const getRevision = async (tipo, codigo, revision) => {
  const informe = await leerInforme(tipo, codigo);
  if (!informe) throw httpError(404, 'El informe no existe.');
  // Toda copia es de una revisión emitida, así que quien solo consulta también la ve.
  const copia = await revisiones.leerCopia(getPool().request(), informe.id, revision);
  if (!copia) throw httpError(404, `No hay copia de la Rev. ${revision}: el informe se emitió antes de que se guardaran.`);
  const ids = copia.fotos.map(foto => foto.id);
  let contenidos = new Map();
  if (ids.length) {
    const request = getPool().request().input('informe', sql.Int, informe.id);
    ids.forEach((id, index) => request.input(`f${index}`, sql.Int, id));
    const result = await request.query(`
      SELECT id, tipo, contenido FROM dbo.ST_INFORMES_FOTOS
      WHERE informe_id = @informe AND id IN (${ids.map((_, index) => `@f${index}`).join(', ')});`);
    contenidos = new Map(result.recordset.map(row => [row.id, row]));
  }
  const copias = await revisiones.listarCopias(getPool().request(), informe.id);
  return {
    tipo,
    codigo,
    // Cada revisión conserva el número con que se emitió (la OTST pudo cambiar después).
    numero: copia.numero || numeroInforme(otstDe(copia.fuente, copia.datos), copia.fuente.cod_metrica) || informe.numero,
    revision: copia.revision,
    fuente: copia.fuente,
    datos: copia.datos,
    fotos: copia.fotos
      .filter(foto => contenidos.has(foto.id))
      .map(foto => ({ ...foto, url: dataUrl(contenidos.get(foto.id).tipo, contenidos.get(foto.id).contenido) })),
    motivo: copia.motivo,
    emitidoPor: copia.emitidoPor,
    emitidoEn: copia.emitidoEn,
    posterior: copia.posterior,
    // Revisiones hasta esta, para el pie y las notas del informe.
    revisiones: copias.filter(item => item.revision <= copia.revision),
  };
};

module.exports = { esPublicado, exigirPublicado, getInforme, getRevision, leerFuente, leerInforme, mapDetalle, nombresDe };
