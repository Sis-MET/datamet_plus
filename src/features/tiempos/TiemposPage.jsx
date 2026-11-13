import { usePestanaRuta } from '../../shared/navigation/ruta';
import { calibrationApi } from '../calibration/api/calibration';
import { soporteApi } from '../soporte/api/soporte';
import { TiemposPanel } from './components/TiemposPanel';
import '../calibration/calibration.css';

const AREAS = {
  soporte: { area: 'soporte', cargar: soporteApi.tiempos },
  calibration: { area: 'calibracion', cargar: calibrationApi.tiempos },
};

/**
 * Tiempos de servicio de un apartado para quien no es de su área y los ve por
 * su permiso (Gestión de permisos; de inicio, los jefes de todas las áreas).
 * Es lo único del apartado que abre: no ofrece abrir los informes ni los
 * registros, que siguen siendo del área. La dirección queda en
 * /<apartado>/tiempos.
 */
export function TiemposPage({ view }) {
  usePestanaRuta(view, ['tiempos'], { predeterminada: 'tiempos' });
  const config = AREAS[view];
  if (!config) return null;
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="vt-panel flex flex-col gap-4">
        <TiemposPanel area={config.area} cargar={config.cargar} />
      </div>
    </main>
  );
}
