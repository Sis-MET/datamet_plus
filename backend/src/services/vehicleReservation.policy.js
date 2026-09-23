// Una reserva en la fila de un vehículo pertenece a quien la creó. Solo esa
// persona (o un desarrollador) puede editarla, moverla o eliminarla, para que
// nadie libere o cambie un vehículo que otro ya tomó.
//
// Las filas nuevas guardan id_creador y se comparan por id. Las anteriores a la
// migración 003 solo tienen creado_por (texto) y se comparan por nombre.

const normalizeName = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

// Filas antiguas sin creador real: no hay a quién proteger.
const UNOWNED_AUTHORS = new Set(['', 'sistema']);

const isDeveloper = (actor) => String(actor?.acceso_cron) === '3';

const toUserId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * @param {object} params
 * @param {object} params.actor      Usuario del token (req.user).
 * @param {string} params.creadoPor  Valor de DATA_CRONOGRAMA.creado_por.
 * @param {number} [params.creadorId] Valor de DATA_CRONOGRAMA.id_creador.
 * @param {string[]} [params.actorAliases] Otros nombres con los que el actor
 *   pudo quedar registrado como creador (p. ej. su primer nombre).
 */
const canManageVehicleReservation = ({ actor, creadoPor, creadorId, actorAliases = [] }) => {
  if (isDeveloper(actor)) return true;

  const ownerId = toUserId(creadorId);
  if (ownerId) return toUserId(actor?.id) === ownerId;

  const owner = normalizeName(creadoPor);
  if (UNOWNED_AUTHORS.has(owner)) return true;

  return [actor?.usuario, ...actorAliases]
    .map(normalizeName)
    .some(name => name && name === owner);
};

const buildVehicleReservationError = (creadoPor) => {
  const error = new Error(
    `Esta reserva de vehículo pertenece a ${String(creadoPor).trim()}. Solo esa persona puede modificarla o eliminarla.`
  );
  error.statusCode = 403;
  return error;
};

module.exports = {
  toUserId,
  canManageVehicleReservation,
  buildVehicleReservationError,
};
