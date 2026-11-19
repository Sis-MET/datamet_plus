import { useCallback, useId, useState } from 'react';
import { FilePlus2, Receipt, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { EmptyState, FieldLabel } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import {
  AREAS, AREAS_CORTAS, ESTADOS_FACTURA, ESTADOS_ORDEN, PAGE_SIZE, TIPOS, bs, bsCorto, fecha, filtrosAParams, filtrosVacios, hayFiltros,
} from '../domain/comercial';
import { Busqueda, Cargando, Cifras, ErrorCarga, EstadoFactura, FilaAbrible, Mora, Paginacion } from './comunes';
import { FacturaModal } from './FacturaModal';
import { NuevaFacturaModal } from './NuevaFacturaModal';

const CONTROL = 'flex h-9 items-center rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors';

function Areas({ areas }) {
  return (
    <span className="flex flex-wrap gap-1">
      {areas.map(area => (
        <span key={area} title={AREAS[area]} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-fg-muted">
          {AREAS_CORTAS[area]}
        </span>
      ))}
    </span>
  );
}

function Numero({ factura }) {
  return (
    <span className="flex flex-col">
      <span className="font-mono text-[13.5px] font-semibold text-fg">N.º {factura.numero}</span>
      <span className="text-[11.5px] text-fg-subtle">{fecha(factura.fechaEmision)}</span>
    </span>
  );
}

function PanelFiltros({ id, filtros, onChange }) {
  const baseId = useId();
  return (
    <section id={id} aria-label="Filtros de facturas" className="card grid gap-x-4 gap-y-3 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
      <div className="min-w-0">
        <FieldLabel htmlFor={`${baseId}-area`}>Área</FieldLabel>
        <Dropdown
          id={`${baseId}-area`}
          ariaLabel="Área"
          value={filtros.area}
          onChange={(area) => onChange({ area })}
          options={[{ value: '', label: 'Todas las áreas' }, ...Object.entries(AREAS).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      <div className="min-w-0">
        <FieldLabel htmlFor={`${baseId}-tipo`}>Tipo</FieldLabel>
        <Dropdown
          id={`${baseId}-tipo`}
          ariaLabel="Tipo de factura"
          value={filtros.tipo}
          onChange={(tipo) => onChange({ tipo })}
          options={[{ value: '', label: 'Servicio y venta' }, ...Object.entries(TIPOS).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      <div className="min-w-0">
        <FieldLabel htmlFor={`${baseId}-desde`}>Emitida desde</FieldLabel>
        <input id={`${baseId}-desde`} type="date" value={filtros.desde} max={filtros.hasta || undefined}
          onChange={(event) => onChange({ desde: event.target.value })} className="field h-11 font-medium tabular-nums" />
      </div>
      <div className="min-w-0">
        <FieldLabel htmlFor={`${baseId}-hasta`}>Emitida hasta</FieldLabel>
        <input id={`${baseId}-hasta`} type="date" value={filtros.hasta} min={filtros.desde || undefined}
          onChange={(event) => onChange({ hasta: event.target.value })} className="field h-11 font-medium tabular-nums" />
      </div>
    </section>
  );
}

/**
 * Facturas: búsqueda por número, cliente, NIT, cotización o responsable;
 * chips de estado con su conteo; cifras del filtro; ficha de cada factura y
 * alta de una nueva (solo el área Comercial).
 */
export function FacturasPanel({ soloConsulta }) {
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [page, setPage] = useState(1);
  const [abierta, setAbierta] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [panel, setPanel] = useState(false);
  const [reinicio, setReinicio] = useState(0);
  const panelId = useId();

  const load = useCallback(() => comercialApi.facturas(filtrosAParams(filtros, page)), [filtros, page]);
  const { data, error, loading, reload } = useResource(load);
  const cambiar = useCallback((cambios) => {
    setFiltros(current => ({ ...current, ...cambios }));
    setPage(1);
  }, []);
  const buscar = useCallback((q) => cambiar({ q }), [cambiar]);
  const avanzados = ['area', 'tipo', 'desde', 'hasta'].filter(key => filtros[key]).length;
  const resumen = data?.resumen;
  const items = data?.items || [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Facturas</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Busqueda key={reinicio} value={filtros.q} onChange={buscar} label="Buscar facturas" placeholder="Número, cliente, NIT, cotización, responsable…" />
        <button
          type="button"
          onClick={() => setPanel(value => !value)}
          aria-expanded={panel}
          aria-controls={panelId}
          className={cn(CONTROL, 'gap-2 px-3 text-[13px] font-semibold hover:bg-surface-2', panel && 'bg-surface-2')}
        >
          <SlidersHorizontal className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          Filtros
          {avanzados > 0 && <span className="cal-count">{avanzados}</span>}
        </button>
        {!soloConsulta && (
          <Button size="sm" className="ml-auto h-9" onClick={() => setNueva(true)}>
            <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Nueva factura
          </Button>
        )}
      </div>

      {panel && <PanelFiltros id={panelId} filtros={filtros} onChange={cambiar} />}

      <div className="flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
          {ESTADOS_ORDEN.map(estado => (
            <button
              key={estado}
              type="button"
              aria-pressed={filtros.estado === estado}
              onClick={() => cambiar({ estado: filtros.estado === estado ? '' : estado })}
              disabled={!resumen?.estados?.[estado] && filtros.estado !== estado}
              className={cn('cal-filter-chip', `cal-tone-${ESTADOS_FACTURA[estado].tone}`)}
            >
              <span className="cal-dot" aria-hidden="true" />
              {ESTADOS_FACTURA[estado].label}
              <strong>{resumen?.estados?.[estado] ?? 0}</strong>
            </button>
          ))}
        </div>
        {hayFiltros(filtros) && (
          <button
            type="button"
            onClick={() => { setReinicio(value => value + 1); cambiar(filtrosVacios()); }}
            className="ml-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {resumen && (
        <Cifras items={[
          { label: 'Facturado', value: bsCorto(resumen.facturado), hint: hayFiltros(filtros) ? 'Con los filtros, sin anuladas' : 'Sin anuladas' },
          { label: 'Cobrado', value: bsCorto(resumen.cobrado) },
          { label: 'Por cobrar', value: bsCorto(resumen.saldo), tone: resumen.saldo > 0 ? 'warning' : undefined },
          { label: 'Facturas', value: String((resumen.estados.pendiente || 0) + (resumen.estados.parcial || 0) + (resumen.estados.pagada || 0)), hint: `${resumen.estados.anulada || 0} anuladas` },
        ]} />
      )}

      {error && <ErrorCarga titulo="No se pudieron cargar las facturas." error={error} onRetry={reload} />}
      {!data && !error && <Cargando label="Cargando facturas" />}

      {data && items.length === 0 && (
        <EmptyState icon={Receipt} title={hayFiltros(filtros) ? 'Ninguna factura coincide con los filtros' : 'Todavía no hay facturas registradas'}>
          {hayFiltros(filtros)
            ? 'Cambie o limpie los filtros para ver otras facturas.'
            : 'Las facturas aparecen aquí al registrarlas o al importar el Excel de facturación.'}
        </EmptyState>
      )}

      {items.length > 0 && (
        <div className={cn('card overflow-hidden shadow-card transition-opacity', loading && 'opacity-60')}>
          <table className="hidden w-full text-left md:table">
            <caption className="sr-only">Facturas, de la más reciente a la más antigua</caption>
            <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Factura</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Cliente</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Áreas</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Cotización y responsable</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Monto</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Saldo</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="stagger-in divide-y divide-line">
              {items.map(factura => (
                <FilaAbrible key={factura.id} onOpen={() => setAbierta(factura.id)}>
                  <td className="px-4 py-3"><Numero factura={factura} /></td>
                  <td className="max-w-[300px] px-3 py-3 text-[13px]">
                    <span className="block truncate font-medium text-fg">{factura.razonSocial}</span>
                    <span className="block text-fg-muted">{[factura.clienteCodigo, factura.nit && `NIT ${factura.nit}`].filter(Boolean).join(' · ') || 'Sin cliente de DataMET'}</span>
                  </td>
                  <td className="px-3 py-3"><Areas areas={factura.areas} /></td>
                  <td className="max-w-[240px] px-3 py-3 text-[13px] text-fg-muted">
                    <span className="block truncate font-mono text-[12.5px] text-fg">{factura.cotizaciones[0] || '—'}{factura.cotizaciones.length > 1 ? ` +${factura.cotizaciones.length - 1}` : ''}</span>
                    <span className="block truncate">{factura.responsables.join(' · ') || '—'}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-fg">{bs(factura.monto)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] tabular-nums text-fg-muted">
                    {factura.estado === 'anulada' ? '—' : bs(factura.saldo)}
                    {factura.saldo > 0 && <span className="mt-1 flex justify-end"><Mora dias={factura.diasMora} tramo={factura.tramo} /></span>}
                  </td>
                  <td className="px-4 py-3 text-right"><EstadoFactura estado={factura.estado} /></td>
                </FilaAbrible>
              ))}
            </tbody>
          </table>
          <ul className="stagger-in divide-y divide-line md:hidden">
            {items.map(factura => (
              <li key={factura.id}>
                <button type="button" onClick={() => setAbierta(factura.id)} className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left hover:bg-fg/[0.025]">
                  <span className="flex items-start justify-between gap-3">
                    <Numero factura={factura} />
                    <EstadoFactura estado={factura.estado} />
                  </span>
                  <span className="text-[13px] font-medium text-fg">{factura.razonSocial}</span>
                  <span className="flex items-center justify-between gap-3 text-[12.5px] text-fg-muted">
                    <span>{factura.cotizaciones[0] || 'Sin cotización'}</span>
                    <span className="font-semibold tabular-nums text-fg">{bs(factura.monto)}</span>
                  </span>
                  {factura.saldo > 0 && (
                    <span className="flex items-center justify-between gap-3 text-[12.5px] text-fg-muted">
                      <span>Saldo {bs(factura.saldo)}</span>
                      <Mora dias={factura.diasMora} tramo={factura.tramo} />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && <Paginacion total={data.total} page={page} pageSize={data.pageSize || PAGE_SIZE} loading={loading} onPage={setPage} unidad="facturas" />}

      {abierta && (
        <FacturaModal id={abierta} soloConsulta={soloConsulta} onClose={() => setAbierta(null)} onChanged={reload} />
      )}
      {nueva && (
        <NuevaFacturaModal
          onClose={() => setNueva(false)}
          onCreated={(factura) => { reload(); setAbierta(factura.id); }}
        />
      )}
    </div>
  );
}
