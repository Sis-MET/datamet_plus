import { useCallback, useMemo, useState } from 'react';
import { HandCoins, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { EmptyState, Segmented } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { TRAMO_COLOR, bs, bsCorto, fecha, porcentaje } from '../domain/comercial';
import { ClienteModal } from './ClienteModal';
import { Busqueda, Cargando, ErrorCarga, FilaAbrible, Mora } from './comunes';
import { FacturaModal } from './FacturaModal';
import { PagoModal } from './PagoModal';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Antigüedad del saldo: el total por cobrar, una barra fina que lo reparte
 * por días de mora (de gris a ámbar y a rojo, según el atraso) y debajo los
 * tramos, que filtran la lista. Sin tarjetas con bordes de color: el color
 * va solo en la barra y en la muestra de cada tramo.
 */
function Antiguedad({ resumen, anticipos, hoy, value, onChange }) {
  const { total, tramos } = resumen;
  const conSaldo = tramos.filter(tramo => tramo.saldo > 0);
  const descripcion = conSaldo.map(tramo => `${tramo.label}: ${bs(tramo.saldo)} (${porcentaje(tramo.saldo, total)})`).join('; ');

  return (
    <section aria-label="Antigüedad del saldo por cobrar" className="card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-fg-muted">Por cobrar al {fecha(hoy)}</p>
          <p className="mt-0.5 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-fg">{bs(total)}</p>
          <p className="mt-0.5 text-[12.5px] text-fg-muted">
            {plural(resumen.facturas, 'factura', 'facturas')} de {plural(resumen.clientes.length, 'cliente', 'clientes')}
          </p>
        </div>
        {anticipos.saldo > 0 && (
          <p className="text-[12.5px] text-fg-muted">
            <span className="font-semibold text-fg">{bs(anticipos.saldo)}</span> cobrados sin aplicar
          </p>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex h-2 gap-[2px]" role="img" aria-label={`Saldo por días de mora: ${descripcion}`}>
          {conSaldo.map(tramo => (
            <span
              key={tramo.id}
              title={`${tramo.label}: ${bs(tramo.saldo)} · ${porcentaje(tramo.saldo, total)}`}
              style={{ flexGrow: tramo.saldo, flexBasis: 0, backgroundColor: TRAMO_COLOR[tramo.id] }}
              className={cn('min-w-[3px] transition-opacity duration-200 first:rounded-l-full last:rounded-r-full',
                value && value !== tramo.id && 'opacity-25')}
            />
          ))}
        </div>
      )}

      <div role="group" aria-label="Filtrar por días de mora" className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
        {tramos.map(tramo => {
          const activo = value === tramo.id;
          return (
            <button
              key={tramo.id}
              type="button"
              aria-pressed={activo}
              disabled={!tramo.facturas && !activo}
              onClick={() => onChange(activo ? '' : tramo.id)}
              className={cn(
                'flex min-w-0 flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-fg/[0.04]',
                'disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent',
                activo && 'bg-surface-2 ring-1 ring-inset ring-line-strong hover:bg-surface-2',
              )}
            >
              <span className="flex items-center gap-2 text-[12px] font-medium text-fg-muted">
                <span className="h-2 w-2 flex-none rounded-[3px]" style={{ backgroundColor: TRAMO_COLOR[tramo.id] }} aria-hidden="true" />
                <span className="truncate">{tramo.label}</span>
              </span>
              <span className="text-[16px] font-semibold text-fg">{bsCorto(tramo.saldo)}</span>
              <span className="text-[11.5px] text-fg-subtle">
                {plural(tramo.facturas, 'factura', 'facturas')}{total ? ` · ${porcentaje(tramo.saldo, total)}` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </section>
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
      </div>

      {error && <ErrorCarga titulo="No se pudieron cargar las cuentas por cobrar." error={error} onRetry={reload} />}
      {!data && !error && <Cargando label="Cargando cuentas por cobrar" />}

      {data && <Antiguedad resumen={data.resumen} anticipos={data.anticipos} hoy={data.hoy} value={tramo} onChange={setTramo} />}

      {data && facturas.length === 0 && (
        <EmptyState icon={Wallet} title={q || tramo ? 'Nada por cobrar con estos filtros' : 'No hay facturas por cobrar'}>
          {q || tramo ? 'Cambie la búsqueda o el tramo.' : 'Todas las facturas vigentes están pagadas.'}
        </EmptyState>
      )}

      {data && facturas.length > 0 && vista === 'facturas' && (
        <div className={cn('card overflow-hidden shadow-card transition-opacity', loading && 'opacity-60')}>
          {/* Ancho fijo por columna: la tabla no se desborda; los textos largos
              se cortan con «…» y las columnas secundarias se ocultan al angostar. */}
          <table className="hidden w-full table-fixed text-left md:table">
            <caption className="sr-only">Facturas por cobrar, de la más atrasada a la más reciente</caption>
            <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="w-[7.5rem] px-4 py-2.5 font-medium">Factura</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Cliente</th>
                <th scope="col" className="hidden w-[11rem] px-3 py-2.5 font-medium xl:table-cell">Responsable</th>
                <th scope="col" className="hidden w-[6.75rem] px-3 py-2.5 font-medium xl:table-cell">Vence</th>
                <th scope="col" className="w-[8.5rem] px-3 py-2.5 text-right font-medium">Saldo</th>
                <th scope="col" className="w-[6.5rem] px-3 py-2.5 text-right font-medium">Mora</th>
                {!soloConsulta && <th scope="col" className="w-[5.75rem] px-4 py-2.5"><span className="sr-only">Acciones</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {facturas.map(f => (
                <FilaAbrible key={f.id} onOpen={() => setAbierta(f.id)}>
                  <td className="px-4 py-3">
                    <span className="block font-mono text-[13.5px] font-semibold text-fg">N.º {f.numero}</span>
                    <span className="block text-[11.5px] text-fg-subtle">{fecha(f.fechaEmision)}</span>
                    <span className="block text-[11.5px] text-fg-subtle xl:hidden">vence {fecha(f.vence)}</span>
                  </td>
                  <td className="px-3 py-3 text-[13px]">
                    <span className="block truncate font-medium text-fg" title={f.razonSocial}>{f.razonSocial}</span>
                    <span className="block truncate text-fg-muted">
                      {f.estado === 'parcial' ? `Pagó ${bs(f.pagado)} de ${bs(f.monto)}` : bs(f.monto)}
                      {f.responsables.length > 0 && <span className="xl:hidden"> · {f.responsables.join(' · ')}</span>}
                    </span>
                  </td>
                  <td className="hidden truncate px-3 py-3 text-[13px] text-fg-muted xl:table-cell">{f.responsables.join(' · ') || '—'}</td>
                  <td className="hidden whitespace-nowrap px-3 py-3 text-[13px] text-fg-muted xl:table-cell">{fecha(f.vence)}</td>
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
