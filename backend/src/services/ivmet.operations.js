const { z } = require('zod');
const { getSupabaseAdminClient } = require('../config/supabase');
const { unwrap } = require('./ivmet.admin-service');
const uuid = z.string().uuid();
const text = (max) => z.string().trim().min(1).max(max);
const version = z.string().regex(/^[1-9]\d*$/);
const schemas = {
  'equipment-update.review': z.object({ id: uuid, version, comment: text(2000) }),
  'case.update': z.object({
    id: uuid,
    version,
    status: z.enum(['NEW', 'IN_REVIEW', 'WAITING_CLIENT', 'RESOLVED']),
    assignee: z.string().max(150).default(''),
    comment: text(2000),
  }),
  'staff.save': z.object({
    actor: text(107)
      .regex(/^RIMMET:[^\s:]+$/)
      .transform((value) => 'RIMMET:' + value.slice(7).toLowerCase()),
    name: text(150),
    role: z.enum(['admin', 'commercial', 'support', 'metrologist']),
    active: z.boolean(),
    version: version.optional(),
  }),
};
const sections = z.enum([
  'session',
  'equipment-updates',
  'cases',
  'case',
  'assignees',
  'staff',
  'readiness',
  'billing',
  'privacy',
  'audit',
]);
const filtersSchema = z
  .object({
    id: uuid.optional(),
    clientId: uuid.optional(),
    plantId: uuid.optional(),
    search: z.string().trim().max(100).default(''),
    status: z
      .enum([
        'NEW',
        'IN_REVIEW',
        'WAITING_CLIENT',
        'RESOLVED',
        'DRAFT',
        'PUBLISHED',
        'RETIRED',
      ])
      .optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
function validateOperation(action, payload) {
  if (action.startsWith('metrology.')) throw Object.assign(new Error('Los planes metrológicos los gestiona el cliente desde la app.'), { statusCode: 403, code: 'CUSTOMER_MANAGED_CONFIGURATION' });
  if (!schemas[action])
    throw Object.assign(new Error('Operación desconocida.'), {
      statusCode: 404,
    });
  return schemas[action].strict().parse(payload);
}
function createOperations({ getClient = getSupabaseAdminClient } = {}) {
  return {
    authorize: (actor, capability = null) =>
      getClient()
        .rpc('ivmet_staff_authorize', { actor, capability })
        .then(unwrap),
    read: (actor, section, filters) =>
      getClient()
        .rpc('ivmet_ops_read', {
          actor,
          section: sections.parse(section),
          filters: filtersSchema.parse(filters),
        })
        .then(unwrap),
    mutate: (actor, action, payload, requestId) =>
      getClient()
        .rpc('ivmet_ops_mutate', {
          actor,
          action,
          payload: validateOperation(action, payload),
          request_id: uuid.parse(requestId),
        })
        .then(unwrap),
  };
}
module.exports = { createOperations, validateOperation, filtersSchema };
