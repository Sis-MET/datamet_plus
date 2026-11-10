/**
 * Emisión de los certificados de calibración (fase 5, migración 020).
 *
 * APROBADO → AUTORIZADO: el jefe de Calibración autoriza; se fija el número
 * y se guarda congelado el contenido del certificado (CAL_EMISIONES) con su
 * huella, que también va dentro del PDF para firmar (/Keywords).
 * AUTORIZADO → EMITIDO: el jefe firma el PDF con su firma digital fuera de
 * DataMET+ y lo sube. Se exige la firma, que el PDF sea el de esta emisión
 * (lleva su huella) y la fecha de la firma, que es la fecha de emisión
 * (7.8.2.1). El PDF queda en CAL_DOCUMENTOS_DIR\<año> con su huella SHA-256 y
 * nunca se sobrescribe (8.4).
 * EMITIDO → BORRADOR (abrir revisión, 7.8.8): con motivo; la emisión vigente
 * lo sigue siendo hasta que la siguiente (02, 03…) se emite y la reemplaza.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { getPool, sql } = require('../config/db');
const env = require('../config/env');
const { actorName, clean, httpError, withTransaction } = require('./calibration.db');
const { crearArchivo, validarPdf } = require('./soporte.archivos');
const { personaCalibracion } = require('./calibration.aprobadores');
const { contenidoCertificado, textoEmision } = require('./calibration.certificado');

const sha256 = (valor) => createHash('sha256').update(valor).digest('hex');

// ─── Reglas puras ──────────────────────────────────────────────────────────

/** Marca que va en el PDF para firmar: identifica la emisión al subir el firmado. */
const marcaPdf = (huella) => `DataMET+ ${huella}`;

/** UTF-16BE en hexadecimal (como escriben algunos programas las cadenas del PDF). */
const hexUtf16 = (texto) => [...texto].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');

/** ¿El PDF lleva la huella de esta emisión (tal cual o reescrita en UTF-16)? */
const contieneMarca = (pdf, huella) => {
  const texto = pdf.toString('latin1');
  if (texto.includes(huella)) return true;
  const hex = hexUtf16(huella);
  return texto.toLowerCase().includes(hex);
};

/**
 * Firma digital del PDF: hay firma si tiene un diccionario de firma
 * (/ByteRange con /Type /Sig o un /SubFilter de firma). La fecha es la /M más
 * reciente cerca de cada /ByteRange («D:AAAAMMDD…», hora local del firmante).
 */
const analizarFirma = (pdf) => {
  const texto = pdf.toString('latin1');
  const firmado = /\/ByteRange\s*\[/.test(texto)
    && (/\/Type\s*\/Sig\b/.test(texto) || /\/SubFilter\s*\/(adbe\.pkcs7|ETSI\.CAdES|adbe\.x509)/.test(texto));
  const fechas = [];
  for (const coincidencia of texto.matchAll(/\/ByteRange\s*\[/g)) {
    const ventana = texto.slice(Math.max(0, coincidencia.index - 6000), coincidencia.index + 6000);
    for (const m of ventana.matchAll(/\/M\s*\(D:(\d{4})(\d{2})(\d{2})/g)) fechas.push(`${m[1]}-${m[2]}-${m[3]}`);
  }
  const validas = fechas.filter(f => !Number.isNaN(Date.parse(`${f}T00:00:00Z`))).sort();
  return { firmado, fecha: validas.length ? validas[validas.length - 1] : null };
};

/** Carpeta del año del certificado: «0051-C01-30-26» → «2026». */
const anioDe = (numero) => {
  const m = String(numero || '').match(/-(\d{2})$/);
  return m ? `20${m[1]}` : null;
};

/** Fecha de hoy en Bolivia (UTC−4). */
const hoyBolivia = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Número, emisión y revisiones de la próxima emisión de un registro, a
 * partir de las anteriores. La primera toma el número que arma el contenido.
 */
const siguienteEmision = (emisiones, revisionMotivo) => {
  const validas = emisiones.filter(e => e.estado !== 'ANULADO');
  const emitidas = validas.filter(e => ['EMITIDO', 'REEMPLAZADO'].includes(e.estado));
  const ultima = validas.reduce((max, e) => Math.max(max, e.emision), 0);
  const vigente = emitidas.find(e => e.estado === 'EMITIDO') || null;
  const emision = ultima + 1;
  if (!emitidas.length) return { emision, numero: null, revisiones: [], reemplaza: null };
  return {
    emision,
    numero: emitidas[0].numero,
    revisiones: [
      ...emitidas.map(e => ({ emision: textoEmision(e.emision), fecha: e.firmaFecha, motivo: e.motivo || 'Emisión original.' })),
      { emision: textoEmision(emision), fecha: null, motivo: revisionMotivo || '' },
    ],
    reemplaza: vigente
      ? `Esta emisión ${textoEmision(emision)} reemplaza a la emisión ${textoEmision(vigente.emision)}, firmada el ${vigente.firmaFecha}.`
      : null,
  };
};

// ─── Acceso a datos ────────────────────────────────────────────────────────

const archivo = () => crearArchivo(env.calibration.documentosDir, { area: 'Calibración' });

const leerEmisiones = async (createRequest, registroId) => {
  const result = await createRequest().input('id', sql.Int, registroId).query(`
    SELECT id, numero, emision, estado, contenido_huella, archivo_nombre, motivo, autorizado_por, autorizado_nombre,
      CONVERT(varchar(19), autorizado_en, 126) AS autorizado_en, CONVERT(varchar(10), firma_fecha, 23) AS firma_fecha,
      firma_detectada, carpeta, raiz_huella, pdf_huella, pdf_tamano, emitido_por,
      CONVERT(varchar(19), emitido_en, 126) AS emitido_en, anulado_por, anulado_motivo
    FROM dbo.CAL_EMISIONES WHERE registro_id = @id ORDER BY emision, id`);
  return result.recordset.map(row => ({
    id: row.id,
    numero: row.numero,
    emision: row.emision,
    estado: row.estado,
    huella: row.contenido_huella,
    archivo: row.archivo_nombre,
    motivo: clean(row.motivo),
    autorizadoPor: clean(row.autorizado_nombre) || clean(row.autorizado_por),
    autorizadoEn: row.autorizado_en ? `${row.autorizado_en}Z` : null,
    firmaFecha: row.firma_fecha,
    firmaDetectada: row.firma_detectada == null ? null : Boolean(row.firma_detectada),
    carpeta: row.carpeta,
    raizHuella: row.raiz_huella,
    pdfHuella: row.pdf_huella,
    pdfTamano: row.pdf_tamano,
    emitidoPor: clean(row.emitido_por),
    emitidoEn: row.emitido_en ? `${row.emitido_en}Z` : null,
    anuladoPor: clean(row.anulado_por),
    anuladoMotivo: clean(row.anulado_motivo),
  }));
};

const leerContenido = async (createRequest, emisionId) => {
  const result = await createRequest().input('id', sql.Int, emisionId)
    .query('SELECT contenido FROM dbo.CAL_EMISIONES WHERE id = @id');
  return result.recordset[0] ? JSON.parse(result.recordset[0].contenido) : null;
};

/** Lo que se muestra de cada emisión (sin rutas del servidor). */
const publica = (e) => ({
  numero: e.numero,
  emision: e.emision,
  estado: e.estado,
  archivo: e.archivo,
  motivo: e.motivo,
  autorizadoPor: e.autorizadoPor,
  autorizadoEn: e.autorizadoEn,
  firmaFecha: e.firmaFecha,
  firmaDetectada: e.firmaDetectada,
  carpeta: e.carpeta,
  emitidoPor: e.emitidoPor,
  emitidoEn: e.emitidoEn,
  anuladoPor: e.anuladoPor,
  anuladoMotivo: e.anuladoMotivo,
});

const registros = () => require('./calibration.registros');

/** Registro bloqueado, con su modelo corregido y el cálculo, para emitir. */
const registroParaEmitir = async (createRequest, codigo) => {
  const r = registros();
  const fila = await r.filaVigente(codigo, createRequest);
  const registro = await r.leerRegistro(createRequest, codigo, { lock: true });
  if (!registro) throw httpError(404, 'El servicio no tiene registro de calibración.');
  const datos = r.datosDe(registro.datos);
  const columnas = await r.columnasCalibracion();
  const fuente = r.normalizarFuente(fila, columnas);
  // Igual a la huella del envío (también con la forma anterior de los datos).
  const sinCambios = r.coincideHuella({ fuente, datos }, registro.huella);
  return { registro, datos, fila, sinCambios };
};

const exigirJefe = async (user, accion) => {
  const persona = await personaCalibracion(user);
  if (!persona.jefe) throw httpError(403, `Solo el jefe de Calibración ${accion}.`);
  return persona;
};

// ─── Operaciones ───────────────────────────────────────────────────────────

/**
 * Autoriza el certificado de un registro aprobado: fija número y emisión y
 * congela el contenido. Exige que los datos no hayan cambiado desde el envío.
 */
const autorizar = async (codigo, user) => {
  const persona = await exigirJefe(user, 'autoriza los certificados');
  return withTransaction(async (createRequest) => {
    const { registro, datos, fila, sinCambios } = await registroParaEmitir(createRequest, codigo);
    if (registro.estado !== 'APROBADO') throw httpError(409, 'Solo se autoriza un registro aprobado.');
    if (!sinCambios) throw httpError(409, 'Los datos cambiaron desde la aprobación. Reábrelo y vuelve a enviarlo a revisión.');
    const r = registros();
    const { modelo } = await r.modeloCorregido(fila, datos);
    // Con la versión del método con la que se aprobó (fase 6).
    const calculo = await r.calcularModelo(modelo, datos, { version: r.versionDe(registro) });
    if (!calculo.calculado || calculo.provisional) throw httpError(409, 'El cálculo no está completo: no se puede autorizar.');
    const { textos } = await require('./calibration.metodo').configuracionDe(calculo.configuracion);

    const emisiones = await leerEmisiones(createRequest, registro.id);
    const siguiente = siguienteEmision(emisiones, clean(registro.revision_motivo));
    const { contenido, archivo: nombre, bloqueos } = contenidoCertificado(
      { modelo, calculo, creadoEn: registro.creado_en ? `${registro.creado_en}Z` : null, anexo: datos.anexo, usp: datos.usp, textos },
      { ...siguiente },
    );
    if (bloqueos.length) throw httpError(409, `No se puede autorizar: ${bloqueos.join(' ')}`);
    if (siguiente.emision > 1 && !clean(registro.revision_motivo)) throw httpError(409, 'Falta el motivo de la revisión.');

    // El número no puede ser el de otro certificado.
    const otro = await createRequest()
      .input('numero', sql.NVarChar(30), contenido.numero)
      .input('id', sql.Int, registro.id)
      .query(`SELECT TOP 1 r.codigo_registro FROM dbo.CAL_EMISIONES e JOIN dbo.CAL_REGISTROS r ON r.id = e.registro_id
        WHERE e.numero = @numero AND e.estado <> 'ANULADO' AND e.registro_id <> @id`);
    if (otro.recordset[0]) {
      throw httpError(409, `El n.º ${contenido.numero} ya es del certificado del servicio ${otro.recordset[0].codigo_registro}. Revisa el SECA y el n.º de RECA.`);
    }

    const texto = JSON.stringify(contenido);
    const huellaContenido = sha256(texto);
    await createRequest()
      .input('registro', sql.Int, registro.id)
      .input('numero', sql.NVarChar(30), contenido.numero)
      .input('emision', sql.Int, siguiente.emision)
      .input('contenido', sql.NVarChar(sql.MAX), texto)
      .input('huella', sql.VarChar(64), huellaContenido)
      .input('archivo', sql.NVarChar(220), nombre)
      .input('motivo', sql.NVarChar(500), siguiente.emision > 1 ? clean(registro.revision_motivo) : null)
      .input('usuario', sql.NVarChar(50), actorName(user))
      .input('nombre', sql.NVarChar(120), persona.nombre)
      .query(`INSERT INTO dbo.CAL_EMISIONES (registro_id, numero, emision, estado, contenido, contenido_huella, archivo_nombre, motivo, autorizado_por, autorizado_nombre)
        VALUES (@registro, @numero, @emision, 'AUTORIZADO', @contenido, @huella, @archivo, @motivo, @usuario, @nombre)`);
    await createRequest().input('id', sql.Int, registro.id)
      .query("UPDATE dbo.CAL_REGISTROS SET estado = 'AUTORIZADO', version = version + 1 WHERE id = @id");
    await r.historial(createRequest, registro.id, 'AUTORIZACION', {
      detalle: `Certificado ${contenido.numero}, emisión ${textoEmision(siguiente.emision)}, autorizado`,
    }, user);
    return { codigo, estado: 'AUTORIZADO', numero: contenido.numero, emision: siguiente.emision };
  });
};

/** Anula la autorización antes de firmar (p. ej. el PDF salió con un error); vuelve a aprobado. */
const anularAutorizacion = async (codigo, { motivo }, user) => {
  await exigirJefe(user, 'anula una autorización');
  return withTransaction(async (createRequest) => {
    const r = registros();
    const registro = await r.leerRegistro(createRequest, codigo, { lock: true });
    if (!registro || registro.estado !== 'AUTORIZADO') throw httpError(409, 'El certificado no está autorizado.');
    const emision = (await leerEmisiones(createRequest, registro.id)).find(e => e.estado === 'AUTORIZADO');
    if (!emision) throw httpError(409, 'No hay una emisión autorizada.');
    await createRequest()
      .input('id', sql.Int, emision.id)
      .input('usuario', sql.NVarChar(50), actorName(user))
      .input('motivo', sql.NVarChar(500), motivo)
      .query(`UPDATE dbo.CAL_EMISIONES SET estado = 'ANULADO', anulado_por = @usuario, anulado_en = SYSUTCDATETIME(),
          anulado_motivo = @motivo WHERE id = @id`);
    await createRequest().input('id', sql.Int, registro.id)
      .query("UPDATE dbo.CAL_REGISTROS SET estado = 'APROBADO', version = version + 1 WHERE id = @id");
    await r.historial(createRequest, registro.id, 'ANULACION', {
      detalle: `Autorización de la emisión ${textoEmision(emision.emision)} anulada`, motivo,
    }, user);
    return { codigo, estado: 'APROBADO' };
  });
};

/**
 * Recibe el PDF firmado de la emisión autorizada, lo archiva en la carpeta
 * del año y deja el certificado emitido con la fecha de la firma.
 * fechaFirma: solo si el PDF no la trae legible.
 */
const subirFirmado = async (codigo, pdf, { fechaFirma = null } = {}, user) => {
  await exigirJefe(user, 'sube el certificado firmado');
  validarPdf(pdf);
  const r = registros();
  const registro = await r.leerRegistro(() => getPool().request(), codigo);
  if (!registro || registro.estado !== 'AUTORIZADO') throw httpError(409, 'El certificado no está autorizado para firmar.');
  const emision = (await leerEmisiones(() => getPool().request(), registro.id)).find(e => e.estado === 'AUTORIZADO');
  if (!emision) throw httpError(409, 'No hay una emisión autorizada.');

  const firma = analizarFirma(pdf);
  if (!firma.firmado) throw httpError(400, 'El PDF no tiene firma digital. Fírmalo y vuelve a subirlo.');
  if (!contieneMarca(pdf, emision.huella)) {
    throw httpError(409, `El PDF no corresponde a la emisión autorizada (${emision.numero}, emisión ${textoEmision(emision.emision)}). Firma el «PDF para firmar» de esta emisión.`);
  }
  const fecha = firma.fecha || fechaFirma;
  if (!fecha) throw httpError(400, 'No se pudo leer la fecha de la firma en el PDF. Indícala.');
  const autorizadoDia = emision.autorizadoEn ? new Date(new Date(emision.autorizadoEn).getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10) : null;
  if (fecha > hoyBolivia()) throw httpError(400, 'La fecha de la firma no puede ser posterior a hoy.');
  if (autorizadoDia && fecha < autorizadoDia) throw httpError(400, `La fecha de la firma (${fecha}) es anterior a la autorización (${autorizadoDia}).`);

  // Archivo: carpeta del año (se crea si falta) y el nombre de la emisión.
  const area = archivo();
  const anio = anioDe(emision.numero) || fecha.slice(0, 4);
  const { base } = await area.resolver('');
  await fs.mkdir(path.join(base, anio)).catch((error) => {
    if (error.code !== 'EEXIST') throw httpError(503, 'No se pudo crear la carpeta del año en el archivo de Calibración.');
  });
  const guardado = await area.guardar(anio, emision.archivo, pdf);

  return withTransaction(async (createRequest) => {
    const actual = await r.leerRegistro(createRequest, codigo, { lock: true });
    if (!actual || actual.estado !== 'AUTORIZADO') throw httpError(409, 'El certificado cambió mientras se subía el PDF. Vuelve a abrirlo.');
    await createRequest()
      .input('registro', sql.Int, actual.id)
      .input('id', sql.Int, emision.id)
      .query("UPDATE dbo.CAL_EMISIONES SET estado = 'REEMPLAZADO' WHERE registro_id = @registro AND estado = 'EMITIDO' AND id <> @id");
    await createRequest()
      .input('id', sql.Int, emision.id)
      .input('fecha', sql.Date, fecha)
      .input('detectada', sql.Bit, Boolean(firma.fecha))
      .input('carpeta', sql.NVarChar(400), anio)
      .input('raiz', sql.VarChar(64), guardado.raizHuella)
      .input('huella', sql.VarChar(64), guardado.huella)
      .input('tamano', sql.Int, pdf.length)
      .input('usuario', sql.NVarChar(50), actorName(user))
      .query(`UPDATE dbo.CAL_EMISIONES SET estado = 'EMITIDO', firma_fecha = @fecha, firma_detectada = @detectada, carpeta = @carpeta,
          raiz_huella = @raiz, pdf_huella = @huella, pdf_tamano = @tamano, emitido_por = @usuario, emitido_en = SYSUTCDATETIME()
        WHERE id = @id`);
    await createRequest().input('id', sql.Int, actual.id)
      .query("UPDATE dbo.CAL_REGISTROS SET estado = 'EMITIDO', revision_motivo = NULL, version = version + 1 WHERE id = @id");
    await r.historial(createRequest, actual.id, 'EMISION', {
      detalle: `Emisión ${textoEmision(emision.emision)} firmada el ${fecha}; PDF archivado en ${anio}\\${emision.archivo}`,
    }, user);
    return { codigo, estado: 'EMITIDO', fechaFirma: fecha, firmaDetectada: Boolean(firma.fecha), archivo: emision.archivo, carpeta: anio };
  });
};

/** Abre una revisión del certificado emitido (reemisión, 7.8.8): vuelve a borrador con su motivo. */
const abrirRevision = async (codigo, { motivo }, user) => {
  await exigirJefe(user, 'abre una revisión del certificado');
  return withTransaction(async (createRequest) => {
    const r = registros();
    const registro = await r.leerRegistro(createRequest, codigo, { lock: true });
    if (!registro || registro.estado !== 'EMITIDO') throw httpError(409, 'Solo se abre una revisión de un certificado emitido.');
    await createRequest()
      .input('id', sql.Int, registro.id)
      .input('motivo', sql.NVarChar(500), motivo)
      .query(`UPDATE dbo.CAL_REGISTROS SET estado = 'BORRADOR', revision_motivo = @motivo, observacion = NULL,
          version = version + 1 WHERE id = @id`);
    await r.historial(createRequest, registro.id, 'REVISION', { detalle: 'Revisión del certificado abierta', motivo }, user);
    return { codigo, estado: 'BORRADOR' };
  });
};

/** PDF firmado de una emisión, comprobado contra su huella. */
const abrirPdf = async (codigo, numeroEmision, user) => {
  const persona = await personaCalibracion(user);
  if (!persona.editor) throw httpError(403, 'Solo el área de Calibración consulta los certificados.');
  const r = registros();
  const registro = await r.leerRegistro(() => getPool().request(), codigo);
  if (!registro) throw httpError(404, 'El servicio no tiene registro de calibración.');
  const emision = (await leerEmisiones(() => getPool().request(), registro.id)).find(e => e.emision === numeroEmision && e.pdfHuella);
  if (!emision) throw httpError(404, 'Esa emisión no tiene PDF firmado.');
  const area = archivo();
  const destino = await area.resolver(emision.carpeta);
  if (destino.raizHuella !== emision.raizHuella) throw httpError(409, 'La carpeta del archivo de Calibración cambió. Solicita revisar la configuración del servidor.');
  const leido = await area.leer(emision.carpeta, emision.archivo);
  if (leido.huella !== emision.pdfHuella) throw httpError(409, 'El PDF archivado fue modificado fuera de DataMET+.');
  return { nombre: emision.archivo, contenido: leido.contenido };
};

module.exports = {
  abrirPdf,
  abrirRevision,
  analizarFirma,
  anioDe,
  anularAutorizacion,
  autorizar,
  contieneMarca,
  leerContenido,
  leerEmisiones,
  marcaPdf,
  publica,
  siguienteEmision,
  subirFirmado,
};
