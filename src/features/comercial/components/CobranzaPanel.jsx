import { useCallback, useMemo, useState } from 'react';
import { HandCoins, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { EmptyState, Segmented } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { TRAMO_TONO, bs, bsCorto, fecha } from '../domain/comercial';
import { ClienteModal } from './ClienteModal';
import { Busqueda, Cargando, ErrorCarga, FilaAbrible, Mora } from './comunes';
import { FacturaModal } from './FacturaModal';
import { PagoModal } from './PagoModal';

const TONO_BORDE = {
  success: 'border-l-success', info: 'border-l-info', warning: 'border-l-warning', danger: 'border-l-danger',
};

function Tramos({ tramos, total, value, onChange }) {
  return (
    <div role="group" aria-label="Filtrar por días de mora" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {tramos.map(tramo => {
        const activo = value === tramo.id;
        return (
          <button
            key={tramo.id}
            type="button"
            aria-pressed={activo}
            disabled={!tramo.facturas && !activo}
            onClick={() => onChange(activo ? '' : tramo.id)}
            className={cn('card flex flex-col gap-0.5 border-l-4 px-4 py-3 text-left shadow-card transition-colors hover:bg-surface-2 disabled:opacity-50',
              TONO_BORDE[TRAMO_TONO[tramo.id]], activo && 'ring-2 ring-focus/40')}
          >
            <span className="text-[12px] font-medium text-fg-muted">{tramo.label}</span>
            <span className="text-[18px] font-semibold tabular-nums text-fg">{bsCorto(tramo.saldo)}</span>
            <span className="text-[11.5px] text-fg-subtle">
              {tramo.facturas} {tramo.facturas === 1 ? 'factura' : 'facturas'}{total ? ` · ${Math.round((tramo.saldo / total) * 100)} %` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Cuentas por cobrar a hoy: saldo por días de mora (desde el vencimiento:
 * emisión más el plazo del cliente), por factura o por cliente, y lo cobrado
 * sin aplicar (anticipos).
 */
export function CobranzaPanel({ soloConsulta }) {
  const [q, setQ] = useState('');
  const [tramo, setTramo] = useState('');
  const [vista, setVista] = useState('facturas');
  const [abierta, setAbierta] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [pagando, setPagando] = useState(null);

  const load = useCallback(() => comercialApi.cobranza(q ? { q } : {}), [q]);
  const { data, error, loading, reload } = useResource(load);
  const buscar = useCallback((texto) => setQ(texto), []);

  const facturas = useMemo(() => (data?.facturas || []).filter(f => !tramo || f.tramo === tramo), [data, tramo]);
  const clientes = useMemo(() => {
    if (!data) return [];
    if (!tramo) return data.resumen.clientes;
    const mapa = new Map();
    for (const f of facturas) {
      const clave = f.clienteCodigo || `rs:${f.razonSocial}`;
      const c = mapa.get(clave) || { clienteCodigo: f.clienteCodigo, razonSocial: f.razonSocial, facturas: 0, saldo: 0, diasMoraMax: 0 };
      c.facturas += 1;
      c.saldo = (Math.round(c.saldo * 100) + Math.round(f.saldo * 100)) / 100;
      c.diasMoraMax = Math.max(c.diasMoraMax, f.diasMora);
      mapa.set(clave, c);
    }
    return [...mapa.values()].sort((a, b) => b.saldo - a.saldo);
  }, [data, facturas, tramo]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Cuentas por cobrar</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Busqueda value={q} onChange={buscar} label="Buscar en cuentas por cobrar" placeholder="Cliente o número de factura…" />
        <Segmented
          label="Ver por"
          value={vista}
          onChange={setVista}
          options={[{ value: 'facturas', label: 'Por factura' }, { value: 'clientes', label: 'Por cliente' }]}
        />
        {data && (
          <p className="ml-auto text-[13px] text-fg-muted">
            Por cobrar <strong className="tabular-nums text-fg">{bs(data.resumen.total)}</strong> en {data.resumen.facturas} {data.resumen.facturas === 1 ? 'factura' : 'facturas'}
            {data.anticipos.saldo > 0 && <> · <span className="text-info">{bs(data.anticipos.saldo)} cobrados sin aplicar</span></>}
          </p>
        )}
      </div>

      {error && <ErrorCarga titulo="No se pudieron cargar las cuentas por cobrar." error={error} onRetry={reload} />}
      {!data && !error && <Cargando label="Cargando cuentas por cobrar" />}

      {data && <Tramos tramos={data.resumen.tramos} total={data.resumen.total} value={tramo} onChange={setTramo} />}

      {data && facturas.length === 0 && (
        <EmptyState icon={Wallet} title={q || tramo ? 'Nada por cobrar con estos filtros' : 'No hay facturas por cobrar'}>
          {q || tramo ? 'Cambie la búsqueda o el tramo.' : 'Todas las facturas vigentes están pagadas.'}
        </EmptyState>
      )}

      {data && facturas.length > 0 && vista === 'facturas' && (
        <div className={cn('card overflow-hidden shadow-card transition-opacity', loading && 'opacity-60')}>
          <table className="hidden w-full text-left md:table">
            <caption className="sr-only">Facturas por cobrar, de la más atrasada a la más reciente</caption>
            <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Factura</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Cliente</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Responsable</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Vence</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Saldo</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Mora</th>
                {!soloConsulta && <th scope="col" className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {facturas.map(f => (
                <FilaAbrible key={f.id} onOpen={() => setAbierta(f.id)}>
                  <td className="px-4 py-3">
                    <span className="block font-mono text-[13.5px] font-semibold text-fg">N.º {f.numero}</span>
                    <span className="block text-[11.5px] text-fg-subtle">{fecha(f.fechaEmision)}</span>
                  </td>
                  <td className="max-w-[300px] px-3 py-3 text-[13px]">
                    <span className="block truncate font-medium text-fg">{f.razonSocial}</span>
                    <span className="block text-fg-muted">{f.estado === 'parcial' ? `Pagó ${bs(f.pagado)} de ${bs(f.monto)}` : bs(f.monto)}</span>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-3 text-[13px] text-fg-muted">{f.responsables.join(' · ') || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[13px] text-fg-muted">{fecha(f.vence)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-fg">{bs(f.saldo)}</td>
                  <td className="px-3 py-3 text-right"><Mora dias={f.diasMora} tramo={f.tramo} /></td>
                  {!soloConsulta && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setPagando(f); }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[12.5px] font-semibold text-fg hover:bg-surface-2"
                      >
                        <HandCoins className="h-3.5 w-3.5" aria-hidden="true" /> Pago
                      </button>
                    </td>
                  )}
                </FilaAbrible>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {facturas.map(f => (
              <li key={f.id}>
                <button type="button" onClick={() => setAbierta(f.id)} className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-fg/[0.025]">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[13.5px] font-semibold text-fg">N.º {f.numero}</span>
                    <Mora dias={f.diasMora} tramo={f.tramo} />
                  </span>
                  <span className="text-[13px] font-medium text-fg">{f.razonSocial}</span>
                  <span className="flex justify-between text-[12.5px] text-fg-muted">
                    <span>Vence {fecha(f.vence)}</span>
                    <span className="font-semibold tabular-nums text-fg">{bs(f.saldo)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && facturas.length > 0 && vista === 'clientes' && (
        <div className="card overflow-hidden shadow-card">
          <ul className="divide-y divide-line">
            {clientes.map(c => (
              <li key={c.clienteCodigo || c.razonSocial}>
                <button
                  type="button"
                  disabled={!c.clienteCodigo}
                  onClick={() => setCliente(c.clienteCodigo)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-fg/[0.025] disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{c.razonSocial}</span>
                    <span className="block text-[12px] text-fg-muted">
                      {c.clienteCodigo ? `Código ${c.clienteCodigo}` : 'Sin cliente de DataMET'} · {c.facturas} {c.facturas === 1 ? 'factura' : 'facturas'}
                    </span>
                  </span>
                  <Mora dias={c.diasMoraMax} tramo={c.diasMoraMax > 90 ? 'mas90' : c.diasMoraMax > 60 ? 'd90' : c.diasMoraMax > 30 ? 'd60' : c.diasMoraMax > 0 ? 'd30' : 'al_dia'} />
                  <span className="w-32 text-right text-[13.5px] font-semibold tabular-nums text-fg">{bs(c.saldo)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {abierta && <FacturaModal id={abierta} soloConsulta={soloConsulta} onClose={() => setAbierta(null)} onChanged={reload} />}
      {cliente && <ClienteModal codigo={cliente} soloConsulta={soloConsulta} onClose={() => setCliente(null)} onChanged={reload} onOpenFactura={(id) => { setCliente(null); setAbierta(id); }} />}
      {pagando && (
        <PagoModal
          facturasIniciales={[pagando]}
          onClose={() => setPagando(null)}
          onCreated={() => { toast.success('Pago registrado.'); reload(); }}
        />
      )}
    </div>
  );
}
