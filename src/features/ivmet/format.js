export const today = () => new Date().toISOString().slice(0, 10);
export const dateText = (value) =>
  value
    ? new Intl.DateTimeFormat('es-BO', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(value))
    : '—';
export const money = (value, currency = 'BOB') =>
  `${currency} ${value ?? '0.00'}`;
export const versionOf = (row) => String(row?.row_version ?? '0');
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
