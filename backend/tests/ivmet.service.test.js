const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assembleClientSummaries,
  assembleEquipmentReview
} = require('../src/services/ivmet.service');

test('resume el alcance comercial de cada cliente sin mezclar licencias', () => {
  const result = assembleClientSummaries({
    customers: [{ id: 'c1', codigo: '0032' }, { id: 'c2', codigo: '9999' }],
    plants: [{ id: 'p1', cliente_id: 'c1', activo: true }],
    equipment: [
      { id: 'e1', cliente_id: 'c1', activo: true, estado_catalogo: 'READY' },
      { id: 'e2', cliente_id: 'c1', activo: true, estado_catalogo: 'REQUIRES_REVIEW' }
    ],
    profiles: [
      { id: 'u1', cliente_id: 'c1', activo: true },
      { id: 'u2', cliente_id: 'c2', activo: true }
    ],
    contracts: [{ id: 'co1', cliente_id: 'c1', estado: 'ACTIVE' }],
    subscriptions: [{ id: 's1', contrato_id: 'co1', plan_id: 'plan1', estado: 'ACTIVE' }],
    licenses: [
      { usuario_id: 'u1', suscripcion_id: 's1', estado: 'ACTIVE' },
      { usuario_id: 'u2', suscripcion_id: 's2', estado: 'ACTIVE' }
    ],
    plans: [{ id: 'plan1', nombre: 'Piloto', cuentas_incluidas: 5 }]
  });

  assert.equal(result[0].plants, 1);
  assert.equal(result[0].equipment, 2);
  assert.equal(result[0].equipmentReview, 1);
  assert.equal(result[0].activeLicenses, 1);
  assert.equal(result[0].subscription.plan.cuentas_incluidas, 5);
  assert.equal(result[1].activeLicenses, 1);
  assert.equal(result[1].contract, null);
});

test('anexa cliente, planta y rangos al listado de revisión', () => {
  const [result] = assembleEquipmentReview({
    equipment: [{ id: 'e1', cliente_id: 'c1', planta_id: 'p1', cod_metrica: '0032-11-024' }],
    plants: [{ id: 'p1', legacy_codigo_planta: '0032-11' }],
    customers: [{ id: 'c1', codigo: '0032' }],
    ranges: [
      { equipo_id: 'e1', numero_rango: 1 },
      { equipo_id: 'other', numero_rango: 1 }
    ]
  });

  assert.equal(result.customer.codigo, '0032');
  assert.equal(result.plant.legacy_codigo_planta, '0032-11');
  assert.deepEqual(result.ranges, [{ equipo_id: 'e1', numero_rango: 1 }]);
});
