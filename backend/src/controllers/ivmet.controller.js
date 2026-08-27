const { z } = require('zod');
const { createAdminService } = require('../services/ivmet.admin-service');
const { createLegacyService } = require('../services/ivmet.legacy-service');
const {
  validateAction,
  querySchema,
  uuid,
} = require('../services/ivmet.validation');
const legacy = createLegacyService();
const service = createAdminService({ legacy });
const respond = (handler) => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json({ success: true, data: await handler(req) });
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(422).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Revisa los campos del formulario.',
        issues: error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    // No registrar req.body: puede contener credenciales temporales.
    const status = error.statusCode || 503;
    res.status(status).json({
      success: false,
      code: error.code || 'IVMET_UNAVAILABLE',
      message: error.statusCode
        ? error.message
        : 'IvMET no está disponible. Comprueba la conexión y reintenta.',
    });
  }
};
const read = (section, perClient = false) =>
  respond((req) =>
    service.read(
      section,
      perClient ? uuid.parse(req.params.clientId) : null,
      querySchema.parse(req.query)
    )
  );
module.exports = {
  getOverview: read('overview'),
  getClients: read('clients'),
  getPlans: read('plans'),
  getIntegration: read('integration'),
  getOnboarding: read('onboarding'),
  getClient: read('client', true),
  getEquipment: read('equipment', true),
  getUsers: read('users', true),
  getActivity: read('activity', true),
  searchLegacy: respond((req) =>
    legacy.search(
      z
        .string()
        .trim()
        .max(100)
        .parse(req.query.search || '')
    )
  ),
  legacyCatalog: respond((req) =>
    legacy.catalog(
      z.coerce.number().int().positive().parse(req.params.clientId)
    )
  ),
  mutate: respond((req) => {
    const body = z
      .object({ requestId: uuid, payload: z.record(z.string(), z.unknown()) })
      .strict()
      .parse(req.body);
    return service.mutate(
      req.params.action,
      validateAction(req.params.action, body.payload),
      'RIMMET:' + req.user.usuario.trim().toLowerCase(),
      body.requestId
    );
  }),
};
