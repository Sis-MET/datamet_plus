import { ClipboardList, FilePlus2, Hash } from 'lucide-react';
import { usePestanaRuta } from '../../shared/navigation/ruta';
import { Segmented } from '../calibration/components/primitives';
import { RimFormPage } from './RimFormPage';
import { RimNumeracionPage } from './RimNumeracionPage';
import { RimRegistrosPage } from './RimRegistrosPage';
import '../calibration/calibration.css';

const TABS = [
  { value: 'registros', label: 'Registros', icon: <ClipboardList className="h-4 w-4" aria-hidden="true" /> },
  { value: 'numeracion', label: 'Numeración', icon: <Hash className="h-4 w-4" aria-hidden="true" /> },
  { value: 'nuevo', label: 'Nuevo RIM', icon: <FilePlus2 className="h-4 w-4" aria-hidden="true" /> },
];

const PESTANAS = TABS.map(option => option.value);
const STORAGE_KEY = 'datamet_rim_tab';

/**
 * Apartado RIM: historial de los RIM (de ServiceMET y de la web), su
 * numeración por talonarios y el formulario web para registrar uno nuevo.
 */
export function RimPage({ currentUser }) {
  // La pestaña va en la dirección (/rim/registros, /rim/numeracion, /rim/nuevo).
  const { pestana: tab, cambiarPestana } = usePestanaRuta('rim', PESTANAS, {
    clave: STORAGE_KEY,
    predeterminada: 'registros',
  });

  return (
    <div className="flex flex-col">
      <div className="mx-auto w-full max-w-[1320px] px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
        <Segmented label="Apartado RIM" value={tab} onChange={cambiarPestana} options={TABS} />
      </div>
      <div className="vt-panel">
        {tab === 'nuevo' ? (
          <RimFormPage currentUser={currentUser} />
        ) : (
          <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            {tab === 'registros' ? <RimRegistrosPage /> : <RimNumeracionPage />}
          </main>
        )}
      </div>
    </div>
  );
}
