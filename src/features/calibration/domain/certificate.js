import { formatDate } from './format';

export const emptyCertificate = (base = {}) => ({
  numero: '',
  ente: base.ente || '',
  fecha: '',
  periodoDias: base.periodoDias || 365,
  observaciones: '',
});

/** Certificado vigente de un equipo en el formato del formulario. */
export const certificateFromEquipo = (equipo) => ({
  numero: equipo.certificado || '',
  ente: equipo.enteCalibrador || '',
  fecha: equipo.certFecha || '',
  periodoDias: equipo.periodoDias || 365,
  observaciones: '',
});

/**
 * Errores de un certificado antes de enviarlo. `posteriorA` es la emisión del
 * certificado vigente cuando se registra uno nuevo.
 */
export function certificateErrors(value, { hoy, posteriorA } = {}) {
  const errors = {};
  if (!value.numero.trim()) errors.numero = 'Escribe el número del certificado.';
  if (!value.ente.trim()) errors.ente = 'Indica el ente calibrador.';
  if (!value.fecha) errors.fecha = 'Indica la fecha de emisión.';
  else if (hoy && value.fecha > hoy) errors.fecha = 'No puede ser posterior a hoy.';
  else if (posteriorA && value.fecha <= posteriorA) {
    errors.fecha = `Debe ser posterior al ${formatDate(posteriorA)}, emisión del certificado vigente.`;
  }
  if (!(Number(value.periodoDias) > 0)) errors.periodoDias = 'Indica la vigencia en días.';
  return errors;
}

/** Cuerpo que espera la API para un certificado. */
export const certificatePayload = (value) => ({
  numero: value.numero.trim(),
  ente: value.ente.trim(),
  fecha: value.fecha,
  periodoDias: Number(value.periodoDias),
  observaciones: value.observaciones.trim() || null,
});
