/**
 * Piezas comunes de toda escritura de un informe: control de versión,
 * creación, historial, transacción con el informe bloqueado y copia de la
 * revisión vigente.
 */
const { sql } = require('../config/db');
const { withTransaction } = require('./calibration.db');
const { numeroInforme } = require('./soporte.tipos');
const { httpError } = require('./soporte.validation');
const revisiones = require('./soporte.revisiones');
const aprobacion = require('./soporte.aprobacion');
const { leerDatos } = require('./soporte.columnas');
const { leerInforme, nombresDe } = require('./soporte.detalle');

/**
 * Un informe emitido no se edita hasta abrir una revisión; uno enviado a
 * validar o ya aprobado, hasta retirar la validación.
 */
const exigirBorradorEditable = (informe) => {
  revisiones.exigirEditable(informe);
  aprobacion.exigirEditable(informe);
};

const CONFLICTO = 'Otra persona guardó cambios en este informe mientras lo editaba. Se cargó la versión vigente: revise y vuelva a aplicar sus cambios.';
const LIMPIAR_VALIDACION = `validacion_estado = 'BORRADOR', validacion_huella = NULL,
  validacion_enviada_por = NULL, validacion_enviada_en = NULL, validacion_resuelta_por = NULL,
  validacion_resuelta_en = NULL, validacion_observacion = NULL`;

const esDuplicado = (error) => [2601, 2627].includes(error?.number || error?.originalError?.info?.number);

/** Comprueba la versión que editó el usuario contra la vigente. */
const verificarVersion = (informe, version) => {
  if (!informe) {
    if (version !== null && version !== undefined) throw httpError(409, CONFLICTO);
    return;
  }
  if (version !== informe.version) throw httpError(409, CONFLICTO);
};

const crearInforme = async (newRequest, { tipo, codigo, fuente, actor, estado = 'BORRADOR', datos = {} }) => {
  const result = await newRequest()
    .input('tipo', sql.VarChar(10), tipo)
    .input('codigo', sql.NVarChar(100), codigo)
    .input('numero', sql.NVarChar(80), numeroInforme(fuente.otst, fuente.cod_metrica) || codigo)
    .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos))
    .input('estado', sql.VarChar(20), estado)
    .input('usuario', sql.NVarChar(50), actor.usuario)
    .query(`
      INSERT INTO dbo.ST_INFORMES (tipo, codigo_registro, numero, datos, estado, creado_por, creado_en,
        actualizado_por, actualizado_en, emitido_por, emitido_en)
      OUTPUT inserted.id, inserted.tipo, inserted.codigo_registro, inserted.numero, inserted.datos,
        inserted.estado, inserted.revision, inserted.version
      VALUES (@tipo, @codigo, @numero, @datos, @estado, @usuario, SYSUTCDATETIME(),
        @usuario, SYSUTCDATETIME(),
        CASE WHEN @estado = 'EMITIDO' THEN @usuario END,
        CASE WHEN @estado = 'EMITIDO' THEN SYSUTCDATETIME() END);`);
  return result.recordset[0];
};

const registrarHistorial = (newRequest, { informeId, accion, detalle = null, motivo = null, cambios = null, revision, actor }) => newRequest()
  .input('informe', sql.Int, informeId)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('motivo', sql.NVarChar(500), motivo)
  .input('cambios', sql.NVarChar(sql.MAX), cambios ? JSON.stringify(cambios) : null)
  .input('revision', sql.Int, revision)
  .input('usuario', sql.NVarChar(50), actor.usuario)
  .input('nombre', sql.NVarChar(120), actor.nombre)
  .query(`
    INSERT INTO dbo.ST_INFORMES_HISTORIAL (informe_id, accion, detalle, motivo, cambios, revision, usuario, usuario_nombre)
    VALUES (@informe, @accion, @detalle, @motivo, @cambios, @revision, @usuario, @nombre);`);

/**
 * Ejecuta `trabajo` en una transacción con el informe bloqueado (lo crea si
 * todavía no existe) y traduce los choques de concurrencia a 409.
 */
const conInforme = async ({ tipo, codigo, fuente, actor, crear = true }, trabajo) => {
  try {
    await withTransaction(async (newRequest) => {
      let informe = await leerInforme(tipo, codigo, newRequest(), { bloquear: true });
      let nuevo = false;
      if (!informe && crear) {
        informe = await crearInforme(newRequest, { tipo, codigo, fuente, actor });
        nuevo = true;
      }
      await trabajo({ informe, nuevo, newRequest });
    });
  } catch (error) {
    if (esDuplicado(error)) throw httpError(409, CONFLICTO);
    throw error;
  }
};

/** Marca en el historial los campos redactados con la sugerencia de Gemini. */
const marcarIa = (cambios, ia = []) => {
  const conIa = new Set(ia);
  return cambios.map(cambio => (conIa.has(cambio.campo) ? { ...cambio, ia: true } : cambio));
};

/**
 * Copia de la revisión vigente. Los informes emitidos antes de la migración
 * 010 no la tienen: se toma al abrir su primera revisión (antes de cualquier
 * cambio), con quien emitió (Rev. 0) o corrigió por última vez.
 */
const asegurarCopiaVigente = async (newRequest, { informe, fuente }) => {
  const existente = await revisiones.leerCopia(newRequest(), informe.id, informe.revision ?? 0);
  if (existente) return existente;
  const original = (informe.revision ?? 0) === 0;
  const por = (original ? informe.emitido_por : informe.actualizado_por) || informe.emitido_por || 'sistema';
  const nombres = await nombresDe([por]);
  await revisiones.guardarCopia(newRequest(), {
    informeId: informe.id,
    revision: informe.revision ?? 0,
    fuente,
    datos: leerDatos(informe.datos),
    fotos: await revisiones.fotosVigentes(newRequest(), informe.id),
    emitidoPor: por,
    emitidoNombre: nombres.get(por) || null,
    emitidoEn: (original ? informe.emitido_en : informe.actualizado_en) || informe.emitido_en,
    posterior: true,
  });
  return revisiones.leerCopia(newRequest(), informe.id, informe.revision ?? 0);
};

module.exports = {
  CONFLICTO,
  LIMPIAR_VALIDACION,
  asegurarCopiaVigente,
  conInforme,
  crearInforme,
  esDuplicado,
  exigirBorradorEditable,
  marcarIa,
  registrarHistorial,
  verificarVersion,
};
