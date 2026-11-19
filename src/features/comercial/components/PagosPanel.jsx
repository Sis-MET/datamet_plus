import { useCallback, useState } from 'react';
import { Ban, Banknote, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import {
  CancelButton, DangerButton, EmptyState, Modal, ModalSection, ToneBadge,
} from '../../calibration/components/primitives';
import { ReasonModal } from '../../calibration/components/ReasonModal';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { ACCIONES_HISTORIAL, MEDIOS, ORIGENES, PAGE_SIZE, bs, bsCorto, fecha, fechaHora, filtrosAParams } from '../domain/comercial';
import { Busqueda, Cargando, Cifras, Dato, ErrorCarga, FilaAbrible, Paginacion } from './comunes';
import { FacturaModal } from './FacturaModal';
import { PagoModal } from './PagoModal';

const ESTADOS_PAGO = [
  { value: 'vigente', label: 'Vigentes', tone: 'success' },
  { value: 'sin_aplicar', label: 'Con saldo sin aplicar', tone: 'info' },
  { value: 'anulado', label: 'Anulados', tone: 'muted' },
];

function EstadoPago({ pago }) {
  if (pago.estado === 'anulado') return <ToneBadge tone="muted">Anulado</ToneBadge>;
  if (pago.sinAplicar > 0) return <ToneBadge tone="info">{bs(pago.sinAplicar)} sin aplicar</ToneBadge>;
  return <ToneBadge tone="success">Aplicado</ToneBadge>;
}

function PagoFicha({ id, soloConsulta, onClose, onChanged, onOpenFactura }) {
  const load = useCallback(() => comercialApi.pago(id), [id]);
  const { data: pago, error, reload } = useResource(load);
  const [anulando, setAnulando] = useState(false);

  return (
    <>
      <Modal
        onClose={onClose}
        size="md"
        title={pago ? `Pago de ${bs(pago.monto)}` : 'Pago'}
        subtitle={pago ? `${fecha(pago.fecha)} · ${MEDIOS[pago.medio]}` : 'Cargando…'}
        actions={pago ? <EstadoPago pago={pago} /> : null}
        footer={(close) => (
          <div className="flex w-full items-center gap-2">
            {pago?.estado === 'vigente' && !soloConsulta && (
              <DangerButton onClick={() => setAnulando(true)} label="Anular el pago">
                <Ban className="h-4 w-4" aria-hidden="true" /> Anular
              </DangerButton>
            )}
            <div className="ml-auto"><CancelButton onClick={close}>Cerrar</CancelButton></div>
          </div>
        )}
      >
        {error && <div className="p-5"><ErrorCarga titulo="No se pudo abrir el pago." error={error} onRetry={reload} /></div>}
        {!pago && !error && <div className="p-5"><Cargando label="Cargando pago" filas={2} /></div>}
        {pago && (
          <ModalSection title="Detalle">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Dato label="Aplicado">{bs(pago.aplicado)}</Dato>
              <Dato label="Sin aplicar">{bs(pago.sinAplicar)}</Dato>
              <Dato label="Referencia">{pago.referencia}</Dato>
              <Dato label="Verificado con">{pago.verificacion}</Dato>
              {pago.observacion && <Dato label="Observación" className="sm:col-span-2">{pago.observacion}</Dato>}
            </dl>
            {pago.anulacion && (
              <p className="mt-4 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-[13px]">
                Anulado por {pago.anulacion.nombre || pago.anulacion.usuario} el {fechaHora(pago.anulacion.fecha)}: «{pago.anulacion.motivo}»
              </p>
            )}
            <h4 className="mb-2 mt-6 text-[13px] font-semibold text-fg">Facturas</h4>
            {pago.aplicaciones.length === 0 && <p className="text-[13px] text-fg-muted">No está aplicado a ninguna factura.</p>}
            <ul className="flex flex-col gap-2">
              {pago.aplicaciones.map(a => (
                <li key={a.facturaId}>
                  <button type="button" onClick={() => onOpenFactura(a.facturaId)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-left hover:bg-surface-2">
                    <span className="min-w-0 truncate text-[13px] text-fg">N.º {a.numero} · {a.razonSocial}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-fg">{bs(a.monto)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h4 className="mb-2 mt-6 text-[13px] font-semibold text-fg">Historial</h4>
            <ol className="flex flex-col gap-2">
              {pago.historial.map(evento => (
                <li key={evento.id} className="border-l-2 border-line pl-3 text-[12.5px] text-fg-muted">
                  <span className="font-semibold text-fg">{ACCIONES_HISTORIAL[evento.accion] || evento.accion}</span> · {evento.nombre || evento.usuario} · {fechaHora(evento.fecha)}
                  {evento.motivo && <span className="block text-fg">«{evento.motivo}»</span>}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-[12px] text-fg-subtle">{ORIGENES[pago.origen]}{pago.origenRef ? ` · ${pago.origenRef}` : ''}</p>
          </ModalSection>
        )}
      </Modal>
      {anulando && pago && (
        <ReasonModal
          title={`Anular el pago de ${bs(pago.monto)}`}
          subtitle={`${fecha(pago.fecha)} · ${MEDIOS[pago.medio]}`}
          heading="El pago no se borra"
          description="Queda anulado con el motivo, tu usuario y la hora; sus facturas vuelven a tener ese saldo. Escribe al menos 10 caracteres."
          confirmLabel="Anular pago"
          danger
          reasonPlaceholder="Por ejemplo: el depósito era de otro cliente."
          onConfirm={async (motivo) => {
            await comercialApi.anularPago(pago.id, motivo);
            toast.success('Pago anulado.');
            reload();
            onChanged?.();
          }}
          onClose={() => setAnulando(false)}
        />
      )}
    </>
  );
}

/** Pagos recibidos: lista, búsqueda, saldo sin aplicar y registro de uno nuevo. */
export function PagosPanel({ soloConsulta }) {
  const [filtros, setFiltros] = useState({ q: '', estado: '' });
  const [page, setPage] = useState(1);
  const [abierto, setAbierto] = useState(null);
  const [factura, setFactura] = useState(null);
  const [nuevo, setNuevo] = useState(false);

  const load = useCallback(() => comercialApi.pagos(filtrosAParams(filtros, page)), [filtros, page]);
  const { data, error, loading, reload } = useResource(load);
  const cambiar = useCallback((cambios) => { setFiltros(actual => ({ ...actual, ...cambios })); setPage(1); }, []);
  const buscar = useCallback((q) => cambiar({ q }), [cambiar]);
  const items = data?.items || [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Pagos</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Busqueda value={filtros.q} onChange={buscar} label="Buscar pagos" placeholder="Referencia, verificación, factura o cliente…" />
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
          {ESTADOS_PAGO.map(estado => (
            <button key={estado.value} type="button" aria-pressed={filtros.estado === estado.value}
              onClick={() => cambiar({ estado: filtros.estado === estado.value ? '' : estado.value })}
              className={cn('cal-filter-chip', `cal-tone-${estado.tone}`)}>
              <span className="cal-dot" aria-hidden="true" />{estado.label}
            </button>
          ))}
        </div>
        {!soloConsulta && (
          <Button size="sm" className="ml-auto h-9" onClick={() => setNuevo(true)}>
            <HandCoins className="h-4 w-4" aria-hidden="true" /> Registrar pago
          </Button>
        )}
      </div>

      {data && (
        <Cifras items={[
          { label: 'Cobrado', value: bsCorto(data.resumen.cobrado), hint: 'Pagos vigentes del filtro' },
          { label: 'Sin aplicar', value: bsCorto(data.resumen.sinAplicar), hint: 'Anticipos y saldos a favor' },
          { label: 'Pagos', value: String(data.total) },
          { label: 'Página', value: `${page} de ${Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE)))}` },
        ]} />
      )}

      {error && <ErrorCarga titulo="No se pudieron cargar los pagos." error={error} onRetry={reload} />}
      {!data && !error && <Cargando label="Cargando pagos" />}
      {data && items.length === 0 && (
        <EmptyState icon={Banknote} title="No hay pagos con estos filtros">
          Los pagos aparecen aquí al registrarlos o al importar el Excel de facturación.
        </EmptyState>
      )}

      {items.length > 0 && (
        <div className={cn('card overflow-hidden shadow-card transition-opacity', loading && 'opacity-60')}>
          <table className="hidden w-full text-left md:table">
            <caption className="sr-only">Pagos, del más reciente al más antiguo</caption>
            <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Fecha</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Facturas</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Medio y verificación</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Monto</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map(pago => (
                <FilaAbrible key={pago.id} onOpen={() => setAbierto(pago.id)}>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-fg">{fecha(pago.fecha)}</td>
                  <td className="max-w-[340px] px-3 py-3 text-[13px]">
                    {pago.aplicaciones.length === 0 && <span className="text-fg-muted">Sin aplicar</span>}
                    {pago.aplicaciones.slice(0, 2).map(a => (
                      <span key={a.facturaId} className="block truncate text-fg">N.º {a.numero} · {a.razonSocial}</span>
                    ))}
                    {pago.aplicaciones.length > 2 && <span className="block text-fg-muted">y {pago.aplicaciones.length - 2} más</span>}
                  </td>
                  <td className="max-w-[220px] px-3 py-3 text-[13px] text-fg-muted">
                    <span className="block text-fg">{MEDIOS[pago.medio]}</span>
                    <span className="block truncate">{pago.verificacion || pago.referencia || '—'}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-fg">{bs(pago.monto)}</td>
                  <td className="px-4 py-3 text-right"><EstadoPago pago={pago} /></td>
                </FilaAbrible>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {items.map(pago => (
              <li key={pago.id}>
                <button type="button" onClick={() => setAbierto(pago.id)} className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-fg/[0.025]">
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-fg">{fecha(pago.fecha)} · {bs(pago.monto)}</span>
                    <EstadoPago pago={pago} />
                  </span>
                  <span className="truncate text-[12.5px] text-fg-muted">
                    {pago.aplicaciones.map(a => `N.º ${a.numero}`).join(', ') || 'Sin aplicar'} · {MEDIOS[pago.medio]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && <Paginacion total={data.total} page={page} pageSize={data.pageSize || PAGE_SIZE} loading={loading} onPage={setPage} unidad="pagos" />}

      {abierto && (
        <PagoFicha id={abierto} soloConsulta={soloConsulta} onClose={() => setAbierto(null)} onChanged={reload}
          onOpenFactura={(id) => { setAbierto(null); setFactura(id); }} />
      )}
      {factura && <FacturaModal id={factura} soloConsulta={soloConsulta} onClose={() => setFactura(null)} onChanged={reload} />}
      {nuevo && <PagoModal onClose={() => setNuevo(false)} onCreated={() => { toast.success('Pago registrado.'); reload(); }} />}
    </div>
  );
}
