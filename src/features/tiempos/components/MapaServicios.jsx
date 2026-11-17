import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, MapPin, Maximize2, Navigation, X } from 'lucide-react';
import { usePageScrollLock } from '../../../shared/hooks/usePageScrollLock';
import { cn } from '../../../shared/utils/cn';
import { Segmented } from '../../calibration/components/primitives';
import { formatoHoras } from '../domain/tiempos';
import { SIN_DEPARTAMENTO } from '../domain/ubicacion';
import { MapaInteractivo } from './MapaInteractivo';

const METRICAS = {
  servicios: { label: 'Servicios', valor: fila => fila.servicios, corto: v => String(v) },
  horas: { label: 'Horas', valor: fila => fila.minutos, corto: v => formatoHoras(v) },
};
const OPCIONES_METRICA = Object.entries(METRICAS).map(([value, def]) => ({ value, label: def.label }));

const intensidad = (valor, maximo) => (maximo > 0 && valor > 0 ? Math.sqrt(valor / maximo) : 0);
const muestra = nivel => (nivel > 0 ? `rgb(var(--c-accent) / ${(0.15 + 0.7 * nivel).toFixed(3)})` : 'rgb(var(--c-fg) / 0.08)');

/** Resumen de la ubicación GPS: cuántos servicios la traen. */
function ResumenGps({ conGps, total, compacto }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface-2/50', compacto ? 'px-2.5 py-2' : 'p-3')}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">
          <Navigation className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" /> Con ubicación GPS
        </p>
        <p className="text-[12px] tabular-nums text-fg-muted"><span className="font-semibold text-fg">{conGps}</span> de {total}</p>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-fg/[0.07]">
        <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${total ? (conGps / total) * 100 : 0}%` }} />
      </div>
      {!compacto && (
        <p className="mt-2 text-[11.5px] leading-snug text-fg-muted">
          {conGps === 0
            ? 'Aún no llegan coordenadas en este período: ServiceMET las envía desde la versión 6.3.5. Mientras tanto, cada servicio cuenta por su planta.'
            : `${total - conGps} ${total - conGps === 1 ? 'servicio cuenta' : 'servicios cuentan'} por el departamento de la planta.`}
        </p>
      )}
    </div>
  );
}

/** Departamentos ordenados por la métrica; pulsar uno filtra el panel. */
function Ranking({ filas, metrica, departamento, onDepartamento, compacto }) {
  const definicion = METRICAS[metrica];
  const reales = filas.filter(f => f.id !== SIN_DEPARTAMENTO);
  const sinDepartamento = filas.find(f => f.id === SIN_DEPARTAMENTO);
  const ordenados = [...reales].sort((a, b) => definicion.valor(b) - definicion.valor(a) || a.nombre.localeCompare(b.nombre, 'es'));
  const conServicios = ordenados.filter(f => f.servicios > 0);
  const sinServicios = ordenados.filter(f => f.servicios === 0);
  const maximo = Math.max(1, ...conServicios.map(definicion.valor));
  const total = filas.reduce((suma, f) => suma + definicion.valor(f), 0);
  const alternar = id => onDepartamento(departamento === id ? '' : id);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ul className="flex flex-col gap-0.5" aria-label="Departamentos">
        {conServicios.map((fila) => {
          const valor = definicion.valor(fila);
          const elegido = departamento === fila.id;
          return (
            <li key={fila.id}>
              <button
                type="button"
                onClick={() => alternar(fila.id)}
                aria-pressed={elegido}
                className={cn(
                  'w-full rounded-xl px-2.5 text-left transition-colors hover:bg-fg/[0.04]',
                  compacto ? 'py-1.5' : 'py-2',
                  elegido && 'bg-accent/[0.08] ring-1 ring-accent/30',
                  departamento && !elegido && 'opacity-55'
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: muestra(intensidad(valor, maximo)) }} aria-hidden="true" />
                    <span className="truncate text-[12.5px] font-semibold text-fg">{fila.nombre}</span>
                  </span>
                  <span className="flex-none text-[12.5px] font-semibold tabular-nums text-fg">
                    {definicion.corto(valor)}
                    <span className="ml-1.5 text-[11px] font-normal text-fg-muted">{total ? Math.round((valor / total) * 100) : 0} %</span>
                  </span>
                </span>
                <span className="mt-1 block h-1 rounded-full bg-fg/[0.06]">
                  <span className="tiempos-escala block h-full w-full rounded-full bg-accent" style={{ transform: `scaleX(${valor / maximo})` }} />
                </span>
                {!compacto && (
                  <span className="mt-1 block text-[11.5px] text-fg-muted">
                    {metrica === 'servicios' ? formatoHoras(fila.minutos) : `${fila.servicios} servicios`} · {fila.tecnicos} {fila.tecnicos === 1 ? 'técnico' : 'técnicos'}
                    {fila.conUbicacion > 0 && <> · <span className="text-success">{fila.conUbicacion} con GPS</span></>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {(sinServicios.length > 0 || sinDepartamento) && (
        <p className="flex items-start gap-1.5 px-2.5 pt-1 text-[11px] leading-snug text-fg-muted">
          <Info className="mt-px h-3 w-3 flex-none" aria-hidden="true" />
          <span>
            {sinServicios.length > 0 && <>Sin servicios en {sinServicios.map(f => f.nombre).join(', ')}. </>}
            {sinDepartamento && (
              <button type="button" onClick={() => alternar(SIN_DEPARTAMENTO)} className={cn('underline decoration-fg/30 underline-offset-2 hover:text-fg', departamento === SIN_DEPARTAMENTO && 'font-semibold text-fg')}>
                {sinDepartamento.servicios} sin departamento
              </button>
            )}
          </span>
        </p>
      )}
    </div>
  );
}

function Leyenda({ metrica, maximo }) {
  const definicion = METRICAS[metrica];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
      <span className="flex items-center gap-2">
        {definicion.label} por departamento
        <span className="h-2 w-20 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(var(--c-accent) / 0.15), rgb(var(--c-accent) / 0.85))' }} aria-hidden="true" />
        <span className="tabular-nums">0 – {definicion.corto(maximo)}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-fg-muted shadow-xs" aria-hidden="true" />
        Lugar con GPS, del color del tipo de servicio
      </span>
    </div>
  );
}

/** El mapa en grande: casi toda la pantalla, con la rueda libre para acercar. */
function MapaAmpliado({ onCerrar, metrica, onMetrica, maximo, conGps, total, ...props }) {
  usePageScrollLock(true);
  useEffect(() => {
    const alPulsar = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  return createPortal(
    <div
      className="task-dialog-backdrop scrim fixed inset-0 z-[70] p-2 sm:p-5"
      role="presentation"
      onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onCerrar(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Mapa de servicios ampliado"
        className="task-dialog-panel flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-dialog"
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
              <MapPin className="h-4 w-4 text-fg-muted" aria-hidden="true" /> Servicios por departamento
            </h2>
            <div className="mt-1"><Leyenda metrica={metrica} maximo={maximo} /></div>
          </div>
          <Segmented label="Qué pintar en el mapa" value={metrica} onChange={onMetrica} options={OPCIONES_METRICA} className="cal-tabs" />
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
            aria-label="Cerrar el mapa ampliado"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <MapaInteractivo {...props} metrica={metrica} ruedaLibre className="min-h-[320px]" />
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <ResumenGps conGps={conGps} total={total} />
            <Ranking filas={props.filas} metrica={metrica} departamento={props.departamento} onDepartamento={props.onDepartamento} />
          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
}

/**
 * Mapa de los servicios del período, compacto: es información
 * complementaria. «Ampliar» lo abre casi a pantalla completa. Cada lugar con
 * GPS de ServiceMET es un punto; sin GPS, el servicio cuenta por el
 * departamento de su planta. Pulsar un departamento filtra todo el panel.
 */
export const MapaServicios = memo(function MapaServicios({
  filas, servicios, departamento, onDepartamento, colores, nombreGrupo, orden,
}) {
  const [metrica, setMetrica] = useState('servicios');
  const [ampliado, setAmpliado] = useState(false);
  const definicion = METRICAS[metrica];
  const maximo = Math.max(0, ...filas.filter(f => f.id !== SIN_DEPARTAMENTO).map(definicion.valor));
  const total = filas.reduce((suma, f) => suma + f.servicios, 0);
  const conGps = filas.reduce((suma, f) => suma + f.conUbicacion, 0);
  const propsMapa = { filas, servicios, departamento, onDepartamento, colores, nombreGrupo, orden };

  return (
    <section className="card flex min-w-0 flex-col shadow-card" aria-label="Mapa de servicios">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[14.5px] font-semibold text-fg">
            <MapPin className="h-4 w-4 text-fg-muted" aria-hidden="true" />
            Servicios por departamento
          </h3>
          <p className="mt-0.5 text-[12px] text-fg-muted">Pulse un departamento para filtrar. <kbd className="kbd">Ctrl</kbd> + rueda acerca el mapa.</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented label="Qué pintar en el mapa" value={metrica} onChange={setMetrica} options={OPCIONES_METRICA} className="cal-tabs" />
          <button
            type="button"
            onClick={() => setAmpliado(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Ampliar
          </button>
        </div>
      </header>

      <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex min-w-0 flex-col gap-2">
          <MapaInteractivo {...propsMapa} metrica={metrica} className="h-[280px] sm:h-[300px]" />
          <Leyenda metrica={metrica} maximo={maximo} />
        </div>
        <div className="flex max-h-[330px] min-w-0 flex-col gap-2 overflow-y-auto">
          <ResumenGps conGps={conGps} total={total} compacto />
          <Ranking filas={filas} metrica={metrica} departamento={departamento} onDepartamento={onDepartamento} compacto />
        </div>
      </div>

      {ampliado && (
        <MapaAmpliado
          {...propsMapa}
          metrica={metrica}
          onMetrica={setMetrica}
          maximo={maximo}
          conGps={conGps}
          total={total}
          onCerrar={() => setAmpliado(false)}
        />
      )}
    </section>
  );
});
