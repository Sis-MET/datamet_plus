const { createOperations } = require('../services/ivmet.operations');
const { actorIvmet } = require('../services/ivmet.actor');
// Los casos y actualizaciones se atienden dentro de cada cliente: soporte y
// metrología necesitan el directorio y la ficha básica, nunca lo comercial.
const clientDirectory = (req) =>
  req.method === 'GET' && /^\/clients(\/[^/]+)?\/?$/.test(req.path);
const pick = (row, keys) =>
  Object.fromEntries(keys.map((key) => [key, row?.[key] ?? null]));
const omit = (row, keys) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
const client = ['id', 'codigo', 'nombre', 'razon_social', 'activo'];
// Los avisos de casos y actualizaciones sin revisar son de soporte.
const attention = ['newCases', 'pendingUpdates'];
function limitClientRead(section, data, capabilities = []) {
  const commercial = capabilities.includes('commercial');
  const support = capabilities.includes('support');
  if (!['clients', 'client'].includes(section) || (commercial && support))
    return data;
  if (section === 'clients')
    return {
      ...data,
      items: data.items.map((item) => ({
        ...(commercial
          ? omit(item, attention)
          : pick(item, [...client, 'plants', 'equipment', 'review'])),
        ...(support ? pick(item, attention) : {}),
      })),
    };
  return {
    ...(commercial
      ? omit(data, ['attention'])
      : {
          client: pick(data.client, client),
          plants: data.plants.map((plant) =>
            pick(plant, ['id', 'legacy_codigo_planta', 'nombre', 'activo'])
          ),
        }),
    ...(support ? { attention: pick(data.attention, attention) } : {}),
  };
}
function createStaffMiddleware(service = createOperations()) {
  return async (req, res, next) => {
    // Las operaciones nuevas comprueban su permiso dentro de cada RPC.
    if (req.path.startsWith('/ops/')) return next();
    const directory = clientDirectory(req);
    const capability =
      /^\/(integration|onboarding|legacy)(\/|$)/.test(req.path) ||
      req.path.startsWith('/actions/scope.')
        ? 'integration'
        : 'commercial';
    try {
      const staff = await service.authorize(
        actorIvmet(req.user.usuario),
        directory ? null : capability
      );
      if (
        directory &&
        !['commercial', 'support'].some((c) => staff?.capabilities?.includes(c))
      )
        throw Object.assign(
          new Error('Tu permiso interno IvMET no permite esta operación.'),
          { statusCode: 403, code: 'STAFF_PERMISSION_REQUIRED' }
        );
      req.ivmetStaff = staff;
      next();
    } catch (error) {
      res
        .status(error.statusCode || 503)
        .json({
          success: false,
          code: error.code || 'STAFF_UNAVAILABLE',
          message: error.statusCode
            ? error.message
            : 'No se pudo comprobar tu permiso IvMET.',
        });
    }
  };
}
module.exports = { createStaffMiddleware, limitClientRead };
