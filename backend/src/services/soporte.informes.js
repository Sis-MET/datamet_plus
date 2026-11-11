/**
 * Informes de Soporte técnico.
 *
 * Los datos de cada servicio los sube ServiceMET a DATA_SERVICIOS_DATOS_*
 * (una tabla por tipo, ver soporte.tipos.js). Esas filas son las
 * observaciones originales del técnico y aquí solo se leen: cuando una
 * reposición anula la anterior (`estado_servicio_csv = 'ANULADO'`) vale la
 * fila vigente con el mismo `codigo_registro`.
 *
 * Lo que el área corrige o completa vive en ST_INFORMES.datos (campo → valor)
 * y se superpone a la fila original. Cada cambio queda en
 * ST_INFORMES_HISTORIAL con el valor anterior y el nuevo, quién y cuándo; en
 * un informe emitido, además, con su motivo (NB/ISO/IEC 17025, 7.5.2).
 *
 * Este archivo reúne los flujos del informe (corregir, emitir, revisiones,
 * validación y redacción) y es el punto de entrada del servicio: reexporta
 * lo de soporte.columnas, .permisos, .lista, .detalle, .escritura y .fotos.
 */
const { getPool, sql } = require('../config/db');
const { withTransaction } = require('./calibration.db');
const { TIPOS, numeroInforme, otstDe } = require('./soporte.tipos');
const { httpError } = require('./soporte.validation');
const redaccion = require('./soporte.redaccion');
const revisiones = require('./soporte.revisiones');
const aprobacion = require('./soporte.aprobacion');
const {
  PROTEGIDAS,
  coercer,
  columnasDe,
  esEditable,
  leerDatos,
  mapColumna,
  normalizarFuente,
  planCambios,
} = require('./soporte.columnas');
const { exigirEditor, exigirLector, permisos, puedeEditarArea } = require('./soporte.permisos');
const {
  buildGroupsQuery,
  buildListQuery,
  claveTecnico,
  getFiltros,
  listGrupos,
  listInformes,
  mapFila,
  mapGrupo,
  mapResumen,
} = require('./soporte.lista');
const { esPublicado, exigirPublicado, getInforme, getRevision, leerFuente, leerInforme, mapDetalle } = require('./soporte.detalle');
const {
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
} = require('./soporte.escritura');
const { agregarFoto, editarFoto, ordenarFotos, quitarFoto } = require('./soporte.fotos');

// ─── Corrección y emisión ─────────────────────────────────────────────────

/** Corrige o completa campos del informe. */
const guardarCambios = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const columnas = await columnasDe(tipo);
  const fuente = await leerFuente(tipo, codigo, columnas);

  await withTransaction(async (newRequest) => {
    const informe = await leerInforme(tipo, codigo, newRequest(), { bloquear: true });
    verificarVersion(informe, body.version);
    const plan = planCambios({
      fuente,
      datos: informe ? leerDatos(informe.datos) : {},
      entrantes: body.cambios,
      columnas,
    });
    if (plan.cambios.length === 0) return;
    // Emitido: primero se abre una revisión. Con la revisión abierta los
    // cambios son su borrador y no suben la revisión vigente.
    exigirBorradorEditable(informe);
    const cambios = marcarIa(plan.cambios, body.ia);
    const usaronIa = cambios.some(cambio => cambio.ia);

    let id = informe?.id;
    if (!informe) {
      const creado = await crearInforme(newRequest, { tipo, codigo, fuente, actor, datos: plan.datos });
      id = creado.id;
    } else {
      await newRequest()
        .input('id', sql.Int, id)
        .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(plan.datos))
        .input('usuario', sql.NVarChar(50), actor.usuario)
        .query(`
          UPDATE dbo.ST_INFORMES
          SET datos = @datos, version = version + 1,
            actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
          WHERE id = @id;`);
    }
    await registrarHistorial(newRequest, {
      informeId: id,
      accion: 'EDICION',
      detalle: `${cambios.length} ${cambios.length === 1 ? 'campo' : 'campos'}${usaronIa ? ' · redacción con IA' : ''}`,
      cambios,
      revision: revisiones.revisionDeCambio(informe),
      actor,
    });
  }).catch((error) => {
    if (esDuplicado(error)) throw httpError(409, CONFLICTO);
    throw error;
  });

  return getInforme(tipo, codigo, user);
};

/** Emite el informe: queda quién y cuándo, y desde ahí todo cambio es una corrección. */
const emitirInforme = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const columnas = await columnasDe(tipo);
  await withTransaction(async (newRequest) => {
    const informe = await leerInforme(tipo, codigo, newRequest(), { bloquear: true });
    verificarVersion(informe, body.version);
    if (informe?.estado === 'EMITIDO') throw httpError(409, 'El informe ya fue emitido.');
    if (informe?.estado === 'EN_REVISION') throw httpError(409, 'El informe tiene una revisión abierta: reemítalo.');
    const fuente = await leerFuente(tipo, codigo, columnas, newRequest(), true);
    const fotos = informe ? await revisiones.fotosVigentes(newRequest(), informe.id) : [];
    aprobacion.exigirAprobado(informe, { fuente, datos: leerDatos(informe?.datos), fotos });
    const id = informe.id;
    await newRequest()
        .input('id', sql.Int, id)
        .input('usuario', sql.NVarChar(50), actor.usuario)
        .query(`
          UPDATE dbo.ST_INFORMES
          SET estado = 'EMITIDO', emitido_por = @usuario, emitido_en = SYSUTCDATETIME(),
            version = version + 1, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
          WHERE id = @id;`);
    // Copia de la Rev. 0 tal como se entrega.
    await revisiones.guardarCopia(newRequest(), {
      informeId: id,
      revision: informe?.revision ?? 0,
      numero: informe.numero,
      fuente,
      datos: informe ? leerDatos(informe.datos) : {},
      fotos,
      emitidoPor: actor.usuario,
      emitidoNombre: actor.nombre,
    });
    await registrarHistorial(newRequest, {
      informeId: id, accion: 'EMISION', detalle: 'Informe emitido', revision: informe?.revision ?? 0, actor,
    });
  }).catch((error) => {
    if (esDuplicado(error)) throw httpError(409, CONFLICTO);
    throw error;
  });

  return getInforme(tipo, codigo, user);
};

// ─── Revisiones (reemisión) ────────────────────────────────────────────────

/** Abre una revisión de un informe emitido: sus cambios serán el borrador de la siguiente. */
const abrirRevision = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    verificarVersion(informe, body.version);
    if (!informe || informe.estado === 'BORRADOR') throw httpError(409, 'El informe todavía no fue emitido: se puede editar directamente.');
    if (informe.estado === 'EN_REVISION') throw httpError(409, 'El informe ya tiene una revisión abierta.');
    await asegurarCopiaVigente(newRequest, { informe, fuente });
    await newRequest()
      .input('id', sql.Int, informe.id)
      .input('motivo', sql.NVarChar(500), body.motivo)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`
        UPDATE dbo.ST_INFORMES
        SET estado = 'EN_REVISION', revision_motivo = @motivo, revision_abierta_por = @usuario,
          revision_abierta_en = SYSUTCDATETIME(), version = version + 1,
          ${LIMPIAR_VALIDACION},
          actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id;`);
    const siguiente = (informe.revision ?? 0) + 1;
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'REVISION_ABIERTA',
      detalle: `Revisión ${siguiente} abierta; la Rev. ${informe.revision ?? 0} sigue vigente`,
      motivo: body.motivo,
      revision: siguiente,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

/** Reemite el informe: la revisión abierta pasa a ser la vigente. */
const reemitirInforme = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const columnas = await columnasDe(tipo);
  const fuente = await leerFuente(tipo, codigo, columnas);

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    verificarVersion(informe, body.version);
    if (informe?.estado !== 'EN_REVISION') throw httpError(409, 'El informe no tiene una revisión abierta.');
    const fuenteActual = await leerFuente(tipo, codigo, columnas, newRequest(), true);
    const vigente = await asegurarCopiaVigente(newRequest, { informe, fuente });
    const actual = {
      fuente: fuenteActual,
      datos: leerDatos(informe.datos),
      fotos: await revisiones.fotosVigentes(newRequest(), informe.id),
    };
    aprobacion.exigirAprobado(informe, actual);
    if (!revisiones.hayCambios({ vigente, actual })) {
      throw httpError(400, `La revisión no cambia nada respecto de la Rev. ${informe.revision ?? 0}: cancélela en vez de reemitir.`);
    }
    const nueva = (informe.revision ?? 0) + 1;
    await newRequest()
      .input('id', sql.Int, informe.id)
      .input('revision', sql.Int, nueva)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`
        UPDATE dbo.ST_INFORMES
        SET estado = 'EMITIDO', revision = @revision, revision_motivo = NULL, revision_abierta_por = NULL,
          revision_abierta_en = NULL, version = version + 1,
          actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id;`);
    await revisiones.guardarCopia(newRequest(), {
      informeId: informe.id,
      revision: nueva,
      numero: informe.numero,
      ...actual,
      motivo: informe.revision_motivo,
      emitidoPor: actor.usuario,
      emitidoNombre: actor.nombre,
    });
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'REEMISION',
      detalle: `Rev. ${nueva} reemitida; reemplaza a la Rev. ${informe.revision ?? 0}`,
      motivo: informe.revision_motivo,
      cambios: revisiones.diferenciasDatos({ desde: vigente.datos, hasta: actual.datos, fuente }),
      revision: nueva,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

/** Cancela la revisión abierta: datos y fotos vuelven a los de la revisión vigente. */
const cancelarRevision = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    verificarVersion(informe, body.version);
    if (informe?.estado !== 'EN_REVISION') throw httpError(409, 'El informe no tiene una revisión abierta.');
    const vigente = await revisiones.leerCopia(newRequest(), informe.id, informe.revision ?? 0);
    if (!vigente) throw httpError(409, 'No se encontró la copia de la revisión vigente.');
    const fotos = await revisiones.restaurarFotos(newRequest, { informeId: informe.id, copia: vigente.fotos, actor });
    // Si la revisión cambió la OTST, vuelve también el número de la vigente.
    const numero = vigente.numero || numeroInforme(otstDe(vigente.fuente, vigente.datos), vigente.fuente?.cod_metrica) || informe.numero;
    await newRequest()
      .input('id', sql.Int, informe.id)
      .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(vigente.datos))
      .input('numero', sql.NVarChar(80), numero)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`
        UPDATE dbo.ST_INFORMES
        SET estado = 'EMITIDO', datos = @datos, numero = @numero,
          revision_motivo = NULL, revision_abierta_por = NULL,
          ${LIMPIAR_VALIDACION},
          revision_abierta_en = NULL, version = version + 1,
          actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id;`);
    const cambiosFotos = fotos.reponer.length + fotos.quitar.length + fotos.ajustar.length;
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'REVISION_CANCELADA',
      detalle: `Revisión ${(informe.revision ?? 0) + 1} cancelada; vuelve la Rev. ${informe.revision ?? 0}`
        + (cambiosFotos ? ` (${cambiosFotos} ${cambiosFotos === 1 ? 'foto restaurada' : 'fotos restauradas'})` : ''),
      motivo: informe.revision_motivo,
      cambios: revisiones.diferenciasDatos({ desde: leerDatos(informe.datos), hasta: vigente.datos, fuente }),
      revision: (informe.revision ?? 0) + 1,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

// ─── OTST ──────────────────────────────────────────────────────────────────

/**
 * ¿Otro servicio del mismo tipo ya usa ese número? Se revisan los informes
 * guardados y los servicios de ServiceMET con esa OTST y ese instrumento
 * (salvo los que ya cambiaron su OTST, que cuentan por su informe).
 */
const exigirNumeroLibre = async (newRequest, { tipo, codigo, otst, codMetrica, numero }) => {
  const result = await newRequest()
    .input('tipoOt', sql.VarChar(10), tipo)
    .input('codigoOt', sql.NVarChar(100), codigo)
    .input('otstOt', sql.NVarChar(50), otst)
    .input('codOt', sql.NVarChar(50), String(codMetrica ?? '').trim())
    .input('numeroOt', sql.NVarChar(80), numero)
    .query(`
      SELECT TOP (1) codigo_registro FROM (
        SELECT i.codigo_registro FROM dbo.ST_INFORMES i
        WHERE i.tipo = @tipoOt AND i.codigo_registro <> @codigoOt AND i.numero = @numeroOt
        UNION ALL
        SELECT t.codigo_registro FROM dbo.[${TIPOS[tipo].tabla}] t
        WHERE t.codigo_registro IS NOT NULL AND t.codigo_registro <> @codigoOt
          AND ISNULL(t.estado_servicio_csv, N'') <> N'ANULADO'
          AND LTRIM(RTRIM(t.otst)) = @otstOt AND LTRIM(RTRIM(t.cod_metrica)) = @codOt
          AND NOT EXISTS (
            SELECT 1 FROM dbo.ST_INFORMES x
            WHERE x.tipo = @tipoOt AND x.codigo_registro = t.codigo_registro AND JSON_VALUE(x.datos, '$.otst') IS NOT NULL)
      ) usados;`);
  const otro = result.recordset[0];
  if (otro) {
    throw httpError(400, `Ya hay un informe de ${TIPOS[tipo].etiqueta.toLowerCase()} N° ${numero} (servicio ${otro.codigo_registro}). Revise la OTST.`);
  }
};

/**
 * Cambia la OTST del informe (ServiceMET la registró mal o la orden se
 * reasignó). La fila de ServiceMET no se toca: la OTST nueva se guarda en
 * ST_INFORMES.datos como las demás correcciones, el número del informe se
 * recalcula con ella y el historial conserva la anterior, la nueva, quién,
 * cuándo y el motivo (NB/ISO/IEC 17025, 7.5.2). Un informe emitido se cambia
 * abriendo antes una revisión: la OTST nueva sale en la reemisión y la
 * revisión anterior conserva su número.
 */
const cambiarOtst = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));
  await conInforme({ tipo, codigo, fuente, actor }, async ({ informe, nuevo, newRequest }) => {
    verificarVersion(nuevo ? null : informe, body.version);
    exigirBorradorEditable(informe);
    const datos = leerDatos(informe.datos);
    const anterior = otstDe(fuente, datos);
    if (anterior === body.otst) throw httpError(400, `La OTST del informe ya es ${body.otst}.`);
    const numero = numeroInforme(body.otst, fuente.cod_metrica);
    await exigirNumeroLibre(newRequest, { tipo, codigo, otst: body.otst, codMetrica: fuente.cod_metrica, numero });

    // Volver a la OTST de ServiceMET deja de ser una corrección.
    const nuevos = { ...datos, otst: body.otst };
    if (body.otst === otstDe(fuente)) delete nuevos.otst;
    const ordenados = Object.fromEntries(Object.keys(nuevos).sort().map(clave => [clave, nuevos[clave]]));
    await newRequest()
      .input('id', sql.Int, informe.id)
      .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(ordenados))
      .input('numero', sql.NVarChar(80), numero)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`
        UPDATE dbo.ST_INFORMES
        SET datos = @datos, numero = @numero, version = version + 1,
          actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id;`);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'OTST_CAMBIADA',
      detalle: `OTST ${anterior || 'sin OTST'} → ${body.otst}; informe N° ${informe.numero} → ${numero}`,
      motivo: body.motivo,
      cambios: [{ campo: 'otst', antes: anterior, despues: body.otst }],
      revision: revisiones.revisionDeCambio(informe),
      actor,
    });
  });
  return getInforme(tipo, codigo, user);
};

// ─── Validación previa a emitir ───────────────────────────────────────────

const enviarValidacion = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const columnas = await columnasDe(tipo);
  const fuente = await leerFuente(tipo, codigo, columnas);
  await conInforme({ tipo, codigo, fuente, actor }, async ({ informe, nuevo, newRequest }) => {
    verificarVersion(nuevo ? null : informe, body.version);
    exigirBorradorEditable(informe);
    const actual = {
      fuente: await leerFuente(tipo, codigo, columnas, newRequest(), true),
      datos: leerDatos(informe.datos),
      fotos: await revisiones.fotosVigentes(newRequest(), informe.id),
    };
    await newRequest()
      .input('id', sql.Int, informe.id)
      .input('huella', sql.VarChar(64), aprobacion.huella(actual))
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`UPDATE dbo.ST_INFORMES SET validacion_estado = 'PENDIENTE', validacion_huella = @huella,
        validacion_enviada_por = @usuario, validacion_enviada_en = SYSUTCDATETIME(),
        validacion_resuelta_por = NULL, validacion_resuelta_en = NULL, validacion_observacion = NULL,
        version = version + 1, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME() WHERE id = @id;`);
    await registrarHistorial(newRequest, { informeId: informe.id, accion: 'VALIDACION_ENVIADA',
      detalle: 'Enviado a los aprobadores autorizados para validar antes de emitir', revision: revisiones.revisionDeCambio(informe), actor });
  });
  return getInforme(tipo, codigo, user);
};

const resolverValidacion = async (tipo, codigo, body, user) => {
  const permiso = await permisos(user);
  if (!permiso.aprobar) throw httpError(403, 'Solo el jefe de área o el personal activo de Soporte Técnico autorizado por él puede validar informes.');
  const actor = await exigirEditor(user);
  const columnas = await columnasDe(tipo);
  await conInforme({ tipo, codigo, actor, crear: false }, async ({ informe, newRequest }) => {
    verificarVersion(informe, body.version);
    if (!informe || informe.estado === 'EMITIDO' || informe.validacion_estado !== 'PENDIENTE') {
      throw httpError(409, 'El informe no está pendiente de validación.');
    }
    if (body.decision === 'APROBAR') {
      aprobacion.exigirHuella(informe, {
        fuente: await leerFuente(tipo, codigo, columnas, newRequest(), true),
        datos: leerDatos(informe.datos),
        fotos: await revisiones.fotosVigentes(newRequest(), informe.id),
      });
    }
    const aprobado = body.decision === 'APROBAR';
    await newRequest()
      .input('id', sql.Int, informe.id)
      .input('estado', sql.VarChar(20), aprobado ? 'APROBADO' : 'OBSERVADO')
      .input('observacion', sql.NVarChar(500), body.observacion)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`UPDATE dbo.ST_INFORMES SET validacion_estado = @estado,
        validacion_resuelta_por = @usuario, validacion_resuelta_en = SYSUTCDATETIME(), validacion_observacion = @observacion,
        version = version + 1, actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME() WHERE id = @id;`);
    await registrarHistorial(newRequest, { informeId: informe.id,
      accion: aprobado ? 'VALIDACION_APROBADA' : 'VALIDACION_OBSERVADA',
      detalle: aprobado ? 'Aprobado por personal autorizado para emitir' : 'Devuelto al técnico para corregir',
      motivo: body.observacion, revision: revisiones.revisionDeCambio(informe), actor });
  });
  return getInforme(tipo, codigo, user);
};

const retirarValidacion = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  await conInforme({ tipo, codigo, actor, crear: false }, async ({ informe, newRequest }) => {
    verificarVersion(informe, body.version);
    if (!informe || informe.estado === 'EMITIDO' || !aprobacion.bloqueada(informe)) {
      throw httpError(409, 'El informe no tiene una validación que se pueda retirar.');
    }
    await newRequest().input('id', sql.Int, informe.id).input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`UPDATE dbo.ST_INFORMES SET ${LIMPIAR_VALIDACION}, version = version + 1,
        actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME() WHERE id = @id;`);
    await registrarHistorial(newRequest, { informeId: informe.id, accion: 'VALIDACION_RETIRADA',
      detalle: 'Validación retirada para editar; requiere un nuevo envío y aprobación',
      revision: revisiones.revisionDeCambio(informe), actor });
  });
  return getInforme(tipo, codigo, user);
};

/** Redacción con toda la ficha efectiva y los cambios aún no guardados. */
const sugerirRedaccion = async (body, user) => {
  await exigirEditor(user);
  const columnas = await columnasDe(body.tipo);
  const fuente = await leerFuente(body.tipo, body.codigo, columnas);
  const informe = await leerInforme(body.tipo, body.codigo);
  verificarVersion(informe, body.version);
  exigirBorradorEditable(informe);
  const meta = columnas.get(body.campo);
  if (!esEditable(body.campo, meta) || meta.tipo !== 'texto') throw httpError(400, 'La IA solo puede redactar campos de texto editables.');
  const plan = planCambios({ fuente, datos: leerDatos(informe?.datos), entrantes: body.cambios, columnas });
  const datos = { ...fuente, ...plan.datos, [body.campo]: coercer(body.campo, meta, body.texto) };
  return redaccion.mejorarRedaccion({
    texto: body.texto,
    seccion: body.seccion,
    servicio: TIPOS[body.tipo].etiqueta.toLowerCase(),
    datos,
    maximo: Math.min(meta.max, 4000),
  });
};

// Solo se archivan revisiones emitidas; los PDF antiguos siguen consultables.
const contextoArchivo = async (tipo, codigo, user, meta, newRequest) => {
  const actor = await exigirEditor(user);
  const request = newRequest || (() => getPool().request());
  const informe = await leerInforme(tipo, codigo, request(), { bloquear: Boolean(newRequest) });
  if (!informe) await leerFuente(tipo, codigo, await columnasDe(tipo));
  if (meta?.borrador) {
    throw httpError(409, 'Apruebe y emita el informe antes de guardar su PDF.');
  } else if (meta) {
    const copia = informe && await revisiones.leerCopia(request(), informe.id, meta.revision);
    if (!copia) {
      if (informe?.estado !== 'EMITIDO' || meta.revision !== (informe.revision ?? 0)) {
        throw httpError(409, 'La revisión emitida ya no está disponible. Recargue el informe.');
      }
      verificarVersion(informe, meta.version);
      await asegurarCopiaVigente(request, { informe, fuente: await leerFuente(tipo, codigo, await columnasDe(tipo), request(), true) });
    }
  }
  return actor;
};

module.exports = {
  // Flujos de este archivo.
  abrirRevision,
  cambiarOtst,
  cancelarRevision,
  contextoArchivo,
  emitirInforme,
  enviarValidacion,
  guardarCambios,
  reemitirInforme,
  resolverValidacion,
  retirarValidacion,
  sugerirRedaccion,
  // Columnas y valores.
  PROTEGIDAS,
  coercer,
  columnasDe,
  esEditable,
  leerDatos,
  mapColumna,
  normalizarFuente,
  planCambios,
  // Permisos.
  exigirEditor,
  exigirLector,
  permisos,
  puedeEditarArea,
  // Lista.
  buildGroupsQuery,
  buildListQuery,
  claveTecnico,
  getFiltros,
  listGrupos,
  listInformes,
  mapFila,
  mapGrupo,
  mapResumen,
  // Detalle.
  esPublicado,
  exigirPublicado,
  getInforme,
  getRevision,
  mapDetalle,
  // Escritura.
  marcarIa,
  verificarVersion,
  // Fotos.
  agregarFoto,
  editarFoto,
  ordenarFotos,
  quitarFoto,
};
