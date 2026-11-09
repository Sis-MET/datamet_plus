import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../../shared/components/ui/Button';
import { useResource } from '../../../system/hooks/useResource';
import { calibrationApi } from '../../api/calibration';

const anioActual = () => new Date().getFullYear();
const cargar = () => calibrationApi.estadoPatrones(anioActual());

/**
 * Aviso en Calibración › Certificados › Registros: cuántos servicios del año
 * salen provisionales porque a sus patrones les faltan datos, con el enlace a
 * Equipos › Patrones. No aparece si no hay ninguno o si no se puede leer.
 */
export function AvisoPatrones({ onVer }) {
  const { data } = useResource(cargar);
  const r = data?.resumen;
  if (!r || !r.serviciosProvisionales) return null;
  const faltan = r.patrones - r.listos;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3" role="status">
      <AlertTriangle className="h-[18px] w-[18px] flex-none text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13px] text-fg">
        En {data.anio}, <strong>{r.serviciosProvisionales} de {r.servicios}</strong> servicios salen con cálculo provisional porque a sus patrones les faltan datos
        ({faltan} {faltan === 1 ? 'patrón por completar' : 'patrones por completar'}).
      </p>
      {onVer && <Button size="sm" variant="secondary" onClick={onVer}>Ver en Equipos › Patrones</Button>}
    </div>
  );
}
