import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { actionConfig } from './actions';
import { createRequestId } from './requestId';
import { dateText, effectiveState, money } from './format';

const require = createRequire(import.meta.url);
const {
  validateAction,
} = require('../../../backend/src/services/ivmet.validation.js');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clientId = id(1);
const record = {
  id: id(3),
  row_version: '2',
  config_version: '8',
  planta_id: id(2),
  plan_id: id(4),
  codigo: 'TEST',
  nombre: 'Prueba',
  activo: true,
  periodicidad: 'MONTHLY',
  precio_plan_id: id(5),
  saldo: '10000000000.01',
  habilitado: false,
  baseSeats: 5,
  assigned: 2,
};
const workspace = {
  plants: [
    {
      id: id(2),
      activo: true,
      legacy_codigo_planta: '0001-01',
      nombre: 'Planta',
    },
    { id: id(7), activo: false },
  ],
  areas: [
    { id: id(6), planta_id: id(2), activa: true, nombre: 'Calidad' },
    { id: id(8), planta_id: id(9), activa: true },
  ],
  metrologyPlans: [{ id: id(10), name: 'Procedimiento', version: 1 }],
  subscriptions: [
    {
      id: id(3),
      estado: 'ACTIVE',
      planName: 'Esencial',
      seats: 5,
      assigned: 2,
    },
  ],
};
const plans = [
  {
    id: id(4),
    activo: true,
    nombre: 'Esencial',
    prices: [
      {
        id: id(5),
        activo: true,
        periodicidad: 'MONTHLY',
        importe: '100.00',
        moneda: 'BOB',
        vigente_desde: '2026-01-01',
      },
    ],
  },
];
const context = { clientId, record, workspace, plans };

describe('formularios IvMET y contrato real del backend', () => {
  it('crear y editar un plan no pide ni envía códigos manuales', () => {
    for (const ctx of [{}, context]) {
      const config = actionConfig('plan.save', ctx);
      expect(config.fields.some((field) => field.name === 'code')).toBe(false);
      expect(config.values).not.toHaveProperty('code');
      expect(config.codeInfo).toBe(
        ctx.record ? 'TEST' : 'Se genera automáticamente al guardar'
      );
    }
  });
  it('UUID seguro en desarrollo por IP sin randomUUID', () => {
    expect(
      createRequestId({ getRandomValues: (bytes) => bytes.fill(1) })
    ).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
  for (const action of [
    'plan.save',
    'price.create',
    'contract.create',
    'subscription.renew',
    'seats.purchase',
    'payment.record',
    'invoice.void',
    'subscription.state',
    'contract.extend',
    'seat.revoke',
    'user.create',
    'user.update',
    'user.reset',
    'license.assign',
    'license.revoke',
    'area.save',
    'pattern.save',
    'certificate.create',
    'certificate.annul',
    'equipment.configure',
  ]) {
    it(`${action}: el formulario produce campos aceptados`, () => {
      const config = actionConfig(action, context);
      const payload = { ...config.values };
      for (const field of config.fields) {
        if (field.type === 'select' && !payload[field.name])
          payload[field.name] = field.options[0]?.value || '';
        else if (field.type === 'multi')
          payload[field.name] = field.options.slice(0, 1).map((o) => o.value);
        else if (field.type === 'integer')
          payload[field.name] = Number(payload[field.name]);
        else if (field.type === 'password')
          payload[field.name] = 'local-fixture-only-2026';
        else if (field.type === 'date') payload[field.name] = '2026-08-27';
        else if (field.decimal && !payload[field.name])
          payload[field.name] = '10.01';
        else if (!payload[field.name] && field.type !== 'checkbox')
          payload[field.name] = 'Prueba';
      }
      if (['area.save','pattern.save','certificate.create','certificate.annul'].includes(action)) {
        expect(() => validateAction(action, payload)).toThrow('configuración operativa');
      } else {
        expect(() => validateAction(action, payload)).not.toThrow();
      }
    });
  }
  it('no mezcla plantas ni áreas y usa versión de configuración', () => {
    const user = actionConfig('user.create', context);
    expect(
      user.fields.find((f) => f.name === 'plantIds').options.map((o) => o.value)
    ).toEqual([id(2)]);
    expect(
      user.fields.find((f) => f.name === 'role').options.map((o) => o.value)
    ).toEqual(['cliente_operador', 'cliente_jefe_calidad']);
    const equipment = actionConfig('equipment.configure', context);
    expect(equipment.values.version).toBe('8');
    expect(equipment.fields.some((f) => ['areaId','planVersionId'].includes(f.name))).toBe(false);
    expect(equipment.values).not.toHaveProperty('areaId');
    expect(equipment.values).not.toHaveProperty('planVersionId');
  });
  it('conserva importes exactos y distingue vigencia de asignación', () => {
    expect(actionConfig('payment.record', context).values.amount).toBe(
      '10000000000.01'
    );
    expect(money('10000000000.01')).toBe('BOB 10000000000.01');
    expect(
      effectiveState({ estado: 'ACTIVE', fin_periodo: '2020-01-01' })
    ).toBe('EXPIRED');
    expect(dateText(null)).toBe('—');
  });
});
