import { useCallback, useState } from 'react';
import { BellRing, CalendarRange, FileText, Settings } from 'lucide-react';
import { cn } from '../../shared/utils/cn';
import { safeStorage } from '../../shared/utils/storage';
import { InformeEditor } from './components/InformeEditor';
import { AprobadoresPanel } from './components/AprobadoresPanel';
import { soporteApi } from './api/soporte';
import { useResource } from '../system/hooks/useResource';
import { InformesLista } from './components/InformesLista';
import { AvisosPanel } from './components/proximos/AvisosPanel';
import { ProximosPanel } from './components/proximos/ProximosPanel';
import { AGRUPACIONES, filtrosVacios } from './domain/informe';
import { PLANTILLAS } from './domain/plantillas';
import { useSoporteAlertCount } from './hooks/useSoporteAlertCount';
import '../calibration/calibration.css';
import './soporte.css';

const ABIERTO = 'rimmet_soporte_informe';
const AGRUPAR = 'rimmet_soporte_agrupar';
const PESTANA = 'rimmet_soporte_pestana';
const PESTANAS = ['informes', 'proximos', 'avisos', 'configuracion'];

const leerPestana = () => {
  const valor = safeStorage.getItem(PESTANA);
  return PESTANAS.includes(valor) ? valor : 'informes';
};

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

/** Pestañas del apartado; «Próximos servicios» lleva el contador de lo que requiere atención. */
function Pestanas({ pestana, onChange, alertas, configurar }) {
  const secciones = [
    { id: 'informes', label: 'Informes', icon: FileText },
    { id: 'proximos', label: 'Próximos servicios', icon: CalendarRange, count: alertas?.total || null, alert: alertas?.vencidas > 0 },
    { id: 'avisos', label: 'Avisos', icon: BellRing },
    ...(configurar ? [{ id: 'configuracion', label: 'Configuración', icon: Settings }] : []),
  ];
  return (
    <nav aria-label="Secciones de Soporte técnico" className="cal-segmented cal-tabs flex-wrap self-start">
      {secciones.map((seccion) => {
        const Icon = seccion.icon;
        return (
          <button key={seccion.id} type="button" aria-current={pestana === seccion.id ? 'page' : undefined} onClick={() => onChange(seccion.id)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {seccion.label}
            {seccion.count != null && <span className={cn('cal-count', seccion.alert && 'cal-count-alert')}>{seccion.count}</span>}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Soporte técnico: los informes de los 8 servicios del área (preventivo
 * regular y avanzado, correctivo, diagnóstico, instalación, verificación con
 * IBMETRO, verificaciones internas y relevamiento de datos) a partir de lo
 * que sube ServiceMET, con el diseño de sus plantillas Excel, y los próximos
 * servicios que sugieren los técnicos con su seguimiento y avisos. Al volver
 * de un informe, la lista conserva filtros, página, agrupación y grupos
 * abiertos, y se vuelve a la pestaña de la que se salió.
 */
export function SoportePage() {
  const [pestanaGuardada, setPestanaState] = useState(leerPestana);
  const { data: permisos } = useResource(soporteApi.permisos);
  const configurar = permisos?.configurarAprobadores === true;
  const pestana = pestanaGuardada === 'configuracion' && !configurar ? 'informes' : pestanaGuardada;
  const alertas = useSoporteAlertCount(true);
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

  const setPestana = (valor) => {
    safeStorage.setItem(PESTANA, valor);
    setPestanaState(valor);
  };

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

  const ancho = abierto ? 'max-w-[1680px]' : pestana === 'informes' ? 'max-w-[1320px]' : 'max-w-[1600px]';

  return (
    <main className={`mx-auto flex w-full flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 ${ancho}`}>
      {!abierto && <Pestanas pestana={pestana} onChange={setPestana} alertas={alertas} configurar={configurar} />}
      {!abierto && pestana === 'configuracion' && configurar && <AprobadoresPanel />}
      {abierto && (
        <InformeEditor key={`${abierto.tipo}:${abierto.codigo}`} tipo={abierto.tipo} codigo={abierto.codigo} onVolver={cerrar} />
      )}
      {/* Se ocultan (sin desmontarse) mientras hay un informe abierto: al volver conservan año, filtros y vista. */}
      {pestana === 'proximos' && <div hidden={Boolean(abierto)}><ProximosPanel onAbrirInforme={abrir} /></div>}
      {pestana === 'avisos' && <div hidden={Boolean(abierto)}><AvisosPanel onAbrirInforme={abrir} /></div>}
      {!abierto && pestana === 'informes' && (
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
