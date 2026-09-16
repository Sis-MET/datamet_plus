const { z } = require('zod');
const uuid = z.string().uuid();
const text = (max) => z.string().trim().min(1).max(max);
const optional = (max) => z.string().trim().max(max).optional().default('');
const version = z.string().regex(/^\d+$/);
const date = z.iso.date();
const amount = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,14})(\.\d{1,2})?$/,
    'Usa un importe decimal sin separador de miles'
  );
const decimal = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,9})(\.\d{1,9})?$/,
    'Usa un decimal válido, máximo 9 decimales'
  );
const plantIds = z
  .array(uuid)
  .min(1)
  .max(200)
  .refine((v) => new Set(v).size === v.length, 'Plantas duplicadas');
const reason = text(1000);
const edit = { id: uuid.optional(), version: version.optional() };
const scope = { clientId: uuid };
const target = { ...scope, id: uuid };
const role = z.enum(['cliente_operador', 'cliente_jefe_calidad']);
const user = {
  ...scope,
  username: text(100).regex(/^[a-zA-Z0-9._-]{3,100}$/),
  name: text(200),
  role,
  plantIds,
};

const schemas = {
  'scope.retry': z.object({ id: uuid, reason }),
  'plan.save': z.object({
    ...edit,
    name: text(150),
    description: optional(2000),
    seats: z.number().int().min(1).max(10000),
    graceDays: z.number().int().min(0).max(90),
    active: z.boolean().default(true),
  }),
  'price.create': z.object({
    planId: uuid,
    periodicity: z.enum(['MONTHLY', 'ANNUAL']),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount,
    startsOn: date,
  }),
  'contract.create': z.object({
    ...scope,
    priceId: uuid,
    number: text(100),
    invoiceNumber: text(100),
    signedOn: date,
    startsOn: date,
    endsOn: date,
    notes: optional(3000),
  }),
  'subscription.renew': z.object({
    ...target,
    version,
    priceId: uuid,
    invoiceNumber: text(100),
    seats: z.number().int().min(0).max(10000),
    additionalAmount: amount,
  }),
  'seats.purchase': z.object({
    ...target,
    version,
    invoiceNumber: text(100),
    seats: z.number().int().min(1).max(10000),
    amount,
  }),
  'payment.record': z.object({
    ...target,
    version,
    amount,
    paidOn: date,
    method: z.enum(['TRANSFER', 'CASH', 'OTHER']),
    reference: text(200),
  }),
  'invoice.void': z.object({ ...target, version, reason }),
  'subscription.state': z.object({
    ...target,
    version,
    state: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'GRACE']),
    reason,
  }),
  'contract.extend': z.object({ ...target, version, endsOn: date, reason }),
  'seat.revoke': z.object({ ...target, version, reason }),
  'user.create': z.object({ ...user, password: z.string().min(12).max(200) }),
  'user.update': z.object({
    ...target,
    version,
    name: text(200),
    role,
    plantIds,
    active: z.boolean(),
    reason: optional(1000),
  }),
  'user.reset': z.object({
    ...target,
    version,
    reason,
    password: z.string().min(12).max(200),
  }),
  'license.assign': z.object({ ...target, subscriptionId: uuid }),
  'license.revoke': z.object({ ...target, reason }),
  'area.save': z.object({
    ...scope,
    ...edit,
    plantId: uuid,
    name: text(150),
    active: z.boolean().default(true),
  }),
  'pattern.save': z.object({
    ...scope,
    ...edit,
    code: text(100),
    description: text(300),
    type: text(50),
    class: optional(50),
    unit: text(20),
    capacity: z.union([decimal, z.literal('')]),
    plantIds,
    active: z.boolean().default(true),
  }),
  'certificate.create': z.object({
    ...scope,
    patternId: uuid,
    number: text(150),
    lab: text(250),
    calibratedOn: date,
    expiresOn: date,
  }),
  'certificate.annul': z.object({ ...target, reason }),
  'equipment.configure': z.object({
    ...target,
    version,
    areaId: z.literal('').optional(),
    planVersionId: z.literal('').optional(),
    enabled: z.boolean(),
  }),
  'equipment.bulk-configure': z.object({
    ...scope,
    enabled: z.boolean(),
    ids: z
      .array(uuid)
      .min(1)
      .max(500)
      .refine((v) => new Set(v).size === v.length, 'Balanzas duplicadas'),
  }),
  'scope.request': z.object({
    legacyClientId: z.number().int().positive(),
    clientCode: z.string().regex(/^\d{4}$/),
    plantCodes: z
      .array(z.string().regex(/^\d{4}-\d{2}$/))
      .min(1)
      .max(200),
    equipmentCodes: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{3}$/))
      .min(1)
      .max(2000),
    paidConfirmed: z.literal(true),
    reason,
  }),
};
schemas['scope.extend'] = schemas['scope.request'].extend({
  id: uuid,
  version,
});
const validateAction = (action, data) => {
  if (['area.save','pattern.save','certificate.create','certificate.annul'].includes(action)) {
    throw Object.assign(new Error('La configuración operativa pertenece al cliente y se gestiona desde su app.'), { statusCode: 403, code: 'CUSTOMER_MANAGED_CONFIGURATION' });
  }
  if (!schemas[action])
    throw Object.assign(new Error('Operación administrativa desconocida'), {
      statusCode: 404,
    });
  const parsed = schemas[action].strict().parse(data);
  if (
    parsed.id &&
    ['plan.save', 'area.save', 'pattern.save'].includes(action) &&
    parsed.version === undefined
  ) {
    throw Object.assign(
      new Error('Falta la versión del registro. Actualiza la vista.'),
      { statusCode: 422 }
    );
  }
  return parsed;
};
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).default(''),
    plantId: uuid.optional(),
    status: z.enum(['READY', 'REQUIRES_REVIEW', 'QUARANTINED']).optional(),
    legacyClientId: z.coerce.number().int().positive().optional(),
    scopeId: uuid.optional(),
  })
  .strict();
module.exports = { validateAction, querySchema, uuid };
