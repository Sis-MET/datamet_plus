import { usePestanaRuta } from '../../shared/navigation/ruta';
import { RimFormPage } from './RimFormPage';
import { RimNumeracionPage } from './RimNumeracionPage';
import { RimRegistrosPage } from './RimRegistrosPage';
import '../calibration/calibration.css';

const PESTANAS = ['registros', 'numeracion', 'nuevo'];
const STORAGE_KEY = 'datamet_rim_tab';

/**
 * Apartado RIM: historial de los RIM (de ServiceMET y de la web), su
 * numeración por talonarios y el formulario web para registrar uno nuevo.
 */
export function RimPage({ currentUser }) {
  // La pestaña va en la dirección (/rim/registros, /rim/numeracion, /rim/nuevo)
  // y se elige desde la barra lateral.
  const { pestana: tab } = usePestanaRuta('rim', PESTANAS, {
    clave: STORAGE_KEY,
    predeterminada: 'registros',
  });

  return (
    <div className="vt-panel">
      {tab === 'nuevo' ? (
        <RimFormPage currentUser={currentUser} />
      ) : (
        <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {tab === 'registros' ? <RimRegistrosPage /> : <RimNumeracionPage />}
        </main>
      )}
    </div>
  );
}
