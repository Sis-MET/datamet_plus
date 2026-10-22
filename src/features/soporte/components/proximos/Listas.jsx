import { useMemo, useState } from 'react';
import { BellRing, CalendarCheck2, CheckCircle2 } from 'lucide-react';
import { capitalize, formatDate } from '../../../calibration/domain/format';
import { EmptyState, Segmented } from '../../../calibration/components/primitives';
import { agruparPorCliente } from '../../domain/proximos';
import { FilaGrupo } from './piezas';

const VISIBLES = 4;

/**
 * Próximos servicios vencidos, dentro del aviso o coordinados que se
 * acercan, de cualquier año, agrupados por cliente y planta (los equipos de
 * una misma visita). Es lo primero que ve el área al entrar.
 */
export function AtencionPanel({ alertas, onSelect, expandido = false }) {
  const [abierto, setAbierto] = useState(expandido);
  const grupos = useMemo(() => agruparPorCliente(alertas), [alertas]);

  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-xs">
        <CheckCircle2 className="h-[18px] w-[18px] flex-none text-success" aria-hidden="true" />
        <p className="text-[13px] text-fg">
          <span className="font-semibold">Todo al día.</span>{' '}
          <span className="text-fg-muted">No hay próximos servicios vencidos ni por llegar.</span>
        </p>
      </div>
    );
  }

  const vencidos = alertas.filter(alerta => alerta.situacion === 'VENCIDO').length;
  const coordinados = alertas.filter(alerta => alerta.situacion === 'COORDINADO').length;
  const enAviso = alertas.length - vencidos - coordinados;
  const visibles = abierto ? grupos : grupos.slice(0, VISIBLES);
  const enGrupos = grupos.length < alertas.length;

  return (
    <section aria-labelledby="st-atencion-titulo" className="card overflow-hidden shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <BellRing className="h-[18px] w-[18px] flex-none text-warning" aria-hidden="true" />
        <h2 id="st-atencion-titulo" className="text-sm font-semibold text-fg">Requieren atención</h2>
        <p className="text-[13px] text-fg-muted">
          {enGrupos && (
            <span className="font-medium text-fg">
              {alertas.length} equipos de {grupos.length} {grupos.length === 1 ? 'cliente' : 'clientes'}:{' '}
            </span>
          )}
          {[
            vencidos > 0 && `${vencidos} ${vencidos === 1 ? 'vencido' : 'vencidos'}`,
            enAviso > 0 && `${enAviso} en periodo de aviso`,
            coordinados > 0 && `${coordinados} ${coordinados === 1 ? 'visita coordinada' : 'visitas coordinadas'}`,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
      <ul className="divide-y divide-line">
        {visibles.map(grupo => (
          <li key={grupo.id}>
            <FilaGrupo grupo={grupo} onSelect={onSelect} />
          </li>
        ))}
      </ul>
      {!expandido && grupos.length > VISIBLES && (
        <button
          type="button"
          onClick={() => setAbierto(value => !value)}
          className="w-full border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-fg-muted transition-colors hover:bg-fg/[0.025] hover:text-fg"
          aria-expanded={abierto}
        >
          {abierto ? 'Mostrar menos' : `Ver todo (${grupos.length} ${grupos.length === 1 ? 'cliente' : 'clientes'}, ${alertas.length} equipos)`}
        </button>
      )}
    </section>
  );
}

/**
 * Agenda: los próximos servicios del año por mes y, si se pide, los servicios
 * realizados, con los equipos de un mismo cliente juntos.
 */
export function Agenda({ eventos, onSelect }) {
  const [alcance, setAlcance] = useState('PROXIMOS');

  const meses = useMemo(() => {
    const visibles = alcance === 'PROXIMOS' ? eventos.filter(evento => evento.clase === 'PROXIMO') : eventos;
    const mapa = new Map();
    for (const evento of visibles) {
      const clave = evento.fecha.slice(0, 7);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(evento);
    }
    return [...mapa.entries()].map(([mes, items]) => [mes, items, agruparPorCliente(items)]);
  }, [eventos, alcance]);

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Fechas a mostrar"
        value={alcance}
        onChange={setAlcance}
        options={[
          { value: 'PROXIMOS', label: 'Próximos servicios' },
          { value: 'TODO', label: 'También los realizados' },
        ]}
        className="self-start"
      />

      {meses.length === 0 ? (
        <EmptyState icon={CalendarCheck2} title={alcance === 'PROXIMOS' ? 'No hay próximos servicios en este año' : 'No hay servicios en este año'}>
          Cambie el año o los filtros para ver otras fechas.
        </EmptyState>
      ) : (
        meses.map(([mes, items, grupos]) => (
          <section key={mes} aria-labelledby={`st-agenda-${mes}`}>
            <h3 id={`st-agenda-${mes}`} className="mb-2 flex items-baseline gap-2 px-1">
              <span className="text-[13px] font-semibold text-fg">{capitalize(formatDate(`${mes}-01`, 'MMMM yyyy'))}</span>
              <span className="text-xs text-fg-muted">
                {items.length} {items.length === 1 ? 'equipo' : 'equipos'}
                {grupos.length < items.length && ` de ${grupos.length} ${grupos.length === 1 ? 'cliente' : 'clientes'}`}
              </span>
            </h3>
            <ul className="card divide-y divide-line overflow-hidden shadow-xs">
              {grupos.map(grupo => (
                <li key={grupo.id}>
                  <FilaGrupo grupo={grupo} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
