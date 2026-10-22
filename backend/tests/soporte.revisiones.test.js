const test = require('node:test');
const assert = require('node:assert/strict');
const {
  copiaFotos,
  diferenciasDatos,
  exigirEditable,
  hayCambios,
  mismasFotos,
  planFotos,
  revisionDeCambio,
} = require('../src/services/soporte.revisiones');
const { leerRevision } = require('../src/services/soporte.validation');

test('un informe emitido no se edita: primero se abre una revisión', () => {
  assert.doesNotThrow(() => exigirEditable(null));
  assert.doesNotThrow(() => exigirEditable({ estado: 'BORRADOR' }));
  assert.doesNotThrow(() => exigirEditable({ estado: 'EN_REVISION' }));
  assert.throws(() => exigirEditable({ estado: 'EMITIDO' }), error => error.statusCode === 409 && /abra una revisión/.test(error.message));
});

test('los cambios con la revisión abierta pertenecen a la revisión siguiente', () => {
  assert.equal(revisionDeCambio(null), 0);
  assert.equal(revisionDeCambio({ estado: 'BORRADOR', revision: 0 }), 0);
  assert.equal(revisionDeCambio({ estado: 'EN_REVISION', revision: 0 }), 1);
  assert.equal(revisionDeCambio({ estado: 'EN_REVISION', revision: 2 }), 3);
});

test('diferencias entre correcciones con el valor efectivo', () => {
  const fuente = { cliente: 'LAS LOMAZ', ubicacion: 'Depósito', marca: 'OHAUS' };
  assert.deepEqual(diferenciasDatos({
    desde: { cliente: 'LAS LOMAS' },
    hasta: { cliente: 'LAS LOMAS', ubicacion: 'Laboratorio', marca: 'OHAUS' },
    fuente,
  }), [{ campo: 'ubicacion', antes: 'Depósito', despues: 'Laboratorio' }]);
  // Quitar una corrección vuelve al original del servicio.
  assert.deepEqual(diferenciasDatos({ desde: { cliente: 'LAS LOMAS' }, hasta: {}, fuente }), [
    { campo: 'cliente', antes: 'LAS LOMAS', despues: 'LAS LOMAZ' },
  ]);
});

test('hay cambios si cambian las correcciones, las fotos o el servicio', () => {
  const vigente = { fuente: { a: 1 }, datos: { b: 'x' }, fotos: [{ id: 1, orden: 1, descripcion: 'Placa' }] };
  assert.equal(hayCambios({ vigente, actual: structuredClone(vigente) }), false);
  assert.equal(hayCambios({ vigente, actual: { ...vigente, datos: { b: 'y' } } }), true);
  assert.equal(hayCambios({ vigente, actual: { ...vigente, fotos: [{ id: 1, orden: 1, descripcion: 'Placa nueva' }] } }), true);
  assert.equal(hayCambios({ vigente, actual: { ...vigente, fuente: { a: 2 } } }), true);
  // Renumerar sin cambiar el orden no es un cambio.
  assert.equal(mismasFotos(
    [{ id: 1, orden: 1 }, { id: 2, orden: 2 }],
    [{ id: 1, orden: 4 }, { id: 2, orden: 9 }],
  ), true);
  assert.deepEqual(copiaFotos([{ id: 2, orden: 1, extra: 'x' }, { id: 1, orden: 1 }]), [
    { id: 1, orden: 1, descripcion: null }, { id: 2, orden: 1, descripcion: null },
  ]);
});

test('cancelar una revisión repone, quita y ajusta las fotos como en la vigente', () => {
  const copia = [
    { id: 1, orden: 1, descripcion: 'Placa' },
    { id: 2, orden: 2, descripcion: 'Plataforma' },
    { id: 3, orden: 3, descripcion: 'Indicador' },
  ];
  const todas = [
    { id: 1, orden: 1, descripcion: 'Placa', quitada_en: null },
    { id: 2, orden: 3, descripcion: 'Plataforma limpia', quitada_en: null },
    { id: 3, orden: 2, descripcion: 'Indicador', quitada_en: new Date() },
    { id: 4, orden: 4, descripcion: 'Agregada en la revisión', quitada_en: null },
    { id: 5, orden: 5, descripcion: 'Quitada antes', quitada_en: new Date() },
  ];
  assert.deepEqual(planFotos({ copia, todas }), {
    reponer: [{ id: 3, orden: 3, descripcion: 'Indicador' }],
    quitar: [4],
    ajustar: [{ id: 2, orden: 2, descripcion: 'Plataforma' }],
  });
});

test('número de revisión en la URL', () => {
  assert.equal(leerRevision('0'), 0);
  assert.equal(leerRevision('3'), 3);
  assert.throws(() => leerRevision('-1'), /inválida/);
  assert.throws(() => leerRevision('abc'), /inválida/);
});
