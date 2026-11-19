import { useCallback, useState } from 'react';
import { ArrowRight, CircleCheck, ExternalLink, FilePlus2, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { BlockTitle, CancelButton, Modal, ModalColumns, ModalSection, PrimaryButton, ToneBadge } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { CAMBIOS_BITRIX, ENLACES_POR, REGIONALES, SITUACIONES_BITRIX, bs, enlaceSeguro, fecha, fechaHora, valorCambio } from '../domain/comercial';
import { Cargando, Dato, ErrorCarga, SituacionBitrix as Situacion } from './comunes';

const sinCero = (n) => (n ? n : null);

/**
 * Qué le falta a Bitrix24 de esta negociación según sus facturas y, para el
 * área Comercial, la escritura con confirmación. El servidor relee la
 * negociación en Bitrix24 y no escribe si cambió desde que se vio.
 */
function ParaBitrix({ neg, soloConsulta, puedeEscribir, modo, onActualizada }) {
  const [confirmando, setConfirmando] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const { cambios, avisos } = neg.bitrix;
  if (!neg.facturas.length) return null;

  const actualizar = async () => {
    setEscribiendo(true);
    try {
      const r = await comercialApi.bitrixActualizar(neg.dealId, cambios);
      toast.success(r?.simulada
        ? `Simulación: negociación #${neg.dealId} actualizada en la copia de DataMET+; Bitrix24 no cambió.`
        : `Negociación #${neg.dealId} actualizada en Bitrix24.`);
      setConfirmando(false);
      onActualizada();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar Bitrix24.');
      setConfirmando(false);
      if (error.status === 409) onActualizada();
    } finally {
      setEscribiendo(false);
    }
  };

  return (
    <section aria-label="Para Bitrix24" className="mb-6">
      <BlockTitle>
        Para Bitrix24
        {modo === 'prueba' && !soloConsulta && <span className="ml-2 align-middle"><ToneBadge tone="warning">Modo de prueba</ToneBadge></span>}
      </BlockTitle>
      {cambios.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-fg-muted">
          <CircleCheck className="h-4 w-4 flex-none text-success" aria-hidden="true" /> Bitrix24 está al día con sus facturas.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-2.5">
          {cambios.map(c => (
            <li key={c.campo} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-2 text-[13px]">
              <span className="text-fg-muted">{CAMBIOS_BITRIX[c.campo]}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="text-fg-subtle line-through decoration-fg/30">{valorCambio(c.antes)}</span>
                <ArrowRight className="h-3.5 w-3.5 flex-none text-fg-subtle" aria-label="pasa a" />
                <span className="font-semibold text-fg">{valorCambio(c.despues)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {avisos.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {avisos.map(a => (
            <li key={a.codigo} className="flex gap-2 text-[12.5px] text-fg-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" /> <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}
      {!soloConsulta && modo === 'desactivada' && cambios.length > 0 && (
        <p className="mt-3 text-[12.5px] text-fg-muted">La escritura en Bitrix24 está desactivada en este servidor (Sistemas la habilita con BITRIX_ESCRITURA).</p>
      )}
      {!soloConsulta && puedeEscribir && cambios.length > 0 && !confirmando && (
        <Button size="sm" variant="secondary" className="mt-3 h-9" onClick={() => setConfirmando(true)}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Actualizar en Bitrix24
        </Button>
      )}
      {confirmando && (
        <div role="alertdialog" aria-label="Confirmar la actualización en Bitrix24" className="mt-3 rounded-xl bg-surface-2/70 p-3">
          {modo === 'prueba' ? (
            <p className="text-[13px] text-fg">
              <strong className="font-semibold">Modo de prueba:</strong> se simula la escritura. Bitrix24 no cambia; solo la copia de DataMET+ y su
              historial, marcado como simulación. Una copia completa la devuelve a lo que dice Bitrix24.
            </p>
          ) : (
            <p className="text-[13px] text-fg">
              Se cambia la negociación en Bitrix24 para todo el equipo. Mover la etapa puede disparar sus automatizaciones, como si se moviera a mano.
              Antes de escribir se vuelve a leer: si cambió, no se escribe.
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <CancelButton onClick={() => setConfirmando(false)} disabled={escribiendo} />
            <PrimaryButton onClick={actualizar} busy={escribiendo} busyLabel="Actualizando">Sí, actualizar</PrimaryButton>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Ficha de una negociación de la copia de Bitrix24: sus datos del CRM, sus
 * cotizaciones, las facturas con que está enlazada y, para el área
 * Comercial, el botón que abre la factura nueva con lo que ya se sabe.
 */
export function NegociacionModal({ id, soloConsulta, puedeEscribir = false, modo = 'desactivada', onClose, onFacturar, onAbrirFactura, onChanged }) {
  const load = useCallback(() => comercialApi.bitrixNegociacion(id), [id]);
  const { data: neg, error, reload } = useResource(load);
  const enlace = enlaceSeguro(neg?.enlace);
  const propuesta = neg?.propuesta;
  const facturar = neg && !soloConsulta && neg.fase !== 'PERDIDA';

  return (
    <Modal
      onClose={onClose}
      size="xl"
      title={neg ? neg.titulo || `Negociación ${neg.dealId}` : 'Negociación'}
      subtitle={neg ? `#${neg.dealId} · ${neg.embudo} › ${neg.etapa}` : 'Cargando…'}
      actions={neg ? <Situacion situacion={neg.situacion} /> : null}
      footer={(close) => (
        <div className="flex w-full flex-wrap items-center gap-2">
          {enlace && (
            <a href={enlace} target="_blank" rel="noopener noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-fg-muted hover:bg-fg/[0.06] hover:text-fg">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir en Bitrix24
            </a>
          )}
          <div className="ml-auto flex items-center gap-2">
            <CancelButton onClick={close}>Cerrar</CancelButton>
            {facturar && (
              <PrimaryButton onClick={() => onFacturar(propuesta)}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                {neg.facturas.length ? 'Registrar otra factura' : 'Registrar su factura'}
              </PrimaryButton>
            )}
          </div>
        </div>
      )}
    >
      {error && <div className="p-5"><ErrorCarga titulo="No se pudo abrir la negociación." error={error} onRetry={reload} /></div>}
      {!neg && !error && <div className="p-5"><Cargando label="Cargando negociación" filas={3} /></div>}
      {neg && (
        <ModalColumns>
          <ModalSection title="En Bitrix24" description={`Copiada ${fechaHora(neg.sincronizada)}. Se corrige en Bitrix24, no aquí.`}>
            <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-3">
              <Dato label="Empresa" className="sm:col-span-2">
                {neg.empresa ? `${neg.empresa}${neg.empresaCodigo ? ` (${neg.empresaCodigo})` : ''}` : null}
              </Dato>
              <Dato label="NIT">{neg.empresaNit}</Dato>
              <Dato label="Monto"><span className="font-semibold tabular-nums">{bs(neg.monto)}</span>{neg.moneda && neg.moneda !== 'BOB' ? ` ${neg.moneda}` : ''}</Dato>
              <Dato label="Responsable">{neg.responsable}</Dato>
              <Dato label="Regional">{REGIONALES[neg.regional] || neg.ciudad}</Dato>
              <Dato label="Creada">{fecha(neg.creada)}</Dato>
              <Dato label="Modificada">{fechaHora(neg.modificada)}</Dato>
              <Dato label="Mes a facturar">{neg.mesFacturar}</Dato>
              {(neg.numBalanzas || neg.numPesas) ? (
                <Dato label="Equipos">
                  {[sinCero(neg.numBalanzas) && `${neg.numBalanzas} balanzas`, sinCero(neg.numPesas) && `${neg.numPesas} pesas`].filter(Boolean).join(' · ')}
                </Dato>
              ) : null}
              {neg.subArea && <Dato label="Sub área">{neg.subArea}</Dato>}
              {neg.tiposServicio && <Dato label="Tipo de servicio" className="sm:col-span-2">{neg.tiposServicio}</Dato>}
              {neg.tecnico && <Dato label="Técnico">{neg.tecnico}</Dato>}
              {neg.apoyo && <Dato label="Apoyo" className="sm:col-span-2">{neg.apoyo}</Dato>}
              {neg.notaSalida && <Dato label="Nota de salida"><span className="font-mono text-[13px]">{neg.notaSalida}</span></Dato>}
              {neg.ordenCompra && <Dato label="Orden de compra">{neg.ordenCompra}</Dato>}
              {neg.marcadaFacturada !== null && <Dato label="Marcada facturada">{neg.marcadaFacturada ? 'Sí' : 'No'}</Dato>}
            </dl>
            {neg.condiciones && (
              <div className="mt-5">
                <BlockTitle>Condiciones</BlockTitle>
                <p className="whitespace-pre-line text-[13px] text-fg">{neg.condiciones}</p>
              </div>
            )}
            <div className="mt-6">
              <BlockTitle>Cotizaciones</BlockTitle>
              {neg.cotizaciones.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {neg.cotizaciones.map(c => (
                    <li key={c} className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-[12.5px] text-fg">{c}</li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-fg-muted">La negociación no tiene cotización anotada: se enlaza solo si la factura anota esta negociación.</p>}
            </div>
          </ModalSection>

          <ModalSection aside title="En DataMET+" description={SITUACIONES_BITRIX[neg.situacion]?.ayuda}>
            {neg.bitrix && (
              <ParaBitrix neg={neg} soloConsulta={soloConsulta} puedeEscribir={puedeEscribir} modo={modo} onActualizada={() => { reload(); onChanged?.(); }} />
            )}
            <BlockTitle>Facturas</BlockTitle>
            {neg.facturas.length ? (
              <ul className="mb-6 flex flex-col gap-2">
                {neg.facturas.map(f => (
                  <li key={f.id}>
                    <button type="button" onClick={() => onAbrirFactura(f.id)}
                      className="flex w-full flex-col rounded-xl border border-line bg-surface px-3 py-2 text-left hover:bg-fg/[0.025]">
                      <span className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="font-mono font-semibold text-fg">N.º {f.numero} / {f.gestion}</span>
                        <span className="font-semibold tabular-nums text-fg">{bs(f.monto)}</span>
                      </span>
                      <span className="text-[12px] text-fg-muted">{fecha(f.fecha)} · enlazada {ENLACES_POR[f.por] || ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="mb-6 text-[13px] text-fg-muted">Sin factura enlazada.</p>}

            {facturar && propuesta?.avisos?.length > 0 && (
              <>
                <BlockTitle>Antes de facturar</BlockTitle>
                <ul className="flex flex-col gap-2">
                  {propuesta.avisos.map(aviso => (
                    <li key={aviso.texto} className="flex gap-2 text-[13px] text-fg">
                      <TriangleAlert className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
                      <span>{aviso.texto}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ModalSection>
        </ModalColumns>
      )}
    </Modal>
  );
}
