import { useCallback, useState } from 'react';
import { safeStorage } from '../../shared/utils/storage';
import { InformeEditor } from './components/InformeEditor';
import { InformesLista } from './components/InformesLista';
import { AGRUPACIONES, filtrosVacios } from './domain/informe';
import { PLANTILLAS } from './domain/plantillas';
import '../calibration/calibration.css';
import './soporte.css';

const ABIERTO = 'rimmet_soporte_informe';
const AGRUPAR = 'rimmet_soporte_agrupar';

/** Informe abierto al recargar la página, si sigue siendo válido. */
const leerAbierto = () => {
  try {
    const valor = JSON.parse(safeStorage.getItem(ABIERTO) || 'null');
    return valor && PLANTILLAS[valor.tipo] && typeof valor.codigo === 'string' ? valor : null;
  } catch {
    return null;
  }
};

/** Agrupación elegida la última vez; por omisión, por OTST. */
const leerAgrupar = () => {
  const valor = safeStorage.getItem(AGRUPAR);
  return AGRUPACIONES.includes(valor) ? valor : 'otst';
};

/**
 * Soporte técnico: los informes de los 8 servicios del área (preventivo
 * regular y avanzado, correctivo, diagnóstico, instalación, verificación con
 * IBMETRO, verificaciones internas y relevamiento de datos) a partir de lo
 * que sube ServiceMET, con el diseño de sus plantillas Excel. Al volver de un
 * informe, la lista conserva filtros, página, agrupación y grupos abiertos.
 */
export function SoportePage() {
  const [abierto, setAbierto] = useState(leerAbierto);
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [page, setPage] = useState(1);
  const [agrupar, setAgrupar] = useState(leerAgrupar);
  const [abiertos, setAbiertos] = useState(() => new Set());

  // null limpia todos los filtros.
  const cambiarFiltros = useCallback((cambios) => {
    setFiltros(actual => (cambios === null ? filtrosVacios() : { ...actual, ...cambios }));
    setPage(1);
  }, []);

  const cambiarAgrupar = useCallback((valor) => {
    safeStorage.setItem(AGRUPAR, valor);
    setAgrupar(valor);
    setPage(1);
  }, []);

  const abrir = (informe) => {
    const valor = { tipo: informe.tipo, codigo: informe.codigo };
    safeStorage.setItem(ABIERTO, JSON.stringify(valor));
    setAbierto(valor);
    window.scrollTo({ top: 0 });
  };

  const cerrar = () => {
    safeStorage.removeItem(ABIERTO);
    setAbierto(null);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className={`mx-auto flex w-full flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 ${abierto ? 'max-w-[1680px]' : 'max-w-[1320px]'}`}>
      {abierto ? (
        <InformeEditor key={`${abierto.tipo}:${abierto.codigo}`} tipo={abierto.tipo} codigo={abierto.codigo} onVolver={cerrar} />
      ) : (
        <InformesLista
          filtros={filtros}
          page={page}
          agrupar={agrupar}
          abiertos={abiertos}
          onFiltros={cambiarFiltros}
          onPage={setPage}
          onAgrupar={cambiarAgrupar}
          onAbiertos={setAbiertos}
          onOpen={abrir}
        />
      )}
    </main>
  );
}
