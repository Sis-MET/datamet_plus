/**
 * Configuración de la integración de Comercial con Bitrix24 (fase 2), leída
 * de backend/.env. Sin webhook, Comercial funciona igual y la pestaña
 * Bitrix24 explica qué falta.
 *
 *   BITRIX_WEBHOOK_URL      webhook entrante propio de Comercial (permiso crm;
 *                           con «user» también se leen los nombres de los
 *                           responsables). Es un secreto: nunca se muestra.
 *   BITRIX_SYNC_ENABLED     false apaga la sincronización automática (la
 *                           manual sigue disponible). Por omisión, true.
 *   BITRIX_SYNC_MINUTOS     cada cuántos minutos se sincroniza (5 a 240; 15).
 *   BITRIX_SYNC_DESDE       desde qué fecha de creación se copian las
 *                           negociaciones en la primera sincronización (2025-01-01).
 *   BITRIX_ESCRITURA        si DataMET+ puede escribir en las negociaciones
 *                           (fase 3): «real» escribe en Bitrix24; «prueba»
 *                           simula la escritura sobre la copia, sin llamar a
 *                           Bitrix24; sin valor (o cualquier otro), desactivada.
 *                           Escribir en el CRM se habilita solo a propósito.
 */

const MODOS_ESCRITURA = ['real', 'prueba'];

const texto = (env, nombre) => String(env[nombre] ?? '').trim();

/** Igual que ServiceMET: https://PORTAL/rest/USUARIO/SECRETO/. */
const resolverWebhook = (env) => {
  const raw = texto(env, 'BITRIX_WEBHOOK_URL');
  if (!raw) return { url: null };
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: null, error: 'BITRIX_WEBHOOK_URL no es una URL válida.' };
  }
  if (parsed.protocol !== 'https:') return { url: null, error: 'El webhook de Bitrix24 debe usar HTTPS.' };
  const match = parsed.pathname.match(/^\/rest\/(\d+)\/([A-Za-z0-9]+)\/?$/);
  if (!match || parsed.search || parsed.hash) {
    return { url: null, error: 'BITRIX_WEBHOOK_URL debe tener la forma https://PORTAL/rest/USUARIO/SECRETO/.' };
  }
  return { url: `${parsed.origin}/rest/${match[1]}/${match[2]}/`, secret: match[2], portal: parsed.origin };
};

const leerConfigBitrix = (env = process.env) => {
  const webhook = resolverWebhook(env);
  const minutos = Number(texto(env, 'BITRIX_SYNC_MINUTOS') || 15);
  const desde = texto(env, 'BITRIX_SYNC_DESDE') || '2025-01-01';
  return Object.freeze({
    configurado: Boolean(webhook.url),
    error: webhook.error || null,
    webhookUrl: webhook.url,
    webhookSecret: webhook.secret || null,
    // Solo el origen (https://b24-….bitrix24.es), para enlazar a la negociación.
    portal: webhook.portal || null,
    sincronizar: texto(env, 'BITRIX_SYNC_ENABLED').toLowerCase() !== 'false',
    minutos: Number.isFinite(minutos) ? Math.min(240, Math.max(5, Math.round(minutos))) : 15,
    desde: /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : '2025-01-01',
    escritura: MODOS_ESCRITURA.includes(texto(env, 'BITRIX_ESCRITURA').toLowerCase()) ? texto(env, 'BITRIX_ESCRITURA').toLowerCase() : 'desactivada',
  });
};

module.exports = { leerConfigBitrix, resolverWebhook };
