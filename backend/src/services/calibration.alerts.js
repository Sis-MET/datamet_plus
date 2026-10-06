/**
 * Política de alertas del cronograma de calibración. Funciones puras: deciden
 * a quién y cuándo avisar, y arman el correo resumen de cada destinatario.
 */
const { diffDays } = require('./calibration.schedule');

const INTERVALO_DIAS = { DIARIA: 1, SEMANAL: 7 };

const TIPO_LABEL = {
  CALIBRACION: 'Calibración',
  VERIFICACION: 'Verificación interna',
  ACTIVIDAD: 'Actividad',
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/**
 * Motivo del aviso que corresponde hoy para una fecha del plan, o null.
 *
 * - PREVIO: dentro de la ventana de alerta; se repite según la frecuencia
 *   (única vez, semanal o diaria) contando desde el último aviso previo.
 * - HOY: el mismo día de la fecha, siempre que haya alertas activas.
 * - VENCIDO: pasada la fecha sin realizarse; se repite con la misma
 *   frecuencia (una sola vez si la frecuencia es única).
 *
 * Nunca se envía más de un aviso por fecha y destinatario en el mismo día.
 * @param {object} occurrence Fecha del plan (buildOccurrences).
 * @param {Array}  history    Avisos enviados a este destinatario para esta fecha: { motivo, fechaLocal }.
 * @param {string} hoy
 */
const decideAlert = (occurrence, history, hoy) => {
  const { alerta, situacion, diasRestantes } = occurrence;
  if (!alerta?.correo || alerta.frecuencia === 'NINGUNA' || occurrence.proyectado) return null;
  if (history.some(entry => entry.fechaLocal === hoy)) return null;

  let motivo = null;
  if (situacion === 'VENCIDO') motivo = 'VENCIDO';
  else if (situacion === 'PROXIMO' && diasRestantes === 0) motivo = 'HOY';
  else if (situacion === 'PROXIMO') motivo = 'PREVIO';
  if (!motivo) return null;
  if (motivo === 'HOY') return motivo;

  const previous = history
    .filter(entry => entry.motivo === motivo)
    .map(entry => entry.fechaLocal)
    .sort();
  const last = previous[previous.length - 1];
  if (!last) return motivo;
  if (alerta.frecuencia === 'UNICA') return null;
  return diffDays(hoy, last) >= INTERVALO_DIAS[alerta.frecuencia] ? motivo : null;
};

/** Correos que reciben el aviso: el responsable registrado y quienes reciben todas. */
const recipientsFor = (occurrence, contactos) => {
  const activos = contactos.filter(contacto => contacto.activo && normalizeEmail(contacto.email));
  const selected = activos.filter(contacto => (
    contacto.recibeTodas
    || (occurrence.responsableId != null && contacto.usuarioId === occurrence.responsableId)
  ));
  const byEmail = new Map();
  for (const contacto of selected) byEmail.set(normalizeEmail(contacto.email), contacto);
  return [...byEmail.values()];
};

/**
 * Agrupa los avisos de hoy por destinatario.
 * @returns {Array<{ contacto, email, items: Array<{ occurrence, motivo }> }>}
 */
const buildDigests = ({ alerts, contactos, history, hoy }) => {
  const historyByKey = new Map();
  for (const entry of history) {
    const key = `${entry.serie}|${entry.fechaProgramada}|${normalizeEmail(entry.email)}`;
    if (!historyByKey.has(key)) historyByKey.set(key, []);
    historyByKey.get(key).push(entry);
  }

  const digests = new Map();
  for (const occurrence of alerts) {
    for (const contacto of recipientsFor(occurrence, contactos)) {
      const email = normalizeEmail(contacto.email);
      const key = `${occurrence.serie}|${occurrence.fechaProgramada}|${email}`;
      const motivo = decideAlert(occurrence, historyByKey.get(key) || [], hoy);
      if (!motivo) continue;
      if (!digests.has(email)) digests.set(email, { contacto, email, items: [] });
      digests.get(email).items.push({ occurrence, motivo });
    }
  }

  const order = { VENCIDO: 0, HOY: 1, PREVIO: 2 };
  return [...digests.values()].map(digest => ({
    ...digest,
    items: digest.items.sort((a, b) => (
      order[a.motivo] - order[b.motivo] || a.occurrence.fechaPlan.localeCompare(b.occurrence.fechaPlan)
    )),
  }));
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

const itemTitle = (occurrence) => (occurrence.tipo === 'ACTIVIDAD'
  ? occurrence.titulo
  : [occurrence.codigo, occurrence.instrumento].filter(Boolean).join(' · '));

const whenLabel = ({ occurrence, motivo }) => {
  const dias = occurrence.diasRestantes;
  if (motivo === 'HOY') return 'Es hoy';
  if (motivo === 'VENCIDO') {
    const atraso = Math.abs(dias);
    const sufijo = atraso === 1 ? 'día' : 'días';
    return occurrence.tipo === 'CALIBRACION'
      ? `Vencida hace ${atraso} ${sufijo}`
      : `Atrasada ${atraso} ${sufijo}`;
  }
  return dias === 1 ? 'Mañana' : `En ${dias} días`;
};

/** Correo resumen para un destinatario. */
const renderDigestEmail = ({ nombre, items, appUrl }) => {
  const vencidos = items.filter(item => item.motivo === 'VENCIDO').length;
  const proximos = items.length - vencidos;
  const partes = [];
  if (vencidos) partes.push(`${vencidos} ${vencidos === 1 ? 'vencida' : 'vencidas'}`);
  if (proximos) partes.push(`${proximos} ${proximos === 1 ? 'próxima' : 'próximas'}`);
  const subject = `Calibración: ${partes.join(' y ')}`;

  const rows = items.map((item) => {
    const { occurrence } = item;
    const urgent = item.motivo !== 'PREVIO';
    const extra = [
      occurrence.planta,
      occurrence.responsableNombre ? `Responsable: ${occurrence.responsableNombre}` : null,
    ].filter(Boolean).join(' · ');
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e4e4de;vertical-align:top;">
          <div style="font-size:12px;color:#5c5c56;">${escapeHtml(TIPO_LABEL[occurrence.tipo])}</div>
          <div style="font-size:15px;font-weight:600;color:#181816;margin-top:2px;">${escapeHtml(itemTitle(occurrence))}</div>
          ${extra ? `<div style="font-size:12px;color:#5c5c56;margin-top:2px;">${escapeHtml(extra)}</div>` : ''}
        </td>
        <td style="padding:12px 0 12px 16px;border-bottom:1px solid #e4e4de;vertical-align:top;text-align:right;white-space:nowrap;">
          <div style="font-size:13px;font-weight:600;color:${urgent ? '#be1e1e' : '#b45309'};">${escapeHtml(whenLabel(item))}</div>
          <div style="font-size:12px;color:#5c5c56;margin-top:2px;">${escapeHtml(formatDate(occurrence.fechaPlan))}</div>
        </td>
      </tr>`;
  }).join('');

  const link = appUrl
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#f9e300;color:#161614;font-weight:600;text-decoration:none;padding:10px 16px;border-radius:10px;">Abrir el cronograma</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#f6f6f3;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4de;border-radius:16px;">
        <tr><td style="height:6px;background:#f9e300;border-radius:16px 16px 0 0;"></td></tr>
        <tr><td style="padding:24px 24px 8px;">
          <h1 style="margin:0;font-size:20px;line-height:1.3;color:#181816;">Hola${nombre ? ` ${escapeHtml(nombre)}` : ''}, tienes ${escapeHtml(partes.join(' y '))} en el cronograma de calibración</h1>
        </td></tr>
        <tr><td style="padding:8px 24px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          ${link}
          <p style="margin:24px 0 0;font-size:12px;color:#707069;">Recibes este aviso según la configuración de alertas del módulo Calibración de DataMET+.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Cronograma de calibración: ${partes.join(' y ')}`,
    '',
    ...items.map(item => `- ${TIPO_LABEL[item.occurrence.tipo]}: ${itemTitle(item.occurrence)} — ${whenLabel(item)} (${formatDate(item.occurrence.fechaPlan)})`),
    ...(appUrl ? ['', appUrl] : []),
  ].join('\n');

  return { subject, html, text };
};

module.exports = {
  TIPO_LABEL,
  normalizeEmail,
  decideAlert,
  recipientsFor,
  buildDigests,
  renderDigestEmail,
};
