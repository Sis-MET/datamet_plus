import { useCallback, useState } from 'react';
import { Check, Info, Loader2, Pencil, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { useResource } from '../../system/hooks/useResource';
import { calibrationApi } from '../api/calibration';
import { ACCIONES_VERSION, CLASES_VERSION, versionSituation } from '../domain/servicemet';
import { formatDate } from '../domain/format';
import { HistoryList } from './HistoryList';
import { CancelButton, Modal, ModalColumns, ModalSection, ToneBadge } from './primitives';
import { ServiceMetFormModal } from './ServiceMetFormModal';
import { ServiceMetStepModal } from './ServiceMetStepModal';

const dateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
  : null);
const byWhen = (por, en) => [por, dateTime(en)].filter(Boolean).join(' · ');

const actionButton = 'mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold text-fg shadow-xs transition-colors hover:border-fg/25 hover:bg-surface-2';
const primaryAction = 'mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3 text-[13px] font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-colors hover:bg-brand-hover';

/** Un paso del control: marcador, qué pasó y la acción que corresponde. */
function Step({ title, who, state, children, last = false }) {
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
        <p className={cn('text-[13.5px] font-semibold', state === 'pending' ? 'text-fg-muted' : 'text-fg')}>
          {title}
          {who && <span className="ml-1.5 text-xs font-normal text-fg-subtle">{who}</span>}
        </p>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{children}</div>
      </div>
    </li>
  );
}

function ControlSteps({ version, onStep }) {
  const { acciones } = version;
  const rechazada = version.estado === 'RECHAZADA';
  const conforme = version.validacionResultado === 'CONFORME';
  const aprobada = ['APROBADA', 'EN_USO'].includes(version.estado);
  const enUso = version.estado === 'EN_USO';
  const abierta = ['REGISTRADA', 'VALIDADA'].includes(version.estado);

  const validacionState = conforme ? 'done' : version.validacionResultado === 'NO_CONFORME' ? 'failed' : (abierta ? 'current' : 'pending');
  const decisionState = rechazada ? 'failed' : aprobada ? 'done' : (conforme ? 'current' : 'pending');
  const usoState = enUso ? 'done' : (version.estado === 'APROBADA' ? 'current' : 'pending');

  return (
    <ol>
      <Step title="Registrada" state="done">
        {byWhen(version.registradoPor, version.registradoEn)}
        {version.aPosteriori && <span className="block">Registrada después de liberarse.</span>}
      </Step>

      <Step title="Validación" who="Sistemas" state={validacionState}>
        {version.validacion ? (
          <>
            <ToneBadge tone={conforme ? 'success' : 'danger'}>{conforme ? 'Conforme' : 'No conforme'}</ToneBadge>
            <p className="mt-1.5 whitespace-pre-line text-fg">{version.validacion}</p>
            {version.registroValidacion && <p className="mt-0.5">Registro: <span className="font-medium text-fg">{version.registroValidacion}</span></p>}
            <p className="mt-0.5">{byWhen(version.validadoPor, version.validadoEn)}</p>
          </>
        ) : (
          <p>
            Aún no se registra cómo se comprobó que funciona.
            {version.registroValidacion && <> Documento: <span className="font-medium text-fg">{version.registroValidacion}</span>.</>}
          </p>
        )}
        {acciones.validar && (
          <button type="button" onClick={() => onStep('validacion')} className={actionButton}>
            {version.validacion ? 'Registrar otra validación' : 'Registrar validación'}
          </button>
        )}
      </Step>

      <Step title={rechazada ? 'No aprobada' : 'Aprobación'} who="Jefe de Calibración" state={decisionState}>
        {version.decididoPor ? (
          <>
            <p>
              {rechazada ? 'No aprobada' : 'Aprobada para uso'} por{' '}
              <span className="font-medium text-fg">{version.decididoNombre || version.decididoPor}</span>
              {version.decididoCargo ? ` (${version.decididoCargo})` : ''}
            </p>
            <p className="mt-0.5">{dateTime(version.decididoEn)}</p>
            {version.decisionObs && <p className="mt-1 whitespace-pre-line text-fg">{version.decisionObs}</p>}
          </>
        ) : (
          <p>{conforme ? 'Validada: lista para que el jefe de Calibración decida.' : 'Requiere una validación conforme.'}</p>
        )}
        {acciones.decidir && (
          <button type="button" onClick={() => onStep('decision')} className={acciones.aprobar ? primaryAction : actionButton}>
            {acciones.aprobar ? 'Aprobar o no aprobar' : 'Registrar como no aprobada'}
          </button>
        )}
      </Step>

      <Step title="Puesta en uso" state={usoState} last>
        {version.enUsoDesde ? (
          <>
            <p>En uso desde el <span className="font-medium text-fg">{formatDate(version.enUsoDesde)}</span>{version.dispositivos ? ` · ${version.dispositivos}` : ''}</p>
            <p className="mt-0.5">{byWhen(version.puestaPor, version.puestaEn)}</p>
            {version.puestaObs && <p className="mt-1 whitespace-pre-line text-fg">{version.puestaObs}</p>}
          </>
        ) : <p>{rechazada ? 'No se distribuye.' : 'Después de aprobarla, al instalarla en los teléfonos.'}</p>}
        {acciones.ponerEnUso && (
          <button type="button" onClick={() => onStep('puesta')} className={actionButton}>Registrar puesta en uso</button>
        )}
      </Step>
    </ol>
  );
}

function ChangeList({ title, items }) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="mt-5">
      <h4 className="mb-2 text-[13px] font-semibold text-fg">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2.5 text-[13px] leading-relaxed text-fg">
            <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-fg/30" aria-hidden="true" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ficha de una versión: qué cambia, su control (validación, aprobación, puesta en uso) y su historial. */
export function ServiceMetVersionModal({ versionId, onClose, onChanged }) {
  const load = useCallback(() => calibrationApi.servicemetVersion(versionId), [versionId]);
  const { data: version, error, reload } = useResource(load);
  const [sub, setSub] = useState(null);

  const changed = () => {
    reload();
    onChanged();
  };

  const situation = version ? versionSituation(version) : null;
  const clase = version ? CLASES_VERSION[version.clase] : null;

  return (
    <>
      <Modal
        onClose={onClose}
        title={version ? `ServiceMET ${version.version}` : 'Versión de ServiceMET'}
        subtitle={version && (
          <>
            <span className="font-medium text-fg">Clase {version.clase} · {clase.label}</span>
            <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>{formatDate(version.fecha)}
            {version.commit && <><span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span><span className="font-mono text-[12.5px]">{version.commit}</span></>}
          </>
        )}
        actions={version?.acciones.editar && (
          <button
            type="button"
            onClick={() => setSub({ type: 'editar' })}
            aria-label="Editar la versión"
            title="Editar la versión"
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
        {!version && !error && (
          <p className="flex items-center gap-2 p-6 text-[13px] text-fg-muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando la versión…
          </p>
        )}
        {!version && error && <p className="p-6 text-[13px] text-danger" role="alert">No se pudo cargar la versión: {error.message}</p>}
        {version && (
          <ModalColumns>
            <ModalSection
              title="Qué cambia"
              description={clase.description}
              action={<ToneBadge tone={situation.tone}>{situation.label}</ToneBadge>}
            >
              <p className="max-w-[68ch] whitespace-pre-line text-[13.5px] leading-relaxed text-fg">{version.resumen}</p>
              <ChangeList title="Nuevo" items={version.nuevo} />
              <ChangeList title="Corregido" items={version.corregido} />
              <dl className="cal-facts mt-6">
                <div className="col-span-full">
                  <dt>Impacto en los registros</dt>
                  <dd className="whitespace-pre-line font-normal">{version.impacto || 'Sin impacto en los datos registrados.'}</dd>
                </div>
              </dl>
              {version.aPosteriori && !version.decididoPor && (
                <p className="mt-5 flex gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">
                  <Info className="mt-0.5 h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
                  <span>Esta versión se liberó antes de este registro. Para completarlo, Sistemas registra su validación y el jefe de Calibración la aprueba a posteriori o la registra como no aprobada.</span>
                </p>
              )}
              <section aria-label="Historial de la versión" className="mt-7 border-t border-line pt-5">
                <h4 className="mb-2.5 text-[13px] font-semibold text-fg">Historial</h4>
                <HistoryList items={version.historial.map(item => ({ ...item, title: ACCIONES_VERSION[item.accion] || item.accion }))} />
              </section>
            </ModalSection>

            <ModalSection aside title="Control de la versión" description="Se valida y la aprueba el jefe de Calibración antes de usarse.">
              <ControlSteps version={version} onStep={(step) => setSub({ type: 'step', step })} />
            </ModalSection>
          </ModalColumns>
        )}
      </Modal>

      {sub?.type === 'editar' && version && (
        <ServiceMetFormModal version={version} onClose={() => setSub(null)} onSaved={changed} />
      )}
      {sub?.type === 'step' && version && (
        <ServiceMetStepModal step={sub.step} version={version} onClose={() => setSub(null)} onSaved={changed} />
      )}
    </>
  );
}
