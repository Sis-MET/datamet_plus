import { useCallback, useState } from 'react';
import { Ban, ExternalLink, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, ModalColumns, ModalSection, BlockTitle, CancelButton, DangerButton, PrimaryButton, ToneBadge } from '../../calibration/components/primitives';
import { ReasonModal } from '../../calibration/components/ReasonModal';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import {
  ACCIONES_HISTORIAL, AREAS, ENLACES_POR, MEDIOS, ORIGENES, REFERENCIAS, REGIONALES, REGLAS, ROLES, TIPOS, bs, enlaceSeguro, fecha, fechaHora,
} from '../domain/comercial';
import { Cargando, Dato, ErrorCarga, EstadoFactura, Mora } from './comunes';
import { PagoModal } from './PagoModal';

function Lineas({ lineas }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead className="bg-surface-2/60 text-xs text-fg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Categoría</th>
            <th scope="col" className="px-3 py-2 font-medium">Cant.</th>
            <th scope="col" className="px-3 py-2 font-medium">Regional</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Monto</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Margen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lineas.map(linea => (
            <tr key={linea.id} className="align-top">
              <td className="px-3 py-2.5">
                <span className="block font-medium text-fg">{linea.categoria.nombre}</span>
                <span className="block text-[12px] text-fg-muted">{AREAS[linea.categoria.area]}{linea.costo != null ? ` · costo ${bs(linea.costo)}` : ''}</span>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-fg-muted">{linea.cantidad ?? '—'}</td>
              <td className="px-3 py-2.5 text-fg-muted">{REGIONALES[linea.regional] || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-fg">{bs(linea.monto)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums" title={REGLAS[linea.categoria.regla]}>
                {linea.margenPorcentaje === null
                  ? <ToneBadge tone="warning">Por costear</ToneBadge>
                  : <span className="text-fg-muted">{linea.margenPorcentaje.toLocaleString('es-BO')} %</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Negociaciones de Bitrix24 enlazadas con la factura (por cotización o por la negociación anotada). */
function Negociaciones({ negociaciones }) {
  return (
    <ul className="flex flex-col gap-2">
      {negociaciones.map(neg => {
        const enlace = enlaceSeguro(neg.enlace);
        return (
          <li key={neg.dealId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-line px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-fg">{neg.titulo || `Negociación ${neg.dealId}`}</p>
              <p className="text-[12px] text-fg-muted">#{neg.dealId} · {neg.embudo} › {neg.etapa} · enlazada {ENLACES_POR[neg.por] || ''}</p>
            </div>
            {enlace && (
              <a href={enlace} target="_blank" rel="noopener noreferrer" aria-label={`Abrir la negociación ${neg.dealId} en Bitrix24`}
                className="flex items-center gap-1 text-[12.5px] font-semibold text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg">
                Bitrix24 <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Historial({ eventos }) {
  if (!eventos.length) return <p className="text-[13px] text-fg-muted">Sin movimientos.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {eventos.map(evento => (
        <li key={evento.id} className="border-l-2 border-line pl-3">
          <p className="text-[13px] font-semibold text-fg">
            {ACCIONES_HISTORIAL[evento.accion] || evento.accion}
            {evento.detalle?.pago && ` · pago de ${bs(evento.detalle.aplicado)}`}
            {evento.detalle?.pagoAnulado && ` · se anuló un pago de ${bs(evento.detalle.monto)}`}
          </p>
          <p className="text-[12px] text-fg-muted">{evento.nombre || evento.usuario} · {fechaHora(evento.fecha)}</p>
          {evento.motivo && <p className="mt-0.5 text-[12.5px] text-fg">«{evento.motivo}»</p>}
          {evento.detalle?.origen && <p className="mt-0.5 text-[12px] text-fg-subtle">{evento.detalle.origen}</p>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Ficha de una factura en solo lectura: datos, líneas con su margen,
 * referencias, personas, pagos aplicados e historial. El área Comercial
 * registra un pago o la anula (con motivo, sin pagos vigentes).
 */
export function FacturaModal({ id, soloConsulta, onClose, onChanged }) {
  const load = useCallback(() => comercialApi.factura(id), [id]);
  const { data: factura, error, reload } = useResource(load);
  const [anulando, setAnulando] = useState(false);
  const [pagando, setPagando] = useState(false);

  const actualizar = () => { reload(); onChanged?.(); };
  const vigente = factura && factura.estado !== 'anulada';
  const pagosVigentes = factura?.pagos.filter(pago => pago.estado === 'VIGENTE') || [];

  return (
    <>
      <Modal
        onClose={onClose}
        size="xl"
        title={factura ? `Factura N.º ${factura.numero}` : 'Factura'}
        subtitle={factura ? `${fecha(factura.fechaEmision)} · ${factura.razonSocial}` : 'Cargando…'}
        actions={factura ? <EstadoFactura estado={factura.estado} /> : null}
        footer={(close) => (
          <div className="flex w-full flex-wrap items-center gap-2">
            {vigente && !soloConsulta && (
              <DangerButton
                onClick={() => setAnulando(true)}
                disabled={pagosVigentes.length > 0}
                label={pagosVigentes.length ? 'Para anular, primero anula los pagos aplicados' : 'Anular la factura'}
              >
                <Ban className="h-4 w-4" aria-hidden="true" /> Anular
              </DangerButton>
            )}
            <div className="ml-auto flex items-center gap-2">
              <CancelButton onClick={close}>Cerrar</CancelButton>
              {vigente && !soloConsulta && factura.saldo > 0 && (
                <PrimaryButton onClick={() => setPagando(true)}>
                  <HandCoins className="h-4 w-4" aria-hidden="true" /> Registrar pago
                </PrimaryButton>
              )}
            </div>
          </div>
        )}
      >
        {error && <div className="p-5"><ErrorCarga titulo="No se pudo abrir la factura." error={error} onRetry={reload} /></div>}
        {!factura && !error && <div className="p-5"><Cargando label="Cargando factura" filas={3} /></div>}
        {factura && (
          <ModalColumns>
            <ModalSection title="Datos de la factura">
              <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-3">
                <Dato label="Razón social" className="sm:col-span-2">{factura.razonSocial}</Dato>
                <Dato label="NIT">{factura.nit}</Dato>
                <Dato label="Cliente de DataMET" className="sm:col-span-2">
                  {factura.cliente ? `${factura.cliente.razonSocial || factura.cliente.nombre} (${factura.cliente.codigo})` : 'Sin enlazar'}
                </Dato>
                <Dato label="Tipo">{TIPOS[factura.tipo]}</Dato>
                <Dato label="Emisión">{fecha(factura.fechaEmision)}</Dato>
                <Dato label="Vence">{fecha(factura.vence)}{factura.plazoDias ? ` (${factura.plazoDias} días)` : ''}</Dato>
                <Dato label="Monto"><span className="font-semibold tabular-nums">{bs(factura.monto)}</span></Dato>
              </dl>
              {factura.anulacion && (
                <p className="mt-4 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-[13px] text-fg">
                  Anulada por {factura.anulacion.nombre || factura.anulacion.usuario} el {fechaHora(factura.anulacion.fecha)}: «{factura.anulacion.motivo}»
                </p>
              )}

              <div className="mt-6">
                <BlockTitle>Líneas</BlockTitle>
                {factura.lineas.length ? <Lineas lineas={factura.lineas} /> : <p className="text-[13px] text-fg-muted">Sin líneas.</p>}
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <BlockTitle>Referencias</BlockTitle>
                  {factura.referencias.length ? (
                    <dl className="grid gap-2">
                      {factura.referencias.map(ref => (
                        <Dato key={ref.id} label={REFERENCIAS[ref.tipo]}><span className="font-mono text-[13px]">{ref.valor}</span></Dato>
                      ))}
                    </dl>
                  ) : <p className="text-[13px] text-fg-muted">Sin cotización ni nota de salida.</p>}
                </div>
                <div>
                  <BlockTitle>Personas</BlockTitle>
                  {factura.personas.length ? (
                    <dl className="grid gap-2">
                      {factura.personas.map(persona => (
                        <Dato key={persona.id} label={ROLES[persona.rol]}>
                          {persona.nombre}{persona.porcentaje ? ` · ${persona.porcentaje.toLocaleString('es-BO')} %` : ''}
                        </Dato>
                      ))}
                    </dl>
                  ) : <p className="text-[13px] text-fg-muted">Sin personas registradas.</p>}
                </div>
              </div>

              {factura.negociaciones?.length > 0 && (
                <div className="mt-6">
                  <BlockTitle>Bitrix24</BlockTitle>
                  <Negociaciones negociaciones={factura.negociaciones} />
                </div>
              )}

              {factura.observacion && (
                <div className="mt-6">
                  <BlockTitle>Observación</BlockTitle>
                  <p className="whitespace-pre-line text-[13px] text-fg">{factura.observacion}</p>
                </div>
              )}
            </ModalSection>

            <ModalSection aside title="Cobro" description={vigente ? undefined : 'La factura está anulada.'}>
              {vigente && (
                <dl className="mb-5 grid grid-cols-2 gap-3">
                  <Dato label="Cobrado"><span className="font-semibold tabular-nums">{bs(factura.pagado)}</span></Dato>
                  <Dato label="Saldo"><span className="font-semibold tabular-nums">{bs(factura.saldo)}</span></Dato>
                  {factura.saldo > 0 && <Dato label="Mora"><Mora dias={factura.diasMora} tramo={factura.tramo} /></Dato>}
                  <Dato label="Días desde la emisión">{factura.diasEmision}</Dato>
                </dl>
              )}
              <BlockTitle>Pagos</BlockTitle>
              {factura.pagos.length ? (
                <ul className="mb-6 flex flex-col gap-2">
                  {factura.pagos.map(pago => (
                    <li key={pago.id} className="rounded-xl border border-line bg-surface px-3 py-2">
                      <p className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="font-semibold tabular-nums text-fg">{bs(pago.aplicado)}</span>
                        {pago.estado === 'ANULADO' ? <ToneBadge tone="muted">Anulado</ToneBadge> : <span className="text-fg-muted">{fecha(pago.fecha)}</span>}
                      </p>
                      <p className="text-[12px] text-fg-muted">
                        {MEDIOS[pago.medio]}{pago.aplicado !== pago.monto ? ` · de un pago de ${bs(pago.monto)}` : ''}
                        {pago.verificacion ? ` · ${pago.verificacion}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : <p className="mb-6 text-[13px] text-fg-muted">Todavía no tiene pagos.</p>}
              <BlockTitle>Historial</BlockTitle>
              <Historial eventos={factura.historial} />
              <p className="mt-5 text-[12px] text-fg-subtle">
                {ORIGENES[factura.origen]}{factura.origenRef ? ` · ${factura.origenRef}` : ''} · {factura.creado.nombre || factura.creado.usuario}, {fechaHora(factura.creado.fecha)}
              </p>
            </ModalSection>
          </ModalColumns>
        )}
      </Modal>

      {anulando && factura && (
        <ReasonModal
          title={`Anular la factura N.º ${factura.numero}`}
          subtitle={factura.razonSocial}
          heading="La factura no se borra"
          description="Queda anulada con el motivo, tu usuario y la hora. Escribe al menos 10 caracteres."
          confirmLabel="Anular factura"
          danger
          reasonPlaceholder="Por ejemplo: se emitió con el NIT equivocado y se reemplazó por la N.º 596."
          onConfirm={async (motivo) => {
            await comercialApi.anularFactura(factura.id, motivo);
            toast.success(`Factura N.º ${factura.numero} anulada.`);
            actualizar();
          }}
          onClose={() => setAnulando(false)}
        />
      )}
      {pagando && factura && (
        <PagoModal
          facturasIniciales={[factura]}
          onClose={() => setPagando(false)}
          onCreated={() => { toast.success('Pago registrado.'); actualizar(); }}
        />
      )}
    </>
  );
}
