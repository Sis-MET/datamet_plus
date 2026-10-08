import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanUsage } from './PlanUsage';
import { planLimitsText, requestSummary } from '../format';

const request = {
  id: 'r1',
  version: '1',
  state: 'PENDING',
  reason: 'EQUIPMENT',
  message: 'Necesitamos 20 balanzas más',
  contactName: 'Ana Pérez',
  contactEmail: 'ana@acme.example',
  contactPhone: '+591 70000000',
  createdAt: '2026-10-08T12:00:00Z',
  requestedPlan: { id: 'p2', name: 'Profesional' },
};
const workspace = {
  client: { codigo: 'IV000001', nombre: 'Acme Alimentos' },
  plan: {
    name: 'Gratuito',
    subscriptionId: 's1',
    subscriptionStatus: 'ACTIVE',
    periodEndsAt: null,
    seatsAvailable: 2,
    catalog: { summary: 'Para empezar' },
    limits: { plants: 1, equipment: 5, monthlyVerifications: 20, patterns: null },
    features: { fullReport: false, customSchedules: false },
  },
  usage: { plants: 1, equipment: 5, users: 1, monthlyVerifications: 3, openDrafts: 1, patterns: 2 },
  subscriptions: [{ id: 's1', fin_periodo: 'infinity', row_version: '1' }],
  upgradeRequests: [request],
};

describe('plan y uso de una empresa autoregistrada', () => {
  it('muestra el uso contra cada límite, el gratuito sin vencimiento y la solicitud', () => {
    const html = renderToStaticMarkup(<PlanUsage workspace={workspace} open={() => {}} />);
    expect(html).toContain('Gratuito');
    expect(html).toContain('Sin vencimiento');
    expect(html).toMatch(/class="full"><span>Balanzas<\/span><strong>5<small> \/ 5<\/small>/);
    expect(html).toContain('4<small> / 20</small>');
    expect(html).toContain('2<small> · sin límite</small>');
    expect(html).toContain('Cambiar plan');
    expect(html).toContain('Plan Profesional · Más balanzas');
    expect(html).toContain('ana@acme.example');
    expect(html).toContain('Atender');
  });

  it('sin plan no muestra el panel', () => {
    expect(renderToStaticMarkup(<PlanUsage workspace={{ ...workspace, plan: null }} open={() => {}} />)).toBe('');
  });

  it('resume límites y solicitudes en una línea', () => {
    expect(planLimitsText(workspace.plan, 2)).toBe('1 planta · 5 balanzas · 2 usuarios · 20 verificaciones al mes');
    expect(planLimitsText({}, null)).toBe('Sin límites');
    expect(requestSummary({ reason: 'GENERAL' })).toBe('Asesoría · Otra necesidad');
  });
});
