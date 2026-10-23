export const MESES_PLAN = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function seleccionarProximos(eventos, { anio, desdeMes = 1, hastaMes = 12, incluirDescartados = false }) {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100 || desdeMes < 1 || hastaMes > 12 || desdeMes > hastaMes) return [];
  const desde = `${anio}-${String(desdeMes).padStart(2, '0')}-01`;
  const hasta = `${anio}-${String(hastaMes).padStart(2, '0')}-31`;
  return eventos.filter(e => e.clase === 'PROXIMO' && e.fecha >= desde && e.fecha <= hasta
    && (incluirDescartados || (!e.descartada && e.situacion !== 'DESCARTADO')))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.cliente).localeCompare(String(b.cliente), 'es')
      || String(a.codMetrica).localeCompare(String(b.codMetrica), 'es', { numeric: true }));
}

export const periodoPlan = ({ anio, desdeMes, hastaMes }) => desdeMes === 1 && hastaMes === 12 ? `Año ${anio}`
  : desdeMes === hastaMes ? `${MESES_PLAN[desdeMes - 1]} ${anio}`
    : `${MESES_PLAN[desdeMes - 1]} a ${MESES_PLAN[hastaMes - 1].toLowerCase()} de ${anio}`;
