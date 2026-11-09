// La validación que muestra la pantalla (Certificados › Validación): todos los
// valores de los ejemplos publicados dentro de su criterio.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ejecutarValidacion } = require('../src/services/calibracion/validacion');

test('validación del motor: todos los casos dentro de su criterio', () => {
  const { casos, resumen } = ejecutarValidacion();
  for (const caso of casos) {
    for (const fila of caso.filas) assert.ok(fila.ok, `${caso.id} · ${fila.magnitud}: ${fila.motor} frente a ${fila.guia} (${fila.criterio})`);
  }
  assert.equal(resumen.ok, true);
  assert.ok(resumen.casos >= 8 && resumen.valores >= 180, JSON.stringify(resumen));
});
