/**
 * Lectura de un informe: la fila original del servicio, lo corregido en
 * ST_INFORMES, sus fotos, su historial y las revisiones emitidas.
 */
const { getPool, sql } = require('../config/db');
const { TIPOS, numeroInforme } = require('./soporte.tipos');
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
  return {
    tipo,
    tipoLabel: TIPOS[tipo].etiqueta,
    codigo,
    numero: informe?.numero || numeroInforme(fuente.otst, fuente.cod_metrica),
    fuente,
    datos: informe ? leerDatos(informe.datos) : {},
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

const getInforme = async (tipo, codigo, user) => {
  const columnas = await columnasDe(tipo);
  const [informe, actor] = await Promise.all([
    leerInforme(tipo, codigo),
    permisos(user),
  ]);
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
    numero: informe.numero,
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

module.exports = { getInforme, getRevision, leerFuente, leerInforme, mapDetalle, nombresDe };
