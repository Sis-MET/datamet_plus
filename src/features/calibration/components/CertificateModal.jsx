import { useId, useMemo, useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { calibrationApi } from '../api/calibration';
import {
  certificateErrors,
  certificateFromEquipo,
  certificatePayload,
  emptyCertificate,
} from '../domain/certificate';
import { VIGENCIA, expiryOf, formatDate, periodLabel, vigenciaOf } from '../domain/format';
import { CertificateFields } from './CertificateFields';
import {
  CancelButton,
  FieldLabel,
  Modal,
  ModalColumns,
  ModalSection,
  PrimaryButton,
  ToneBadge,
} from './primitives';

function Note({ children }) {
  return (
    <p className="flex gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">
      <Info className="mt-0.5 h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function CertificateCard({ title, numero, fecha, periodoDias, ente, badge, muted = false }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-4 shadow-xs', muted && 'opacity-80')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-fg-muted">{title}</p>
        {badge}
      </div>
      <p className="mt-1 break-words text-[14px] font-semibold text-fg">{numero || 'Sin número'}</p>
      <dl className="cal-facts mt-3">
        <div><dt>Emitido</dt><dd>{formatDate(fecha)}</dd></div>
        <div><dt>Vence</dt><dd>{formatDate(expiryOf(fecha, periodoDias))}</dd></div>
        <div><dt>Vigencia</dt><dd>{periodoDias ? periodLabel(periodoDias) : '—'}</dd></div>
        <div><dt>Ente</dt><dd>{ente || '—'}</dd></div>
      </dl>
    </div>
  );
}

const CHANGE_ROWS = [
  ['numero', 'Número', value => value || '—'],
  ['ente', 'Ente calibrador', value => value || '—'],
  ['fecha', 'Emisión', value => formatDate(value)],
  ['periodoDias', 'Vigencia', value => (value ? `${periodLabel(value)} (${value} días)` : '—')],
];

/**
 * Ficha de certificado de un equipo.
 * - nuevo: renovación; el vigente pasa al historial.
 * - corregir: arregla un error del vigente sin crear uno nuevo.
 */
export function CertificateModal({ mode, equipo, entes, hoy, alertaDias, onClose, onSaved }) {
  const baseId = useId();
  const nuevo = mode === 'nuevo';
  const actual = useMemo(() => certificateFromEquipo(equipo), [equipo]);
  const [form, setForm] = useState(() => (nuevo
    ? emptyCertificate({ ente: equipo.enteCalibrador, periodoDias: equipo.periodoDias })
    : actual));
  const [motivo, setMotivo] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = certificateErrors(form, { hoy, posteriorA: nuevo ? equipo.certFecha : null });
  const motivoError = !nuevo && motivo.trim().length < 3 ? 'Escribe el motivo de la corrección (al menos 3 caracteres).' : null;
  const vence = expiryOf(form.fecha, form.periodoDias);
  const vigencia = VIGENCIA[vigenciaOf(vence, hoy, alertaDias)];
  const cambios = CHANGE_ROWS.filter(([key]) => String(actual[key] ?? '') !== String(form[key] ?? ''));

  const save = async (close) => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) {
      toast.error('Revisa los datos del certificado.');
      return;
    }
    if (motivoError) {
      toast.error(motivoError);
      return;
    }
    if (!nuevo && cambios.length === 0 && !form.observaciones.trim()) {
      toast.info('No hay cambios que guardar.');
      return;
    }
    setSaving(true);
    try {
      const body = certificatePayload(form);
      if (nuevo) await calibrationApi.registrarCertificado(equipo.id, body);
      else await calibrationApi.corregirCertificado(equipo.id, { ...body, motivo: motivo.trim() });
      toast.success(nuevo
        ? `Certificado ${body.numero} registrado: ${equipo.codigo} vence el ${formatDate(vence)}`
        : 'Certificado corregido');
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar el certificado.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={nuevo ? 'Registrar certificado' : 'Corregir certificado vigente'}
      subtitle={(
        <>
          <span className="font-medium text-fg">{equipo.codigo}</span>
          <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
          <span>{equipo.instrumento} · {equipo.planta}</span>
        </>
      )}
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving}>
            {nuevo ? 'Registrar certificado' : 'Guardar corrección'}
          </PrimaryButton>
        </div>
      )}
    >
      <ModalColumns>
        <ModalSection title="Datos del certificado" description="Tal como figuran en el documento emitido.">
          <CertificateFields
            value={form}
            onChange={setForm}
            errors={attempted ? errors : {}}
            entes={entes}
            hoy={hoy}
            idPrefix={baseId}
            disabled={saving}
            autoFocus
            withNotes
          />
        </ModalSection>

        {nuevo ? (
          <ModalSection aside title="Así queda el equipo" description="El certificado actual pasa al historial.">
            <div className="space-y-4">
              <CertificateCard
                title="Nuevo certificado"
                numero={form.numero.trim()}
                fecha={form.fecha}
                periodoDias={form.periodoDias}
                ente={form.ente.trim()}
                badge={vence ? <ToneBadge tone={vigencia.tone}>{vigencia.label}</ToneBadge> : null}
              />
              {equipo.certificado || equipo.certFecha ? (
                <CertificateCard
                  title="Pasa al historial"
                  numero={actual.numero}
                  fecha={actual.fecha}
                  periodoDias={equipo.periodoDias}
                  ente={actual.ente}
                  muted
                />
              ) : (
                <Note>Es el primer certificado del equipo.</Note>
              )}
              <Note>
                {vence
                  ? <>El plan se recalcula desde la nueva emisión: la próxima calibración pasa al <strong className="font-semibold text-fg">{formatDate(vence)}</strong> y las verificaciones que cuentan desde la calibración se reprograman.</>
                  : 'Al guardar, el plan se recalcula desde la nueva emisión.'}
              </Note>
            </div>
          </ModalSection>
        ) : (
          <ModalSection aside title="Cambios" description="Se corrige el vigente; no se crea un certificado nuevo.">
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
              {CHANGE_ROWS.map(([key, label, show]) => {
                const changed = String(actual[key] ?? '') !== String(form[key] ?? '');
                return (
                  <li key={key} className="px-4 py-3">
                    <p className="text-xs text-fg-muted">{label}</p>
                    <p className={cn('mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px]', changed ? 'font-semibold text-fg' : 'text-fg-muted')}>
                      {changed ? (
                        <>
                          <span className="font-normal text-fg-muted line-through decoration-fg/30">{show(actual[key])}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
                          <span>{show(form[key])}</span>
                        </>
                      ) : show(actual[key])}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5">
              <FieldLabel htmlFor={`${baseId}-motivo`}>Motivo de la corrección</FieldLabel>
              <textarea
                id={`${baseId}-motivo`}
                value={motivo}
                maxLength={300}
                onChange={(event) => setMotivo(event.target.value)}
                disabled={saving}
                placeholder="Ej.: el número se copió mal del documento"
                aria-invalid={attempted && motivoError ? true : undefined}
                className={cn('field min-h-[84px] resize-y py-3 leading-relaxed', attempted && motivoError && 'field-invalid')}
              />
              {attempted && motivoError
                ? <p className="field-error">{motivoError}</p>
                : <p className="cal-hint mt-1.5">La versión anterior queda completa en el historial con este motivo, y otra persona deberá revisar el certificado de nuevo.</p>}
            </div>
            <div className="mt-4">
              <Note>Si en realidad llegó un certificado nuevo, regístralo como nuevo: así el anterior se conserva en el historial.</Note>
            </div>
          </ModalSection>
        )}
      </ModalColumns>
    </Modal>
  );
}
