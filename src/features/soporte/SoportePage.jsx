import { useCallback, useEffect, useState } from 'react';
import { safeStorage } from '../../shared/utils/storage';
import { usePestanaRuta } from '../../shared/navigation/ruta';
import { InformeEditor } from './components/InformeEditor';
import { AprobadoresPanel } from './components/AprobadoresPanel';
import { soporteApi } from './api/soporte';
import { useResource } from '../system/hooks/useResource';
import { InformesLista } from './components/InformesLista';
import { AvisosPanel } from './components/proximos/AvisosPanel';
import { ProximosPanel } from './components/proximos/ProximosPanel';
import { TiemposPanel } from '../tiempos/components/TiemposPanel';
import { AGRUPACIONES, filtrosVacios } from './domain/informe';
import { PLANTILLAS } from './domain/plantillas';
import '../calibration/calibration.css';
import './soporte.css';

const ABIERTO = 'datamet_soporte_informe';
const AGRUPAR = 'datamet_soporte_agrupar';
const PESTANA = 'datamet_soporte_pestana';
const PESTANAS = ['informes', 'proximos', 'avisos', 'tiempos', 'configuracion'];
// Las que ve también quien solo consulta (Comercial); las demás esperan los permisos.
const DE_CONSULTA = ['informes', 'proximos'];

/** ¿Puede ver la pestaña? null mientras no llegan los permisos. */
const pestanaHabilitada = (pestana, permisos) => {
  if (DE_CONSULTA.includes(pestana)) return true;
  if (!permisos) return null;
  // Los tiempos de servicio van con su permiso (Gestión de permisos), también para quien solo consulta.
  if (pestana === 'tiempos') return permisos.tiempos === true;
  if (permisos.consulta) return false;
  if (pestana === 'configuracion') return permisos.configurarAprobadores === true;
  return true;
};

/** Informe que quedó abierto, si sigue siendo válido: se reabre al volver a Soporte. */
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
 * que sube ServiceMET, con el diseño de sus plantillas Excel, y los próximos
 * servicios que sugieren los técnicos con su seguimiento y avisos. Al volver
 * de un informe, la lista conserva filtros, página, agrupación y grupos
 * abiertos, y se vuelve a la pestaña de la que se salió.
 *
 * Direcciones: /soporte/<pestaña> y, con un informe abierto,
 * /soporte/<pestaña>/<tipo>/<código> (la pestaña es desde la que se abrió).
 */
export function SoportePage() {
  const { pestana: pestanaRuta, detalle, enRuta, irADetalle } = usePestanaRuta('soporte', PESTANAS, {
    clave: PESTANA,
    predeterminada: 'informes',
    detalleGuardado: () => {
      const guardado = leerAbierto();
      return guardado ? [guardado.tipo, guardado.codigo] : [];
    },
  });
  const { data: permisos } = useResource(soporteApi.permisos);
  const consulta = permisos?.consulta === true;
  const habilitada = pestanaHabilitada(pestanaRuta, permisos);
  const pestana = habilitada === false ? 'informes' : habilitada === null ? null : pestanaRuta;
  const [tipoAbierto, codigoAbierto] = detalle;
  const abierto = detalle.length === 2 && PLANTILLAS[tipoAbierto] ? { tipo: tipoAbierto, codigo: codigoAbierto } : null;

  // Lo guardado sigue a la dirección, también al volver con el botón Atrás.
  useEffect(() => {
    if (!enRuta) return;
    if (tipoAbierto && codigoAbierto && PLANTILLAS[tipoAbierto]) {
      safeStorage.setItem(ABIERTO, JSON.stringify({ tipo: tipoAbierto, codigo: codigoAbierto }));
    } else {
      safeStorage.removeItem(ABIERTO);
    }
  }, [codigoAbierto, enRuta, tipoAbierto]);
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

  const volverArriba = () => window.scrollTo({ top: 0 });
  const abrir = (informe) => irADetalle([informe.tipo, informe.codigo], { alCambiar: volverArriba });
  const cerrar = () => irADetalle([], { alCambiar: volverArriba });

  const ancho = abierto ? 'max-w-[1680px]' : pestana === 'informes' ? 'max-w-[1320px]' : 'max-w-[1600px]';

  return (
    <main className={`mx-auto flex w-full flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 ${ancho}`}>
      <div className="vt-panel flex flex-col gap-4">
      {!abierto && pestana === 'configuracion' && <AprobadoresPanel />}
      {abierto && (
        <InformeEditor key={`${abierto.tipo}:${abierto.codigo}`} tipo={abierto.tipo} codigo={abierto.codigo} onVolver={cerrar} />
      )}
      {/* Se ocultan (sin desmontarse) mientras hay un informe abierto: al volver conservan año, filtros y vista. */}
      {pestana === 'proximos' && <div hidden={Boolean(abierto)}><ProximosPanel onAbrirInforme={abrir} /></div>}
      {pestana === 'avisos' && <div hidden={Boolean(abierto)}><AvisosPanel onAbrirInforme={abrir} /></div>}
      {pestana === 'tiempos' && (
        <div hidden={Boolean(abierto)}>
          <TiemposPanel
            area="soporte"
            cargar={soporteApi.tiempos}
            // Quien solo consulta ve únicamente los informes emitidos: no se le ofrece abrir cada servicio.
            onAbrir={consulta ? undefined : servicio => abrir({ tipo: servicio.grupo, codigo: servicio.codigo })}
          />
        </div>
      )}
      {!abierto && pestana === 'informes' && (
        <InformesLista
          consulta={consulta}
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
      </div>
    </main>
  );
}
