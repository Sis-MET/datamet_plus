// Flujo completo de la emisión con la base simulada: autorizar, subir el PDF
// firmado (archivado en una carpeta temporal), abrir revisión, reemitir y
// anular. Las funciones del registro que leen la base se reemplazan.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-emin-'));
const env = require('../src/config/env');
env.calibration.documentosDir = carpeta;

const db = require('../src/config/db');
const transacciones = require('../src/services/calibration.db');
const aprobadores = require('../src/services/calibration.aprobadores');
const motor = require('../src/services/calibracion/motor');
const { calcularServicio } = require('../src/services/calibracion/motor/servicio');
const { modeloDeFila } = require('../src/services/calibration.fuente');
const { empR111 } = require('../src/services/calibration.patrones');

// ─── Base simulada ──────────────────────────────────────────────────────────
let estado;
const reiniciar = () => {
  estado = {
    registro: {
      id: 7, codigo_registro: 'SRV-1', datos: '{}', estado: 'APROBADO', huella: 'H', version: 3,
      creado_en: '2026-11-02T14:00:00', revision_motivo: null,
    },
    emisiones: [],
    historial: [],
  };
};
class Request {
  constructor() { this.p = {}; }
  input(nombre, _tipo, valor) { this.p[nombre] = valor; return this; }
  async query(q) {
    const r = (filas) => ({ recordset: structuredClone(filas) });
    // Sin versiones del método: rige la inicial (fase 6).
    if (q.includes('FROM dbo.CAL_METODO_VERSIONES')) return r([]);
    if (q.includes('FROM dbo.CAL_EMISIONES WHERE registro_id')) {
      return r(estado.emisiones.map(e => ({ ...e, autorizado_en: '2026-11-03T13:00:00', emitido_en: e.emitido_por ? '2026-11-04T13:00:00' : null })));
    }
    if (q.includes('SELECT TOP 1 r.codigo_registro')) {
      return r(estado.otros?.some(o => o.numero === this.p.numero) ? [{ codigo_registro: 'OTRO' }] : []);
    }
    if (q.includes('SELECT contenido FROM dbo.CAL_EMISIONES')) return r(estado.emisiones.filter(e => e.id === this.p.id).map(e => ({ contenido: e.contenido })));
    if (q.includes('INSERT INTO dbo.CAL_EMISIONES')) {
      estado.emisiones.push({
        id: estado.emisiones.length + 1, numero: this.p.numero, emision: this.p.emision, estado: 'AUTORIZADO', contenido: this.p.contenido,
        contenido_huella: this.p.huella, archivo_nombre: this.p.archivo, motivo: this.p.motivo, autorizado_por: this.p.usuario, autorizado_nombre: this.p.nombre,
      });
      return r([]);
    }
    if (q.includes("SET estado = 'REEMPLAZADO'")) {
      estado.emisiones.filter(e => e.estado === 'EMITIDO' && e.id !== this.p.id).forEach(e => { e.estado = 'REEMPLAZADO'; });
      return r([]);
    }
    if (q.includes("UPDATE dbo.CAL_EMISIONES SET estado = 'EMITIDO'")) {
      Object.assign(estado.emisiones.find(e => e.id === this.p.id), {
        estado: 'EMITIDO', firma_fecha: this.p.fecha, firma_detectada: this.p.detectada, carpeta: this.p.carpeta,
        raiz_huella: this.p.raiz, pdf_huella: this.p.huella, pdf_tamano: this.p.tamano, emitido_por: this.p.usuario,
      });
      return r([]);
    }
    if (q.includes("UPDATE dbo.CAL_EMISIONES SET estado = 'ANULADO'")) {
      Object.assign(estado.emisiones.find(e => e.id === this.p.id), { estado: 'ANULADO', anulado_por: this.p.usuario, anulado_motivo: this.p.motivo });
      return r([]);
    }
    const nuevoEstado = q.match(/UPDATE dbo\.CAL_REGISTROS SET estado = '(\w+)'/);
    if (nuevoEstado) {
      estado.registro.estado = nuevoEstado[1];
      if (q.includes('revision_motivo = @motivo')) estado.registro.revision_motivo = this.p.motivo;
      if (q.includes('revision_motivo = NULL')) estado.registro.revision_motivo = null;
      return r([]);
    }
    throw new Error(`SQL inesperado: ${q}`);
  }
}
db.getPool = () => ({ request: () => new Request() });
transacciones.withTransaction = async (fn) => {
  const antes = structuredClone(estado);
  try { return await fn(() => new Request()); } catch (error) { estado = antes; throw error; }
};
let jefe = true;
aprobadores.personaCalibracion = async (user) => ({ usuario: user.usuario, nombre: 'Jefe QA', jefe, revisor: jefe, editor: true });

// ─── Registro simulado ──────────────────────────────────────────────────────
const fila = {
  codigo_registro: 'SRV-1', seca: '0051-11-C01-26', n_reca: '30', sticker: '9934', personal: 'Ing. Prueba',
  fecha_servicio: new Date('2026-11-02T00:00:00Z'), unidades: 'g', razon_social: 'CLIENTE S.A.', marca: 'MARCA', cod_metrica: '0051-11-035',
  cap_max1: 600, d1: 0.01, e1: 0.01, dec1: 2, equipo1: 'F1-TEST', equipo6: 'TH-TEST',
  hora: new Date('1970-01-01T11:00:00Z'), hri: 35, ti: 24, patmi: 630, hora_fin: new Date('1970-01-01T12:00:00Z'), hri_fin: 36, ti_fin: 24.8, patmi_fin: 630.8,
  repetibilidad1: 200, indicacion1_1: 200, indicacion1_2: 200.01, indicacion1_3: 200,
  lin1: 100, ind1: 100, lin2: 500, ind2: 500.01, emp: 'No', indicar: 0.01, regla_aceptacion: 'Simple',
};
const pieza = (g) => ({ nominalMg: g * 1000, identificacion: '', densidad: 7950, densidadU: 140, densidadK: 2, activa: true });
const PIEZAS = [pieza(500), pieza(100)];
const { modelo } = modeloDeFila(fila);
modelo.patrones.juegos[0].certificado = { numero: 'LP-CC-M-0182-2026', fecha: '2026-05-05' };
const calculo = {
  ...calcularServicio(modelo, {
    juegos: [{ codigo: 'F1-TEST', clase: 'F1', piezas: PIEZAS, valores: new Map(PIEZAS.map(p => [`${p.nominalMg}|`, { correccionMg: 0.1, uMg: 0.5, k: 2 }])), verificado: true, condiciones: null }],
    termohigrometro: {
      codigo: 'TH-TEST',
      puntos: {
        T: [{ punto: 15, correccion: 0, u: 0.3, k: 2 }, { punto: 30, correccion: 0, u: 0.3, k: 2 }],
        HR: [{ punto: 20, correccion: 0, u: 2, k: 2 }, { punto: 60, correccion: 0, u: 2, k: 2 }],
        P: [{ punto: 600, correccion: 0, u: 0.4, k: 2 }, { punto: 700, correccion: 0, u: 0.4, k: 2 }],
      },
    },
    empR111,
    configuracion: motor.CONFIGURACION_V1,
  }),
  juegos: [{ codigo: 'F1-TEST', clase: 'F1', rangoMg: { min: 100000, max: 500000 } }],
};

const registros = require('../src/services/calibration.registros');
Object.assign(registros, {
  filaVigente: async () => fila,
  leerRegistro: async () => structuredClone(estado.registro),
  columnasCalibracion: async () => new Map(),
  normalizarFuente: () => ({}),
  huellaDe: () => 'H',
  modeloCorregido: async () => ({ modelo: structuredClone(modelo), avisos: [] }),
  calcularModelo: async () => structuredClone(calculo),
  historial: async (_r, _id, accion, datos) => { estado.historial.push({ accion, ...datos }); },
});
const emision = require('../src/services/calibration.emision');

const usuario = { id: 1, usuario: 'jefe' };
const codigo = (n) => (e) => e.statusCode === n;
const firmado = (huella, fecha = '20261104') => Buffer.from([
  '%PDF-1.4', `<< /Keywords (${emision.marcaPdf(huella)}) >>`,
  `<< /Type /Sig /SubFilter /adbe.pkcs7.detached /M (D:${fecha}101500-04'00') /ByteRange [0 1 2 3] /Contents <00> >>`, '%%EOF',
].join('\n'), 'latin1');

test('autorizar, subir el firmado, reemitir y anular', async () => {
  assert.equal(calculo.calculado, true);
  assert.equal(calculo.provisional, false);
  reiniciar();

  // Solo el jefe autoriza; los datos no pueden haber cambiado desde la aprobación.
  jefe = false;
  await assert.rejects(emision.autorizar('SRV-1', usuario), codigo(403));
  jefe = true;
  estado.registro.huella = 'OTRA';
  await assert.rejects(emision.autorizar('SRV-1', usuario), codigo(409));
  estado.registro.huella = 'H';
  // Un número ya usado por otro certificado no se acepta.
  estado.otros = [{ numero: '0051-C01-30-26' }];
  await assert.rejects(emision.autorizar('SRV-1', usuario), /ya es del certificado/);
  estado.otros = [];

  const autorizado = await emision.autorizar('SRV-1', usuario);
  assert.deepEqual(autorizado, { codigo: 'SRV-1', estado: 'AUTORIZADO', numero: '0051-C01-30-26', emision: 1 });
  const primera = estado.emisiones[0];
  assert.equal(primera.archivo_nombre, '0051-C01-30-26 01 CLIENTE S.A. MARCA 600 g 0051-11-035.pdf');
  assert.equal(JSON.parse(primera.contenido).numero, '0051-C01-30-26');

  // El PDF sin firma, el de otra emisión o con una fecha futura no se aceptan.
  const sinFirma = Buffer.from(`%PDF-1.4\n<< /Keywords (${emision.marcaPdf(primera.contenido_huella)}) >>\n%%EOF`, 'latin1');
  await assert.rejects(emision.subirFirmado('SRV-1', sinFirma, {}, usuario), /no tiene firma digital/);
  await assert.rejects(emision.subirFirmado('SRV-1', firmado('b'.repeat(64)), {}, usuario), /no corresponde a la emisión autorizada/);
  await assert.rejects(emision.subirFirmado('SRV-1', firmado(primera.contenido_huella, '20991231'), {}, usuario), /posterior a hoy/);

  const emitido = await emision.subirFirmado('SRV-1', firmado(primera.contenido_huella), {}, usuario);
  assert.equal(emitido.estado, 'EMITIDO');
  assert.equal(emitido.fechaFirma, '2026-11-04');
  assert.equal(emitido.firmaDetectada, true);
  const archivado = path.join(carpeta, '2026', primera.archivo_nombre);
  assert.ok(fs.existsSync(archivado));
  assert.equal(estado.registro.estado, 'EMITIDO');
  // Se puede volver a abrir y se comprueba su huella.
  const pdf = await emision.abrirPdf('SRV-1', 1, usuario);
  assert.equal(pdf.nombre, primera.archivo_nombre);
  fs.appendFileSync(archivado, ' ');
  await assert.rejects(emision.abrirPdf('SRV-1', 1, usuario), /modificado fuera de DataMET\+/);
  fs.writeFileSync(archivado, firmado(primera.contenido_huella));

  // Reemisión: revisión con motivo, nueva autorización (02) y firma; la 01 queda reemplazada.
  await emision.abrirRevision('SRV-1', { motivo: 'Cambio de la razón social.' }, usuario);
  assert.equal(estado.registro.estado, 'BORRADOR');
  assert.equal(estado.registro.revision_motivo, 'Cambio de la razón social.');
  estado.registro.estado = 'APROBADO'; // revisado y aprobado de nuevo
  const segunda = await emision.autorizar('SRV-1', usuario);
  assert.equal(segunda.emision, 2);
  const contenido02 = JSON.parse(estado.emisiones[1].contenido);
  assert.equal(contenido02.emision, '02');
  assert.equal(contenido02.numero, '0051-C01-30-26');
  assert.equal(contenido02.reemplaza, 'Esta emisión 02 reemplaza a la emisión 01, firmada el 2026-11-04.');
  assert.deepEqual(contenido02.notas.revisiones.map(r => r.emision), ['01', '02']);
  assert.equal(estado.emisiones[1].motivo, 'Cambio de la razón social.');

  // Anular la autorización antes de firmar: vuelve a aprobado y se vuelve a
  // autorizar con el mismo número de emisión (la anulada no llegó al cliente).
  await emision.anularAutorizacion('SRV-1', { motivo: 'Faltaba la clase.' }, usuario);
  assert.equal(estado.emisiones[1].estado, 'ANULADO');
  assert.equal(estado.registro.estado, 'APROBADO');
  const tercera = await emision.autorizar('SRV-1', usuario);
  assert.equal(tercera.emision, 2);
  const huella03 = estado.emisiones[2].contenido_huella;
  await emision.subirFirmado('SRV-1', firmado(huella03, '20261105'), {}, usuario);
  assert.deepEqual(estado.emisiones.map(e => e.estado), ['REEMPLAZADO', 'ANULADO', 'EMITIDO']);
  assert.ok(fs.existsSync(path.join(carpeta, '2026', estado.emisiones[2].archivo_nombre)));
  assert.deepEqual(estado.historial.map(h => h.accion), [
    'AUTORIZACION', 'EMISION', 'REVISION', 'AUTORIZACION', 'ANULACION', 'AUTORIZACION', 'EMISION',
  ]);
});

test.after(() => fs.rmSync(carpeta, { recursive: true, force: true }));
