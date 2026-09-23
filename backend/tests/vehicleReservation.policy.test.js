const test = require('node:test');
const assert = require('node:assert/strict');
const { canManageVehicleReservation } = require('../src/services/vehicleReservation.policy');

const admin = { usuario: 'jperez', acceso_cron: '2' };

test('el creador puede gestionar su reserva de vehículo', () => {
  assert.equal(canManageVehicleReservation({ actor: admin, creadoPor: 'JPerez ' }), true);
});

test('el creador también se reconoce por su nombre registrado', () => {
  assert.equal(canManageVehicleReservation({ actor: admin, creadoPor: 'Juán', actorAliases: ['Juan'] }), true);
});

test('otro administrador no puede tocar una reserva ajena', () => {
  assert.equal(canManageVehicleReservation({ actor: admin, creadoPor: 'mlopez' }), false);
});

test('un desarrollador puede intervenir cualquier reserva', () => {
  assert.equal(canManageVehicleReservation({ actor: { usuario: 'dev', acceso_cron: '3' }, creadoPor: 'mlopez' }), true);
});

test('las reservas sin creador real quedan libres', () => {
  assert.equal(canManageVehicleReservation({ actor: admin, creadoPor: 'Sistema' }), true);
  assert.equal(canManageVehicleReservation({ actor: admin, creadoPor: null }), true);
});

test('con id_creador manda el id, no el nombre', () => {
  const owner = { id: 7, usuario: 'jperez', acceso_cron: '2' };
  const namesake = { id: 9, usuario: 'jperez', acceso_cron: '2' };
  assert.equal(canManageVehicleReservation({ actor: owner, creadoPor: 'otro', creadorId: 7 }), true);
  assert.equal(canManageVehicleReservation({ actor: namesake, creadoPor: 'jperez', creadorId: 7 }), false);
});
