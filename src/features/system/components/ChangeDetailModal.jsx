import { useCallback, useState } from 'react';
import { Check, Info, Loader2, Pencil, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { HistoryList } from '../../calibration/components/HistoryList';
import { CancelButton, Modal, ModalColumns, ModalSection, ToneBadge } from '../../calibration/components/primitives';
import { systemApi } from '../api/system';
import { ACCIONES_CAMBIO, ESTADOS_FALLA, TIPOS_CAMBIO, changeSituation } from '../domain/system';
import { useResource } from '../hooks/useResource';
import { ChangeFormModal } from './ChangeFormModal';
import { ChangeStepModal } from './ChangeStepModal';

const dateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
  : null);
const dateOnly = (value) => (value
  ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })
  : null);
const byWhen = (por, en) => [por, dateTime(en)].filter(Boolean).join(' · ');

const actionButton = 'mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold text-fg shadow-xs transition-colors hover:border-fg/25 hover:bg-surface-2';

/** Un paso del control: marcador, qué pasó y la acción que corresponde. */
function Step({ title, state, children, last = false }) {
  const marker = {
    done: 'border-success bg-success text-surface',
    failed: 'border-danger bg-danger text-surface',
    current: 'border-fg bg-surface text-fg',
    pending: 'border-line-strong bg-surface text-fg-subtle',
  }[state];
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute left-[11px] top-7 h-[calc(100%-28px)] w-px bg-line" aria-hidden="true" />}
      <span className={cn('relative mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border-2', marker)} aria-hidden="true">
        {state === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        {state === 'failed' && <X className="h-3.5 w-3.5" strokeWidth={3} />}
        {state === 'current' && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[13.5px] font-semibold', state === 'pending' ? 'text-fg-muted' : 'text-fg')}>{title}</p>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{children}</div>
      </div>
    </li>
  );
}

function ControlSteps({ cambio, onStep }) {
  const { acciones } = cambio;
  const rechazado = cambio.estado === 'RECHAZADO';
  const validado = cambio.validacionResultado === 'CONFORME';
  const aprobado = Boolean(cambio.aprobadoPor) && !rechazado;
  const implementado = cambio.estado === 'IMPLEMENTADO';

  const validacionState = validado ? 'done' : cambio.validacionResultado === 'NO_CONFORME' ? 'failed' : (acciones.validar ? 'current' : 'pending');
  const aprobacionState = rechazado ? 'failed' : aprobado ? 'done' : (acciones.aprobar ? 'current' : 'pending');
  const implementacionState = implementado && (cambio.implementadoEn || !cambio.aPosteriori) ? 'done' : (acciones.implementar ? 'current' : 'pending');

  return (
    <ol>
      <Step title="Registrado" state="done">
        {byWhen(cambio.registradoPor, cambio.registradoEn)}
        {cambio.aPosteriori && <span className="block">Registrado después de implementarse.</span>}
      </Step>

      <Step title="Validación" state={validacionState}>
        {cambio.validacion ? (
          <>
            <ToneBadge tone={validado ? 'success' : 'danger'}>{validado ? 'Conforme' : 'No conforme'}</ToneBadge>
            <p className="mt-1.5 whitespace-pre-line text-fg">{cambio.validacion}</p>
            <p className="mt-0.5">{byWhen(cambio.validadoPor, cambio.validadoEn)}</p>
          </>
        ) : <p>Aún no se registra cómo se comprobó que funciona.</p>}
        {acciones.validar && (
          <button type="button" onClick={() => onStep('validacion')} className={actionButton}>
            {cambio.validacion ? 'Registrar otra validación' : 'Registrar validación'}
          </button>
        )}
      </Step>

      <Step title={rechazado ? 'Rechazado' : 'Aprobación'} state={aprobacionState}>
        {cambio.aprobadoPor ? (
          <>
            <p>{rechazado ? 'Rechazado' : 'Aprobado'} por {byWhen(cambio.aprobadoPor, cambio.aprobadoEn)}</p>
            {cambio.aprobacionObs && <p className="mt-1 whitespace-pre-line text-fg">{cambio.aprobacionObs}</p>}
          </>
        ) : (
          <p>
            {acciones.aprobar
              ? 'Listo para decidir.'
              : validado && !rechazado
                ? 'Lo aprueba o rechaza el jefe de área de Calibración.'
                : 'Requiere una validación conforme de Sistemas.'}
          </p>
        )}
        {acciones.aprobar && (
          <button type="button" onClick={() => onStep('aprobacion')} className={actionButton}>Aprobar o rechazar</button>
        )}
      </Step>

      <Step title="Implementación" state={implementacionState} last>
        {cambio.implementadoEn ? (
          <>
            <p>En producción desde el {dateOnly(cambio.implementadoEn)}{cambio.implementadoPor ? ` · ${cambio.implementadoPor}` : ''}</p>
            {cambio.implementacionObs && <p className="mt-1 whitespace-pre-line text-fg">{cambio.implementacionObs}</p>}
          </>
        ) : implementado ? (
          <p>{cambio.implementacionObs || 'En uso; la fecha de puesta en producción no quedó registrada.'}</p>
        ) : <p>{rechazado ? 'No se implementa.' : 'Después de aprobarlo.'}</p>}
        {acciones.implementar && (
          <button type="button" onClick={() => onStep('implementacion')} className={actionButton}>
            {implementado ? 'Registrar la fecha' : 'Registrar implementación'}
          </button>
        )}
      </Step>
    </ol>
  );
}

/** Ficha de un cambio: qué cambia, su control (validación, aprobación, implementación) y su historial. */
export function ChangeDetailModal({ cambioId, onClose, onChanged }) {
  const load = useCallback(() => systemApi.cambio(cambioId), [cambioId]);
  const { data: cambio, error, reload } = useResource(load);
  const [sub, setSub] = useState(null);

  const changed = () => {
    reload();
    onChanged();
  };

  const situation = cambio ? changeSituation(cambio) : null;

  return (
    <>
      <Modal
        onClose={onClose}
        title={cambio ? `${cambio.codigo} · ${cambio.titulo}` : 'Cambio'}
        subtitle={cambio && (
          <>
            <span className="font-medium text-fg">{TIPOS_CAMBIO[cambio.tipo]}</span>
            {cambio.version && <><span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>versión {cambio.version}</>}
            {cambio.modulos && <><span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>{cambio.modulos}</>}
          </>
        )}
        actions={cambio?.acciones.editar && (
          <button
            type="button"
            onClick={() => setSub({ type: 'editar' })}
            aria-label="Editar el cambio"
            title="Editar el cambio"
            className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Editar</span>
          </button>
        )}
        footer={(close) => (
          <div className="ml-auto">
            <CancelButton onClick={close}>Cerrar</CancelButton>
          </div>
        )}
      >
        {!cambio && !error && (
          <p className="flex items-center gap-2 p-6 text-[13px] text-fg-muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando el cambio…
          </p>
        )}
        {!cambio && error && <p className="p-6 text-[13px] text-danger" role="alert">No se pudo cargar el cambio: {error.message}</p>}
        {cambio && (
          <ModalColumns>
            <ModalSection
              title="Qué cambia"
              description={cambio.fechaCambio ? `Desarrollado hasta el ${dateOnly(cambio.fechaCambio)}` : undefined}
              action={<ToneBadge tone={situation.tone}>{situation.label}</ToneBadge>}
            >
              <p className="max-w-[68ch] whitespace-pre-line text-[13.5px] leading-relaxed text-fg">{cambio.descripcion}</p>
              <dl className="cal-facts mt-5">
                <div className="col-span-full">
                  <dt>Impacto</dt>
                  <dd className="whitespace-pre-line font-normal">{cambio.impacto || 'Sin indicar.'}</dd>
                </div>
                <div className="col-span-full">
                  <dt>Referencias</dt>
                  <dd className="whitespace-pre-line font-normal">{cambio.referencias || 'Sin indicar.'}</dd>
                </div>
              </dl>
              {cambio.aPosteriori && (
                <p className="mt-5 flex gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">
                  <Info className="mt-0.5 h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
                  <span>Este cambio ya estaba en uso cuando empezó el control de cambios. Registra su validación y su aprobación para completar su registro.</span>
                </p>
              )}
              {cambio.fallas.length > 0 && (
                <section aria-label="Fallas relacionadas" className="mt-6">
                  <h4 className="mb-2 text-[13px] font-semibold text-fg">Fallas que corrige</h4>
                  <ul className="space-y-1.5">
                    {cambio.fallas.map(falla => (
                      <li key={falla.id} className="flex items-center justify-between gap-3 text-[13px] text-fg">
                        <span className="min-w-0 truncate">F-{falla.id} · {falla.mensaje}</span>
                        <ToneBadge tone={ESTADOS_FALLA[falla.estado].tone}>{ESTADOS_FALLA[falla.estado].label}</ToneBadge>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section aria-label="Historial del cambio" className="mt-7 border-t border-line pt-5">
                <h4 className="mb-2.5 text-[13px] font-semibold text-fg">Historial</h4>
                <HistoryList items={cambio.historial.map(item => ({ ...item, title: ACCIONES_CAMBIO[item.accion] || item.accion }))} />
              </section>
            </ModalSection>

            <ModalSection aside title="Control del cambio" description="Se documenta, se valida y se aprueba antes de implementarse.">
              <ControlSteps cambio={cambio} onStep={(step) => setSub({ type: 'step', step })} />
            </ModalSection>
          </ModalColumns>
        )}
      </Modal>

      {sub?.type === 'editar' && cambio && (
        <ChangeFormModal cambio={cambio} onClose={() => setSub(null)} onSaved={changed} />
      )}
      {sub?.type === 'step' && cambio && (
        <ChangeStepModal step={sub.step} cambio={cambio} onClose={() => setSub(null)} onSaved={changed} />
      )}
    </>
  );
}
