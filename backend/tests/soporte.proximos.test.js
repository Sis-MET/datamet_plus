const test = require('node:test');
const assert = require('node:assert/strict');
const {
  alertasActivas,
  armarResumenes,
  claveSugerido,
  construirEquipos,
  eventosDelAnio,
  renderizarCorreo,
  resumen,
  validarGestion,
} = require('../src/services/soporte.proximos.reglas');
const { mapServicio } = require('../src/services/soporte.proximos');

const AJUSTES = { alertaDias: 30, alertaFrecuencia: 'SEMANAL', alertaCorreo: true };
const HOY = '2026-10-22';

let secuencia = 0;
const servicio = (overrides = {}) => {
  secuencia += 1;
  return {
    tipo: 'MPR',
    codigo: `REG-${secuencia}`,
    otst: '26-0058-11-S01',
    numero: null,
    estadoInforme: 'PENDIENTE',
    fecha: '2026-04-22',
    fechaProx: '2026-10-22',
    recomendacion: 'Mnt Preventivo Regular',
    tecnico: 'Tec. Juan Perez',
    codMetrica: '0058-11-001',
    cliente: 'LAS LOMAS',
    planta: 'LAS LOMAS - LA PAZ',
    ciudad: 'La Paz',
    tipoEquipo: 'Balanza',
    marca: 'Mettler',
    modelo: 'ICS',
    serie: '12454696',
    ...overrides,
  };
};

const gestion = (id, origen, accion, extra = {}) => ({
  id,
  codMetrica: '0058-11-001',
  origenTipo: origen.tipo,
  origenCodigo: origen.codigo,
  accion,
  fechaNueva: null,
  nota: 'Nota de seguimiento',
  usuario: 'jperez',
  ...extra,
});

const unEquipo = (servicios, seguimiento = [], hoy = HOY, ajustes = AJUSTES) => {
  const equipos = construirEquipos({ servicios, seguimiento, hoy, ajustes });
  assert.equal(equipos.length, 1);
  return equipos[0];
};

test('el último mantenimiento define el próximo servicio', () => {
  // Caso real del equipo 0058-11-001 de Las Lomas.
  const equipo = unEquipo([
    servicio({ tipo: 'MPA', fecha: '2026-04-22', fechaProx: '2026-10-23', recomendacion: 'Mnt Preventivo Avanzado' }),
    servicio({ tipo: 'MCR', fecha: '2026-05-26', fechaProx: '2026-11-26', recomendacion: 'Mnt Preventivo Avanzado' }),
    servicio({ tipo: 'MPA', fecha: '2026-06-19', fechaProx: '2026-09-19', recomendacion: 'Diagnostico' }),
  ]);
  assert.equal(equipo.proximo.fecha, '2026-09-19');
  assert.equal(equipo.proximo.origen.tipo, 'MPA');
  assert.equal(equipo.proximo.tipoSugerido, 'DIG');
  assert.equal(equipo.proximo.situacion, 'VENCIDO');
  assert.equal(equipo.proximo.diasRestantes, -33);
  assert.deepEqual(equipo.servicios.map(s => s.sugerencia), ['ATENDIDA', 'ATENDIDA', 'VIGENTE']);
  assert.equal(equipo.servicios[0].atendidaPor.tipo, 'MCR');
});

test('el diagnóstico y el relevamiento no cambian la fecha', () => {
  const equipo = unEquipo([
    servicio({ tipo: 'MPR', fecha: '2026-04-17', fechaProx: '2027-04-17' }),
    servicio({ tipo: 'DIG', fecha: '2026-06-01', fechaProx: null, recomendacion: null }),
    servicio({ tipo: 'RVD', fecha: '2026-07-01', fechaProx: null, recomendacion: 'Mnt Correctivo' }),
  ]);
  assert.equal(equipo.proximo.fecha, '2027-04-17');
  assert.equal(equipo.proximo.origen.tipo, 'MPR');
  assert.equal(equipo.proximo.situacion, 'PROGRAMADO');
  // Los datos del equipo salen del último servicio, aunque no mande.
  assert.equal(equipo.ultimoServicio.tipo, 'RVD');
});

test('un mantenimiento posterior sin fecha deja al equipo sin próximo servicio', () => {
  const equipo = unEquipo([
    servicio({ tipo: 'MPR', fecha: '2026-01-10', fechaProx: '2026-07-10' }),
    servicio({ tipo: 'MCR', fecha: '2026-05-02', fechaProx: null }),
  ]);
  assert.equal(equipo.proximo, null);
  assert.equal(equipo.origen.tipo, 'MCR');
});

test('una fecha sugerida que no es posterior al servicio no cuenta', () => {
  const equipo = unEquipo([servicio({ fecha: '2026-08-13', fechaProx: '2026-08-13' })]);
  assert.equal(equipo.proximo, null);
});

test('en el mismo día manda la sugerencia más cercana', () => {
  const equipo = unEquipo([
    servicio({ tipo: 'MPR', fecha: '2026-04-16', fechaProx: '2027-04-16' }),
    servicio({ tipo: 'MCR', fecha: '2026-04-16', fechaProx: '2026-10-16' }),
  ]);
  assert.equal(equipo.proximo.fecha, '2026-10-16');
  assert.deepEqual(equipo.servicios.map(s => s.sugerencia), ['REEMPLAZADA', 'VIGENTE']);
});

test('sin mantenimientos, manda el último servicio (relevamiento) aunque no tenga fecha', () => {
  const equipo = unEquipo([servicio({ tipo: 'RVD', fechaProx: null, recomendacion: 'Ajustes Metrológicos' })]);
  assert.equal(equipo.origen.tipo, 'RVD');
  assert.equal(equipo.proximo, null);
});

test('agrupa los equipos por Código Métrica sin importar espacios ni mayúsculas', () => {
  const equipos = construirEquipos({
    servicios: [
      servicio({ codMetrica: ' 0071-11-a12 ', fecha: '2026-01-01', fechaProx: '2026-07-01' }),
      servicio({ codMetrica: '0071-11-A12', fecha: '2026-03-01', fechaProx: '2026-09-01' }),
      servicio({ codMetrica: null }),
    ],
    seguimiento: [],
    hoy: HOY,
    ajustes: AJUSTES,
  });
  assert.equal(equipos.length, 1);
  assert.equal(equipos[0].id, '0071-11-A12');
  assert.equal(equipos[0].servicios.length, 2);
});

test('situaciones: en aviso dentro de la anticipación, programado más allá', () => {
  assert.equal(unEquipo([servicio({ fechaProx: '2026-11-21' })]).proximo.situacion, 'PROXIMO');
  assert.equal(unEquipo([servicio({ fechaProx: '2026-11-22' })]).proximo.situacion, 'PROGRAMADO');
  const sinAvisos = { ...AJUSTES, alertaFrecuencia: 'NINGUNA' };
  assert.equal(unEquipo([servicio({ fechaProx: '2026-10-30' })], [], HOY, sinAvisos).proximo.situacion, 'PROGRAMADO');
});

test('el seguimiento coordina, reprograma, descarta y reactiva', () => {
  const origen = servicio({ fechaProx: '2026-11-01' });
  const coordinado = unEquipo([origen], [gestion(1, origen, 'COORDINACION', { fechaNueva: '2026-11-05' })]);
  assert.equal(coordinado.proximo.fecha, '2026-11-05');
  assert.equal(coordinado.proximo.fechaSugerida, '2026-11-01');
  assert.equal(coordinado.proximo.situacion, 'COORDINADO');
  assert.equal(coordinado.proximo.ultimoContacto.accion, 'COORDINACION');
  assert.equal(coordinado.ultimoSeguimientoId, 1);

  const reprogramado = unEquipo([origen], [
    gestion(1, origen, 'COORDINACION', { fechaNueva: '2026-11-05' }),
    gestion(2, origen, 'REPROGRAMACION', { fechaNueva: '2027-01-15' }),
  ]);
  assert.equal(reprogramado.proximo.fecha, '2027-01-15');
  assert.equal(reprogramado.proximo.reprogramada, true);
  assert.equal(reprogramado.proximo.situacion, 'PROGRAMADO');

  const descartado = unEquipo([origen], [gestion(1, origen, 'DESCARTE')]);
  assert.equal(descartado.proximo.situacion, 'DESCARTADO');
  assert.deepEqual(alertasActivas([descartado]), []);

  const reactivado = unEquipo([origen], [gestion(1, origen, 'DESCARTE'), gestion(2, origen, 'REACTIVACION')]);
  assert.equal(reactivado.proximo.situacion, 'PROXIMO');
});

test('el seguimiento de una sugerencia anterior no afecta a la nueva', () => {
  const anterior = servicio({ fecha: '2026-01-10', fechaProx: '2026-07-10' });
  const nuevo = servicio({ fecha: '2026-07-12', fechaProx: '2027-01-12' });
  const equipo = unEquipo([anterior, nuevo], [gestion(1, anterior, 'DESCARTE')]);
  assert.equal(equipo.proximo.situacion, 'PROGRAMADO');
  assert.equal(equipo.ultimoSeguimientoId, null);
});

test('una visita coordinada que ya pasó sin servicio queda vencida', () => {
  const origen = servicio({ fechaProx: '2026-10-01' });
  const equipo = unEquipo([origen], [gestion(1, origen, 'COORDINACION', { fechaNueva: '2026-10-10' })]);
  assert.equal(equipo.proximo.situacion, 'VENCIDO');
});

test('requieren atención: vencidos primero, luego por fecha; los coordinados solo dentro del aviso', () => {
  const equipos = construirEquipos({
    servicios: [
      servicio({ codMetrica: 'A-1', fechaProx: '2026-11-10' }),
      servicio({ codMetrica: 'A-2', fechaProx: '2026-10-01' }),
      servicio({ codMetrica: 'A-3', fechaProx: '2027-03-01' }),
      servicio({ codMetrica: 'A-4', codigo: 'COORD', fechaProx: '2026-12-30' }),
    ],
    seguimiento: [{
      id: 1, codMetrica: 'A-4', origenTipo: 'MPR', origenCodigo: 'COORD', accion: 'COORDINACION', fechaNueva: '2027-02-01', nota: 'Acordado con el cliente', usuario: 'x',
    }],
    hoy: HOY,
    ajustes: AJUSTES,
  });
  assert.deepEqual(alertasActivas(equipos).map(alerta => alerta.codMetrica), ['A-2', 'A-1']);
  assert.deepEqual(resumen(equipos, alertasActivas(equipos)), {
    equipos: 4, conFecha: 4, sinFecha: 0, vencidos: 1, proximos: 1, coordinados: 1, programados: 1, descartados: 0, atencion: 2,
  });
});

test('la línea de tiempo del año trae los servicios realizados y el próximo servicio', () => {
  const equipo = unEquipo([
    servicio({ tipo: 'MPR', fecha: '2025-11-18', fechaProx: '2026-05-18' }),
    servicio({ tipo: 'MCR', fecha: '2026-05-20', fechaProx: '2027-05-20' }),
  ]);
  const eventos2026 = eventosDelAnio([equipo], 2026);
  assert.deepEqual(eventos2026.map(evento => [evento.clase, evento.fecha, evento.situacion]), [
    ['SERVICIO', '2026-05-20', 'REALIZADO'],
  ]);
  const eventos2027 = eventosDelAnio([equipo], 2027);
  assert.deepEqual(eventos2027.map(evento => [evento.clase, evento.fecha, evento.tipo, evento.tipoSugerido]), [
    ['PROXIMO', '2027-05-20', 'MCR', 'MPR'],
  ]);
  assert.equal(eventos2027[0].equipoId, equipo.id);
  assert.equal(eventos2027[0].alerta, undefined);
});

test('normaliza el tipo de servicio sugerido', () => {
  assert.equal(claveSugerido('Mnt Preventivo Regular'), 'MPR');
  assert.equal(claveSugerido('mnt preventivo avanzado'), 'MPA');
  assert.equal(claveSugerido('Diagnostico'), 'DIG');
  assert.equal(claveSugerido('Diagnóstico.'), 'DIG');
  assert.equal(claveSugerido('Ajustes Metrológicos'), 'AJM');
  assert.equal(claveSugerido('Sin recomendación'), null);
  assert.equal(claveSugerido(''), null);
  assert.equal(claveSugerido('Superficie de pesaje no adecuada.'), 'OTRO');
});

test('valida las gestiones contra el estado del próximo servicio', () => {
  const origen = { fecha: '2026-04-22' };
  const vigente = { fecha: '2026-10-22', descartada: false };
  assert.equal(validarGestion({ accion: 'CONTACTO' }, { estado: vigente, origen, hoy: HOY }), null);
  assert.equal(validarGestion({ accion: 'DESCARTE' }, { estado: vigente, origen, hoy: HOY }), null);
  assert.match(validarGestion({ accion: 'REACTIVACION' }, { estado: vigente, origen, hoy: HOY }), /no está descartado/);
  assert.match(validarGestion({ accion: 'COORDINACION', fecha: '2026-10-21' }, { estado: vigente, origen, hoy: HOY }), /pasado/);
  assert.equal(validarGestion({ accion: 'COORDINACION', fecha: HOY }, { estado: vigente, origen, hoy: HOY }), null);
  assert.match(validarGestion({ accion: 'REPROGRAMACION', fecha: '2026-10-22' }, { estado: vigente, origen, hoy: HOY }), /igual/);
  assert.match(validarGestion({ accion: 'REPROGRAMACION', fecha: '2026-04-01' }, { estado: vigente, origen, hoy: HOY }), /posterior/);
  assert.match(validarGestion({ accion: 'REPROGRAMACION' }, { estado: vigente, origen, hoy: HOY }), /fecha/);

  const descartada = { ...vigente, descartada: true };
  assert.equal(validarGestion({ accion: 'REACTIVACION' }, { estado: descartada, origen, hoy: HOY }), null);
  assert.match(validarGestion({ accion: 'CONTACTO' }, { estado: descartada, origen, hoy: HOY }), /reactívelo/);

  // Sin fecha: se puede programar una, pero no contactar ni descartar.
  const sinFecha = { fecha: null, descartada: false };
  assert.equal(validarGestion({ accion: 'REPROGRAMACION', fecha: '2027-01-10' }, { estado: sinFecha, origen, hoy: HOY }), null);
  assert.match(validarGestion({ accion: 'CONTACTO' }, { estado: sinFecha, origen, hoy: HOY }), /prográmela/);
  assert.match(validarGestion({ accion: 'DESCARTE' }, { estado: sinFecha, origen, hoy: HOY }), /prográmela/);
});

test('los correos llegan a todos los destinatarios activos y respetan la frecuencia', () => {
  const equipos = construirEquipos({
    servicios: [
      servicio({ codMetrica: 'A-1', codigo: 'R1', cliente: 'VENADO', fechaProx: '2026-11-10' }),
      servicio({ codMetrica: 'A-2', codigo: 'R2', cliente: 'LAS LOMAS', fechaProx: '2026-10-01' }),
    ],
    seguimiento: [],
    hoy: HOY,
    ajustes: AJUSTES,
  });
  const alertas = alertasActivas(equipos);
  const contactos = [
    { id: 1, nombre: 'Ana', email: 'Ana@metrica.com.bo', activo: true },
    { id: 2, nombre: 'Luis', email: 'luis@metrica.com.bo', activo: false },
  ];
  const historial = [{ origenTipo: 'MPR', origenCodigo: 'R1', fechaAviso: '2026-11-10', email: 'ana@metrica.com.bo', motivo: 'PREVIO', fechaLocal: '2026-10-20' }];
  const resumenes = armarResumenes({ alertas, contactos, historial, hoy: HOY });
  assert.equal(resumenes.length, 1);
  assert.equal(resumenes[0].email, 'ana@metrica.com.bo');
  // El previo de A-1 ya salió hace 2 días (semanal): solo va el vencido.
  assert.deepEqual(resumenes[0].items.map(item => [item.proximo.codMetrica, item.motivo]), [['A-2', 'VENCIDO']]);

  // Reprogramado a otra fecha, el aviso empieza de nuevo.
  const reprogramado = alertas.map(alerta => (alerta.codMetrica === 'A-1' ? { ...alerta, fecha: '2026-11-12', diasRestantes: 21 } : alerta));
  const otraVez = armarResumenes({ alertas: reprogramado, contactos, historial, hoy: HOY });
  assert.deepEqual(otraVez[0].items.map(item => item.proximo.codMetrica), ['A-2', 'A-1']);
});

test('el correo agrupa por cliente y no inyecta HTML', () => {
  const [equipo] = construirEquipos({
    servicios: [servicio({ cliente: 'ACME <script>', fechaProx: '2026-10-01' })],
    seguimiento: [],
    hoy: HOY,
    ajustes: AJUSTES,
  });
  const correo = renderizarCorreo({
    nombre: 'Ana',
    items: [{ proximo: equipo.proximo, motivo: 'VENCIDO' }],
    appUrl: 'https://datamet.local',
  });
  assert.equal(correo.subject, 'Próximos servicios: 1 vencido');
  assert.match(correo.html, /ACME &lt;script&gt;/);
  assert.doesNotMatch(correo.html, /<script>/);
  assert.match(correo.text, /Vencido hace 21 días/);
  assert.match(correo.text, /Preventivo regular/);
});

test('el correo junta los equipos de cada cliente; la OTST anterior es solo referencia', () => {
  const equipos = construirEquipos({
    servicios: [
      servicio({ codMetrica: '0087-11-020', codigo: 'C1', cliente: 'COFAR', otst: '25-0087-11-S01', fecha: '2025-11-18', fechaProx: '2026-05-18' }),
      servicio({ codMetrica: '0087-11-011', codigo: 'C3', cliente: 'COFAR', otst: '25-0087-11-S07', fecha: '2025-12-01', fechaProx: '2026-06-01' }),
      servicio({ codMetrica: '0071-11-012', codigo: 'V1', cliente: 'VENADO', otst: '26-0071-11-S02', fecha: '2026-04-16', fechaProx: '2026-05-20' }),
      servicio({ codMetrica: '0087-11-033', codigo: 'C2', cliente: 'COFAR', otst: '25-0087-11-S01', fecha: '2025-11-18', fechaProx: '2026-05-18' }),
    ],
    seguimiento: [],
    hoy: HOY,
    ajustes: AJUSTES,
  });
  const items = alertasActivas(equipos).map(proximo => ({ proximo, motivo: 'VENCIDO' }));
  const correo = renderizarCorreo({ nombre: 'Ana', items, appUrl: null });
  assert.equal(correo.subject, 'Próximos servicios: 4 vencidos');
  const lineas = correo.text.split('\n');
  // Un solo bloque por cliente, en el orden de su equipo más urgente.
  assert.deepEqual(lineas.filter(linea => /^[A-Z]/.test(linea) && linea.includes('equipo')), ['COFAR (3 equipos)', 'VENADO (1 equipo)']);
  assert.match(correo.text, /- 0087-11-011 · Balanza · Mettler \(Preventivo regular, Servicio anterior: OTST 25-0087-11-S07\) — Vencido hace 143 días \(1 de junio de 2026\)/);
  assert.match(correo.html, /COFAR · 3 equipos/);
  assert.match(correo.html, /Servicio anterior: OTST 25-0087-11-S01/);
});

test('las correcciones del informe reemplazan los datos de ServiceMET', () => {
  const row = {
    tipo: 'MPR',
    campo_rec: 'recomendacion',
    codigo_registro: 'X1',
    otst: '26-0058-11-S01',
    cod_metrica: '0058-11-001',
    fecha_servicio: new Date('2026-04-22T00:00:00Z'),
    fecha_prox_servicio: new Date('2026-10-22T00:00:00Z'),
    recomendacion: 'Mnt Preventivo Regular',
    cliente: 'LAS LOMAZ',
    estado_informe: 'BORRADOR',
    datos: JSON.stringify({ fecha_prox_servicio: '2026-12-01', recomendacion: 'Mnt Correctivo', cliente: 'LAS LOMAS' }),
  };
  const mapped = mapServicio(row);
  assert.equal(mapped.fecha, '2026-04-22');
  assert.equal(mapped.fechaProx, '2026-12-01');
  assert.equal(mapped.recomendacion, 'Mnt Correctivo');
  assert.equal(mapped.cliente, 'LAS LOMAS');
  assert.equal(mapped.numero, '26-0058-11-S01-001');

  // Una corrección que borra la fecha la deja vacía.
  const borrada = mapServicio({ ...row, datos: JSON.stringify({ fecha_prox_servicio: null }) });
  assert.equal(borrada.fechaProx, null);
});
