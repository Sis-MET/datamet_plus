/** Fotos de un informe: agregar, describir, quitar (con motivo) y ordenar. */
const { sql } = require('../config/db');
const { MAX_FOTOS, httpError } = require('./soporte.validation');
const revisiones = require('./soporte.revisiones');
const { columnasDe, iguales } = require('./soporte.columnas');
const { exigirEditor } = require('./soporte.permisos');
const { getInforme, leerFuente } = require('./soporte.detalle');
const { conInforme, exigirBorradorEditable, registrarHistorial } = require('./soporte.escritura');

/**
 * Las fotos no tocan la versión del informe (no chocan con la edición de
 * campos). En un informe emitido hay que abrir una revisión antes; con la
 * revisión abierta, el cambio es parte de su borrador.
 */
const revisionTrasCambio = async (newRequest, informe, actor) => {
  await newRequest()
    .input('id', sql.Int, informe.id)
    .input('usuario', sql.NVarChar(50), actor.usuario)
    .query(`
      UPDATE dbo.ST_INFORMES
      SET actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
      WHERE id = @id;`);
  return revisiones.revisionDeCambio(informe);
};

const etiquetaFoto = (orden, descripcion) => `Foto ${orden}${descripcion ? `: ${descripcion}` : ''}`;

const agregarFoto = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor }, async ({ informe, newRequest }) => {
    exigirBorradorEditable(informe);
    const estado = await newRequest()
      .input('id', sql.Int, informe.id)
      .query(`
        SELECT COUNT(*) AS vigentes, ISNULL(MAX(orden), 0) AS ultimo
        FROM dbo.ST_INFORMES_FOTOS WITH (UPDLOCK, HOLDLOCK)
        WHERE informe_id = @id AND quitada_en IS NULL;`);
    const { vigentes, ultimo } = estado.recordset[0];
    if (vigentes >= MAX_FOTOS) throw httpError(400, `El informe admite hasta ${MAX_FOTOS} fotos.`);
    const orden = ultimo + 1;
    await newRequest()
      .input('id', sql.Int, informe.id)
      .input('orden', sql.Int, orden)
      .input('descripcion', sql.NVarChar(300), body.descripcion)
      .input('nombre', sql.NVarChar(255), body.nombre)
      .input('tipo', sql.NVarChar(50), body.contenido.tipo)
      .input('contenido', sql.VarBinary(sql.MAX), body.contenido.bytes)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`
        INSERT INTO dbo.ST_INFORMES_FOTOS (informe_id, orden, descripcion, nombre, tipo, contenido, subido_por)
        VALUES (@id, @orden, @descripcion, @nombre, @tipo, @contenido, @usuario);`);
    const revision = await revisionTrasCambio(newRequest, informe, actor);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'FOTO_AGREGADA',
      detalle: etiquetaFoto(vigentes + 1, body.descripcion),
      revision,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

/** Foto vigente del informe, bloqueada para cambiarla. */
const leerFoto = async (newRequest, informe, fotoId) => {
  if (!informe) throw httpError(404, 'La foto no existe.');
  const result = await newRequest()
    .input('informe', sql.Int, informe.id)
    .input('foto', sql.Int, fotoId)
    .query(`
      SELECT id, orden, descripcion FROM dbo.ST_INFORMES_FOTOS WITH (UPDLOCK, HOLDLOCK)
      WHERE id = @foto AND informe_id = @informe AND quitada_en IS NULL;`);
  const foto = result.recordset[0];
  if (!foto) throw httpError(404, 'La foto no existe o ya fue quitada.');
  return foto;
};

/** Posición (1, 2, …) de la foto entre las vigentes, como se imprime. */
const posicionFoto = async (newRequest, informeId, fotoId) => {
  const result = await newRequest()
    .input('informe', sql.Int, informeId)
    .query(`SELECT id FROM dbo.ST_INFORMES_FOTOS WHERE informe_id = @informe AND quitada_en IS NULL ORDER BY orden, id;`);
  return result.recordset.findIndex(row => row.id === fotoId) + 1;
};

const editarFoto = async (tipo, codigo, fotoId, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    const foto = await leerFoto(newRequest, informe, fotoId);
    if (iguales(foto.descripcion ?? null, body.descripcion)) return;
    exigirBorradorEditable(informe);
    await newRequest()
      .input('foto', sql.Int, foto.id)
      .input('descripcion', sql.NVarChar(300), body.descripcion)
      .query('UPDATE dbo.ST_INFORMES_FOTOS SET descripcion = @descripcion WHERE id = @foto;');
    const revision = await revisionTrasCambio(newRequest, informe, actor);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'FOTO_EDITADA',
      detalle: `Descripción de la foto ${await posicionFoto(newRequest, informe.id, foto.id)}`,
      cambios: [{ campo: 'descripcion', antes: foto.descripcion ?? null, despues: body.descripcion }],
      revision,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

const quitarFoto = async (tipo, codigo, fotoId, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    const foto = await leerFoto(newRequest, informe, fotoId);
    exigirBorradorEditable(informe);
    const posicion = await posicionFoto(newRequest, informe.id, foto.id);
    await newRequest()
      .input('foto', sql.Int, foto.id)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .input('motivo', sql.NVarChar(500), body.motivo)
      .query(`
        UPDATE dbo.ST_INFORMES_FOTOS
        SET quitada_por = @usuario, quitada_en = SYSUTCDATETIME(), quitada_motivo = @motivo
        WHERE id = @foto;`);
    const revision = await revisionTrasCambio(newRequest, informe, actor);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'FOTO_QUITADA',
      detalle: etiquetaFoto(posicion, foto.descripcion),
      revision,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

const ordenarFotos = async (tipo, codigo, body, user) => {
  const actor = await exigirEditor(user);
  const fuente = await leerFuente(tipo, codigo, await columnasDe(tipo));

  await conInforme({ tipo, codigo, fuente, actor, crear: false }, async ({ informe, newRequest }) => {
    if (!informe) throw httpError(404, 'El informe no tiene fotos.');
    const actuales = await newRequest()
      .input('informe', sql.Int, informe.id)
      .query(`
        SELECT id FROM dbo.ST_INFORMES_FOTOS WITH (UPDLOCK, HOLDLOCK)
        WHERE informe_id = @informe AND quitada_en IS NULL ORDER BY orden, id;`);
    const ids = actuales.recordset.map(row => row.id);
    if (ids.length !== body.ids.length || ids.some(id => !body.ids.includes(id))) {
      throw httpError(409, 'Las fotos cambiaron mientras las ordenaba. Vuelva a intentarlo.');
    }
    if (ids.every((id, index) => id === body.ids[index])) return;
    exigirBorradorEditable(informe);
    for (const [index, id] of body.ids.entries()) {
      await newRequest()
        .input('foto', sql.Int, id)
        .input('orden', sql.Int, index + 1)
        .query('UPDATE dbo.ST_INFORMES_FOTOS SET orden = @orden WHERE id = @foto;');
    }
    const revision = await revisionTrasCambio(newRequest, informe, actor);
    await registrarHistorial(newRequest, {
      informeId: informe.id,
      accion: 'FOTOS_ORDEN',
      detalle: 'Nuevo orden de las fotos',
      revision,
      actor,
    });
  });

  return getInforme(tipo, codigo, user);
};

module.exports = { agregarFoto, editarFoto, ordenarFotos, quitarFoto };
