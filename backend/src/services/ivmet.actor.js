/**
 * Prefijo con el que IvMET identifica a quien actúa desde DataMET+. Viene del
 * nombre anterior de la aplicación (RimMET) y no cambia con ella: la base de
 * IvMET (Supabase) lo exige en sus funciones (`actor like 'RIMMET:%'`) y en
 * private.rimmet_staff, y la auditoría ya registrada lo usa.
 */
const PREFIJO_ACTOR = 'RIMMET:';

/** Actor de IvMET de un usuario de DataMET+, siempre en minúsculas. */
const actorIvmet = (usuario) => PREFIJO_ACTOR + String(usuario ?? '').trim().toLowerCase();

/** Usuario de DataMET+ que corresponde a un actor de IvMET. */
const usuarioDeActor = (actor) => {
  const valor = String(actor ?? '');
  return valor.startsWith(PREFIJO_ACTOR) ? valor.slice(PREFIJO_ACTOR.length) : valor;
};

module.exports = { PREFIJO_ACTOR, actorIvmet, usuarioDeActor };
