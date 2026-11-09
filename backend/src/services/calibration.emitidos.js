/**
 * Certificados emitidos (Calibración › Certificados › Emitidos): el libro de
 * certificados del laboratorio. Cada certificado (su n.º) con sus emisiones
 * (01, 02…), el cliente y el instrumento tal como se autorizaron (del
 * contenido congelado), la fecha de la firma y quién autorizó. Solo lee.
 *
 * Estado del certificado: VIGENTE si tiene una emisión firmada (y, si hay una
 * reemisión autorizada sin firmar, lo dice); POR_FIRMAR si está autorizado y
 * aún no se sube el firmado; ANULADO si todas sus autorizaciones se anularon
 * antes de firmar (nunca llegó al cliente).
 */
const { getPool } = require('../config/db');
const { clean } = require('./calibration.db');

const fecha = valor => (valor ? `${valor}Z` : null);

/** Año del certificado: el de su número (NNNN-CNN-RR-AA). */
const anioDe = (numero) => {
  const aa = String(numero || '').match(/-(\d{2})$/);
  return aa ? 2000 + Number(aa[1]) : null;
};

/** Agrupa las emisiones (filas de CAL_EMISIONES) por certificado. */
const agruparEmitidos = (filas) => {
  const porNumero = new Map();
  for (const f of filas) {
    if (!porNumero.has(f.numero)) porNumero.set(f.numero, []);
    porNumero.get(f.numero).push(f);
  }
  return [...porNumero.entries()].map(([numero, lista]) => {
    const emisiones = [...lista].sort((a, b) => a.emision - b.emision || a.id - b.id).map(f => ({
      emision: f.emision,
      estado: f.estado,
      archivo: f.archivo_nombre,
      motivo: clean(f.motivo),
      autorizadoPor: clean(f.autorizado_nombre) || clean(f.autorizado_por),
      autorizadoEn: fecha(f.autorizado_en),
      firmaFecha: f.firma_fecha || null,
      firmaDetectada: f.firma_detectada == null ? null : Boolean(f.firma_detectada),
      emitidoEn: fecha(f.emitido_en),
      anuladoMotivo: clean(f.anulado_motivo),
    }));
    const vigente = emisiones.find(e => e.estado === 'EMITIDO') || null;
    const porFirmar = emisiones.find(e => e.estado === 'AUTORIZADO') || null;
    // Los datos que se muestran: los de la emisión firmada (la que tiene el
    // cliente); sin ella, los de la última que llegó a autorizarse.
    const ultima = lista.find(f => f.estado === 'EMITIDO')
      || [...lista].sort((a, b) => b.emision - a.emision || b.id - a.id).find(f => f.estado !== 'ANULADO')
      || lista.at(-1);
    let estado = 'ANULADO';
    if (vigente) estado = 'VIGENTE';
    else if (porFirmar) estado = 'POR_FIRMAR';
    return {
      numero,
      anio: anioDe(numero),
      codigo: ultima.codigo_registro,
      estado,
      vigente: vigente ? vigente.emision : null,
      reemisionPorFirmar: Boolean(vigente && porFirmar),
      cliente: clean(ultima.cliente),
      instrumento: {
        tipo: clean(ultima.tipo),
        marca: clean(ultima.marca),
        modelo: clean(ultima.modelo),
        serie: clean(ultima.serie),
        id: clean(ultima.id_instrumento),
        max: clean(ultima.max),
        unidad: clean(ultima.unidad),
      },
      fechaCalibracion: clean(ultima.fecha_calibracion),
      emisiones,
    };
  }).sort((a, b) => (b.anio || 0) - (a.anio || 0) || String(b.numero).localeCompare(String(a.numero), 'es', { numeric: true }));
};

/** Los certificados con sus emisiones y el resumen por estado. */
const listarEmitidos = async () => {
  const { recordset } = await getPool().request().query(`
    SELECT e.id, e.numero, e.emision, e.estado, e.archivo_nombre, e.motivo, e.autorizado_por, e.autorizado_nombre,
      CONVERT(varchar(19), e.autorizado_en, 126) AS autorizado_en, CONVERT(varchar(10), e.firma_fecha, 23) AS firma_fecha,
      e.firma_detectada, CONVERT(varchar(19), e.emitido_en, 126) AS emitido_en, e.anulado_motivo,
      r.codigo_registro,
      JSON_VALUE(e.contenido, '$.cliente.razonSocial') AS cliente,
      JSON_VALUE(e.contenido, '$.instrumento.tipo') AS tipo,
      JSON_VALUE(e.contenido, '$.instrumento.marca') AS marca,
      JSON_VALUE(e.contenido, '$.instrumento.modelo') AS modelo,
      JSON_VALUE(e.contenido, '$.instrumento.serie') AS serie,
      JSON_VALUE(e.contenido, '$.instrumento.idInstrumento') AS id_instrumento,
      JSON_VALUE(e.contenido, '$.instrumento.max') AS max,
      JSON_VALUE(e.contenido, '$.instrumento.unidad') AS unidad,
      JSON_VALUE(e.contenido, '$.calibracion.fecha') AS fecha_calibracion
    FROM dbo.CAL_EMISIONES e
    JOIN dbo.CAL_REGISTROS r ON r.id = e.registro_id`);
  const certificados = agruparEmitidos(recordset);
  const resumen = { total: certificados.length, VIGENTE: 0, POR_FIRMAR: 0, ANULADO: 0, reemisiones: 0 };
  for (const c of certificados) {
    resumen[c.estado] += 1;
    if (c.emisiones.some(e => e.emision > 1 && e.estado !== 'ANULADO')) resumen.reemisiones += 1;
  }
  return { certificados, resumen };
};

module.exports = { agruparEmitidos, anioDe, listarEmitidos };
