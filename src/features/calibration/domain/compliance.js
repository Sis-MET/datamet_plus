/**
 * Estados, prioridades y filtros de la pestaña Cumplimiento (evaluación de la
 * NB/ISO/IEC 17025:2018, puntos 7.5, 7.11 y 8.4, que hace el backend).
 */

export const COMPLIANCE_STATES = {
  CUMPLE: { label: 'Cumple', tone: 'success' },
  PARCIAL: { label: 'Parcial', tone: 'warning' },
  NO_CUMPLE: { label: 'No cumple', tone: 'danger' },
  LABORATORIO: { label: 'Del laboratorio', tone: 'info' },
};

// Orden de lectura: lo resuelto primero, lo que depende del laboratorio al final.
export const COMPLIANCE_ORDER = ['CUMPLE', 'PARCIAL', 'NO_CUMPLE', 'LABORATORIO'];

export const PRIORIDADES = {
  ALTA: { label: 'Prioridad alta', tone: 'danger' },
  MEDIA: { label: 'Prioridad media', tone: 'warning' },
  BAJA: { label: 'Prioridad baja', tone: 'neutral' },
};
const PRIORIDAD_ORDER = ['ALTA', 'MEDIA', 'BAJA'];

const joinSpanish = (parts) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`);

/** «De 23 requisitos, 6 se cumplen, 12 en parte y 2 no. Otros 3 dependen de evidencia del laboratorio.» */
export function complianceSentence(resumen) {
  const { CUMPLE = 0, PARCIAL = 0, NO_CUMPLE = 0, LABORATORIO = 0, total = 0 } = resumen || {};
  if (!total) return 'No hay requisitos evaluados.';
  const parts = [
    CUMPLE > 0 && `${CUMPLE} ${CUMPLE === 1 ? 'se cumple' : 'se cumplen'}`,
    PARCIAL > 0 && `${PARCIAL} en parte`,
    NO_CUMPLE > 0 && `${NO_CUMPLE} no`,
  ].filter(Boolean);
  const verbo = LABORATORIO === 1 ? 'depende' : 'dependen';
  if (parts.length === 0) return `De ${total} requisitos, ${LABORATORIO === 1 ? 'el único' : `los ${LABORATORIO}`} ${verbo} de evidencia del laboratorio.`;
  const software = `De ${total} requisitos, ${joinSpanish(parts)}.`;
  if (!LABORATORIO) return software;
  return `${software} ${LABORATORIO === 1 ? 'Otro' : `Otros ${LABORATORIO}`} ${verbo} de evidencia del laboratorio.`;
}

/** Deja en cada cláusula solo los requisitos de los estados elegidos (todos si no hay filtro). */
export function filterClausulas(clausulas, estados) {
  if (!estados || estados.size === 0) return clausulas;
  return clausulas
    .map(clausula => ({ ...clausula, requisitos: clausula.requisitos.filter(requisito => estados.has(requisito.estado)) }))
    .filter(clausula => clausula.requisitos.length > 0);
}

/** Acciones agrupadas por prioridad, de alta a baja, sin grupos vacíos. */
export function groupActions(acciones) {
  return PRIORIDAD_ORDER
    .map(prioridad => ({ prioridad, items: (acciones || []).filter(accion => accion.prioridad === prioridad) }))
    .filter(group => group.items.length > 0);
}

export const evaluatedAt = (iso) => (iso
  ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
  : '');
