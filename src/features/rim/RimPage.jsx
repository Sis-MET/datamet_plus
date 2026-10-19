import { useState } from 'react';
import { ClipboardList, FilePlus2, Hash } from 'lucide-react';
import { safeStorage } from '../../shared/utils/storage';
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

const STORAGE_KEY = 'rimmet_rim_tab';

/**
 * Apartado RIM: historial de los RIM (de ServiceMET y de la web), su
 * numeración por talonarios y el formulario web para registrar uno nuevo.
 */
export function RimPage({ currentUser }) {
  const [tab, setTab] = useState(() => {
    const saved = safeStorage.getItem(STORAGE_KEY);
    return TABS.some(option => option.value === saved) ? saved : 'registros';
  });

  const cambiar = (value) => {
    safeStorage.setItem(STORAGE_KEY, value);
    setTab(value);
  };

  return (
    <div className="flex flex-col">
      <div className="mx-auto w-full max-w-[1320px] px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
        <Segmented label="Apartado RIM" value={tab} onChange={cambiar} options={TABS} />
      </div>
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
