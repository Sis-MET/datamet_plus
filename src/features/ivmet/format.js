export const today = () => new Date().toISOString().slice(0, 10);
// El plan gratuito no vence: Supabase guarda su período hasta 'infinity'.
export const dateText = (value) => {
  if (!value) return '—';
  if (value === 'infinity') return 'Sin vencimiento';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
};
export const endless = (value) => value === 'infinity';
export const money = (value, currency = 'BOB') =>
  `${currency} ${value ?? '0.00'}`;
export const versionOf = (row) => String(row?.row_version ?? '0');
// Una balanza registrada por el cliente en IvMET no tiene código de Métrica.
export const equipmentLabel = (equipment = {}) =>
  equipment.cod_metrica ||
  (equipment.origen === 'CLIENTE'
    ? `Registrada por el cliente · ${equipment.cod_interno || 'sin código'}`
    : equipment.codigo);
export const effectiveState = (subscription) => {
  const now = new Date();
  if (
    subscription.estado === 'GRACE' &&
    (!subscription.gracia_hasta || new Date(subscription.gracia_hasta) <= now)
  )
    return 'EXPIRED';
  if (subscription.estado === 'ACTIVE') {
    if (new Date(subscription.fin_periodo) <= now) return 'EXPIRED';
    if (new Date(subscription.inicio_periodo) > now) return 'SCHEDULED';
  }
  return subscription.estado;
};

// Lo que cuenta un plan, en el orden en que se muestra.
export const planResources = [
  ['plants', 'Plantas', 'planta', 'plantas'],
  ['equipment', 'Balanzas', 'balanza', 'balanzas'],
  ['users', 'Usuarios', 'usuario', 'usuarios'],
  ['monthlyVerifications', 'Verificaciones del mes', 'verificación al mes', 'verificaciones al mes'],
  ['patterns', 'Pesas patrón', 'pesa patrón', 'pesas patrón'],
];
export const planFeatures = [
  ['fullReport', 'Informe completo'],
  ['customSchedules', 'Periodicidad a medida'],
];
// "1 planta · 5 balanzas · 20 verificaciones al mes", o "Sin límites".
export const planLimitsText = (terms = {}, seats) => {
  const limits = terms.limits || {};
  const parts = planResources
    .map(([key, , one, many]) => {
      const value = key === 'users' ? seats : limits[key];
      return value == null ? null : `${value} ${Number(value) === 1 ? one : many}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Sin límites';
};
export const upgradeReasons = {
  EQUIPMENT: 'Más balanzas',
  PLANTS: 'Más plantas',
  USERS: 'Más usuarios',
  VERIFICATIONS: 'Más verificaciones al mes',
  PATTERNS: 'Más pesas patrón',
  FULL_REPORT: 'Informe completo',
  CUSTOM_SCHEDULES: 'Periodicidad a medida',
  GENERAL: 'Otra necesidad',
};
// Lo que el cliente pidió: el plan y el motivo, en una línea.
export const requestSummary = (r) =>
  `${r.requestedPlan?.name ? `Plan ${r.requestedPlan.name}` : 'Asesoría'} · ${upgradeReasons[r.reason] || r.reason}`;
