import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { actionConfig, buildPayload } from './actions';
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
  // Otro plan al que cambiar: el actual no se ofrece.
  { id: id(12), activo: true, nombre: 'Profesional', cuentas_incluidas: 10, prices: [] },
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
    'subscription.change-plan',
    'upgrade.attend',
  ]) {
    it(`${action}: el formulario produce campos aceptados`, () => {
      const config = actionConfig(action, context);
      const payload = { ...config.values };
      for (const field of config.fields) {
        if (field.type === 'select' && !payload[field.name])
          payload[field.name] = field.options[0]?.value || '';
        else if (field.type === 'multi')
          payload[field.name] = field.options.slice(0, 1).map((o) => o.value);
        else if (field.type === 'integer') continue;
        else if (field.type === 'password')
          payload[field.name] = 'local-fixture-only-2026';
        else if (field.type === 'date') payload[field.name] = '2026-08-27';
        else if (field.decimal && !payload[field.name])
          payload[field.name] = '10.01';
        else if (!payload[field.name] && field.type !== 'checkbox')
          payload[field.name] = 'Prueba';
      }
      // Igual que el diálogo: enteros como números y la forma propia del formulario.
      const sent = buildPayload(config, payload);
      if (['area.save','pattern.save','certificate.create','certificate.annul'].includes(action)) {
        expect(() => validateAction(action, sent)).toThrow('configuración operativa');
      } else {
        expect(() => validateAction(action, sent)).not.toThrow();
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
  it('las condiciones del plan viajan como terms; vacío es sin límite', () => {
    const plan = actionConfig('plan.save', {
      record: {
        ...record,
        cuentas_incluidas: 2,
        terms: {
          limits: { plants: 1, equipment: 5, monthlyVerifications: null, patterns: null },
          features: { fullReport: false, customSchedules: true },
          catalog: { visible: true, order: 1, selfService: true, summary: 'Para empezar' },
        },
      },
    });
    expect(plan.values.limitPlants).toBe(1);
    expect(plan.values.limitVerifications).toBe('');
    const sent = buildPayload(plan, { ...plan.values, limitEquipment: '7' });
    expect(sent.terms).toEqual({
      limits: { plants: 1, equipment: 7, monthlyVerifications: null, patterns: null },
      features: { fullReport: false, customSchedules: true },
      catalog: { visible: true, selfService: true, order: 1, summary: 'Para empezar' },
    });
    expect(sent).not.toHaveProperty('limitPlants');
    expect(validateAction('plan.save', sent).terms.limits.equipment).toBe(7);
  });
  it('cambiar de plan desde el gratuito exige el fin del período', () => {
    const free = { ...record, fin_periodo: 'infinity' };
    const config = actionConfig('subscription.change-plan', { ...context, record: free });
    expect(config.fields.find((f) => f.name === 'endsOn').required).toBe(true);
    expect(
      config.fields.find((f) => f.name === 'planId').options.map((o) => o.value)
    ).toEqual([id(12)]);
    expect(dateText('infinity')).toBe('Sin vencimiento');
    expect(
      effectiveState({ estado: 'ACTIVE', inicio_periodo: '2026-01-01', fin_periodo: 'infinity' })
    ).toBe('ACTIVE');
  });
  it('atender una solicitud la marca contactada o la cierra con su resultado', () => {
    const request = {
      id: id(11),
      version: '2',
      reason: 'EQUIPMENT',
      client: { name: 'Acme' },
      requestedPlan: { name: 'Profesional' },
    };
    const config = actionConfig('upgrade.attend', { record: request });
    expect(config.description).toContain('Acme pidió el plan Profesional (Más balanzas)');
    expect(buildPayload(config, config.values)).toEqual({
      id: id(11),
      version: '2',
      note: '',
      state: 'CONTACTED',
      result: '',
    });
    expect(buildPayload(config, { ...config.values, outcome: 'DECLINED' })).toMatchObject({
      state: 'CLOSED',
      result: 'DECLINED',
    });
  });
});
