const { createHmac } = require('node:crypto');
const { getSupabaseAdminClient } = require('../config/supabase');
const env = require('../config/env');

const messages = {
  CUSTOMER_MANAGED_CONFIGURATION: 'Las áreas, los patrones y los planes metrológicos se gestionan por el cliente desde su app.',
  UPDATE_NOT_ACCESSIBLE: 'El cliente retiró el acceso a esta actualización o ya no está disponible.',
  STAFF_ACCESS_DENIED: 'El código fue validado, pero tu usuario aún no tiene un permiso interno IvMET. El administrador debe asignarlo; el primer administrador se registra con ivmet:admin-bootstrap.',
  STAFF_PERMISSION_REQUIRED: 'Tu permiso interno IvMET no permite esta operación.',
  CASE_NOT_ACCESSIBLE: 'El expediente ya no está disponible o el cliente retiró el acceso.',
  OFFICIAL_PROCEDURE_REQUIRED: 'La publicación requiere el procedimiento oficial, el motor y los casos de prueba aprobados por el metrólogo.',
  PUBLISHED_PLAN_IS_IMMUTABLE: 'Esta versión ya no se puede editar. Crea una nueva versión.',
  LAST_ADMIN_REQUIRED: 'Debe conservarse al menos un administrador activo.',
  ASSIGNEE_NOT_AVAILABLE: 'El responsable debe tener un permiso técnico activo en IvMET.',
  ROW_VERSION_CONFLICT:
    'Otro administrador cambió este registro. Actualiza la vista e inténtalo de nuevo.',
  IDEMPOTENCY_CONFLICT:
    'Esta solicitud ya se utilizó con otros datos. Abre nuevamente el formulario.',
  LICENSE_SEATS_EXHAUSTED:
    'No quedan cupos disponibles. Compra más cupos o revoca una licencia.',
  SUBSCRIPTION_NOT_ACTIVE:
    'La suscripción no está vigente o no pertenece al cliente.',
  SUBSCRIPTION_NOT_PAID:
    'Completa el pago del período antes de activar la suscripción.',
  CLIENT_HAS_CONTRACT:
    'El cliente ya tiene un contrato abierto. Usa renovación o cancela el anterior.',
  PLANT_SCOPE_INVALID: 'Selecciona plantas activas del mismo cliente.',
  USERNAME_EXISTS: 'El nombre de usuario ya está en uso.',
  PRICE_NOT_EFFECTIVE:
    'La tarifa no corresponde a la fecha o periodicidad del período.',
  PRICE_DATE_CONFLICT:
    'Ya existe una tarifa con esa fecha o una fecha posterior.',
  CONTRACT_DATES_INVALID:
    'Revisa las fechas: la firma no puede ser futura y el contrato debe cubrir el período.',
  CONTRACT_EXTENSION_REQUIRED:
    'Amplía la vigencia del contrato antes de renovar este período.',
  RENEWAL_ALREADY_EXISTS: 'Ya existe una factura para el siguiente período.',
  RENEWAL_SEATS_INSUFFICIENT:
    'La renovación debe incluir cupos suficientes para las licencias asignadas.',
  PAYMENT_AMOUNT_INVALID:
    'El pago debe ser mayor a cero y no puede superar el saldo pendiente.',
  PAYMENT_DATE_INVALID: 'La fecha del pago no puede ser futura.',
  INVOICE_HAS_PAYMENTS:
    'Una factura con pagos no se puede anular desde este flujo.',
  SEATS_IN_USE: 'Primero revoca las licencias que ocupan esos cupos.',
  GRACE_NOT_AVAILABLE: 'El período de gracia no corresponde o ya venció.',
  PUBLISHED_PLAN_REQUIRED:
    'Debes seleccionar un plan metrológico publicado y aprobado.',
  EQUIPMENT_REQUIRES_REVIEW:
    'Este equipo necesita corregirse en DataMET antes de habilitarlo.',
  SCOPE_ALREADY_EXISTS:
    'Este cliente ya tiene una incorporación. Consulta su estado o amplía el alcance existente.',
  SCOPE_NOT_RETRYABLE:
    'La solicitud ya está en cola o en curso. Actualiza para consultar su estado.',
  SCOPE_NOT_EDITABLE:
    'El alcance está suspendido o cambió. Actualiza la vista antes de ampliarlo.',
};
function unwrap({ data, error }) {
  if (!error) return data;
  const code = error.message;
  const missing = error.code === 'PGRST202';
  const statusCode = missing
    ? 503
    : error.code === '23505'
      ? 409
      : error.code === '42501'
        ? 403
        : messages[code]
          ? 409
          : error.code === 'P0001'
            ? 422
            : 502;
  const message = missing
    ? 'Faltan las migraciones administrativas de IvMET en Supabase. Consulta la guía de despliegue.'
    : messages[code] ||
      (error.code === '23505'
        ? 'Ya existe un registro con ese código, número o usuario.'
        : error.code === 'P0001'
          ? 'La operación no cumple las reglas del registro. Actualiza y revisa los datos.'
          : 'No se pudo completar la operación de IvMET.');
  throw Object.assign(new Error(message), {
    statusCode,
    code: missing
      ? 'IVMET_MIGRATION_REQUIRED'
      : messages[code]
        ? code
        : /^[A-Z0-9_]{4,64}$/.test(error.code || '')
          ? error.code
          : 'IVMET_UPSTREAM_ERROR',
  });
}
const createAdminService = ({
  getClient = getSupabaseAdminClient,
  secret = env.jwt.secret,
  legacy,
} = {}) => ({
  async read(section, clientId = null, filters = {}) {
    return unwrap(
      await getClient().rpc('ivmet_admin_read', {
        section,
        client_id: clientId,
        filters,
      })
    );
  },
  async mutate(action, payload, actor, requestId) {
    const client = getClient();
    const rpc = (operation, data) =>
      client
        .rpc('ivmet_admin_mutate', {
          actor,
          action: operation,
          payload: data,
          request_id: requestId,
        })
        .then(unwrap);
    if (['scope.request', 'scope.extend'].includes(action)) {
      // Recuperar respuestas perdidas antes de consultar de nuevo DataMET.
      const completed = unwrap(
        await client.rpc('ivmet_admin_request_result', {
          target_actor: actor,
          target_request_id: requestId,
          target_action: action,
        })
      );
      // Incluso en un reintento, la RPC comprueba el hash original (sin nombre).
      if (completed) return rpc(action, payload);
      const customer = await legacy.validateScope(payload);
      return rpc(action, {
        ...payload,
        ...(customer?.name ? { clientName: customer.name } : {}),
      });
    }
    if (!['user.create', 'user.reset'].includes(action))
      return rpc(action, payload);
    // No guardar, auditar ni registrar la contraseña. El HMAC solo detecta reintentos distintos.
    const { password, ...safe } = payload;
    const digest = createHmac('sha256', secret).update(password).digest('hex');
    if (action === 'user.create') {
      const reserved = await rpc('user.reserve', {
        ...safe,
        passwordDigest: digest,
      });
      const existing = await client.auth.admin.getUserById(reserved.id);
      if (existing.data?.user) {
        if (
          existing.data.user.email !== reserved.email ||
          existing.data.user.app_metadata?.ivmet_request !== requestId
        ) {
          throw Object.assign(
            new Error('La reserva de usuario no coincide con Auth.'),
            { statusCode: 409 }
          );
        }
      } else {
        if (existing.error && existing.error.status !== 404)
          throw Object.assign(
            new Error(
              'No se pudo verificar la cuenta en Auth. Reintenta con la misma solicitud.'
            ),
            { statusCode: 503 }
          );
        const created = await client.auth.admin.createUser({
          id: reserved.id,
          email: reserved.email,
          password,
          email_confirm: true,
          app_metadata: { ivmet_request: requestId },
        });
        if (created.error) {
          // Si Auth confirmó pero la respuesta se perdió, el siguiente intento recupera el mismo UUID.
          throw Object.assign(
            new Error(
              'No se pudo crear la cuenta en Auth. Reintenta sin cerrar el formulario.'
            ),
            { statusCode: 503 }
          );
        }
      }
      return rpc('user.create', safe);
    }
    // Se bloquea el acceso a datos antes de cambiar Auth; si Auth falla, el reintento es seguro.
    await rpc('user.reset', { ...safe, passwordDigest: digest });
    const completed = unwrap(
      await client.rpc('ivmet_admin_request_result', {
        target_actor: actor,
        target_request_id: requestId,
        target_action: 'user.reset.complete',
      })
    );
    if (completed) return completed;
    const changed = await client.auth.admin.updateUserById(payload.id, {
      password,
    });
    if (changed.error)
      throw Object.assign(
        new Error(
          'El usuario debe cambiar contraseña, pero Auth no pudo restablecerla. Reintenta esta misma solicitud.'
        ),
        { statusCode: 503 }
      );
    return rpc('user.reset.complete', {
      id: payload.id,
      clientId: payload.clientId,
    });
  },
});
module.exports = { createAdminService, unwrap };
