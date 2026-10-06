import { useId, useMemo, useState } from 'react';
import { FilePlus2, Pencil, PowerOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { calibrationApi } from '../api/calibration';
import {
  FRECUENCIAS_VERIFICACION,
  VIGENCIA,
  everyMonthsLabel,
  formatDate,
  occurrenceWhen,
  periodLabel,
} from '../domain/format';
import { Dropdown } from './Dropdown';
import { AlertFields, DatePreview, ResponsableSelect } from './fields';
import { EquipmentHistory } from './EquipmentHistory';
import { useEquipmentHistory } from '../hooks/useEquipmentHistory';
import {
  BlockTitle,
  CancelButton,
  DangerButton,
  FieldLabel,
  Glyph,
  Modal,
  ModalColumns,
  ModalSection,
  PrimaryButton,
  Segmented,
  Switch,
  ToneBadge,
} from './primitives';

const FREQUENCY_OPTIONS = FRECUENCIAS_VERIFICACION.map(meses => ({ value: meses, label: everyMonthsLabel(meses) }));

const pickAlert = (config) => ({
  alertaDias: config?.alertaDias ?? null,
  alertaFrecuencia: config?.alertaFrecuencia ?? null,
  alertaCorreo: config?.alertaCorreo ?? null,
});

const verificationState = (config) => ({
  activo: Boolean(config?.activo),
  frecuenciaMeses: config?.frecuenciaMeses || 6,
  desde: config?.fechaInicio ? 'FECHA' : 'CALIBRACION',
  fechaInicio: config?.fechaInicio || '',
});

const verificationPayload = (value) => ({
  activo: value.activo,
  frecuenciaMeses: value.frecuenciaMeses,
  fechaInicio: value.desde === 'FECHA' ? value.fechaInicio : null,
});

const previewRequest = (equipoId, value) => (
  !value.activo || (value.desde === 'FECHA' && !value.fechaInicio) ? null : {
    tipo: 'VERIFICACION',
    equipoId,
    frecuenciaMeses: value.frecuenciaMeses,
    fechaInicio: value.desde === 'FECHA' ? value.fechaInicio : null,
  }
);

function VerificationFields({ value, onChange, disabled, idPrefix }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${idPrefix}-frecuencia`}>Frecuencia</FieldLabel>
          <Dropdown
            id={`${idPrefix}-frecuencia`}
            value={value.frecuenciaMeses}
            onChange={(frecuenciaMeses) => onChange({ ...value, frecuenciaMeses: Number(frecuenciaMeses) })}
            options={FREQUENCY_OPTIONS}
            ariaLabel="Frecuencia de la verificación"
            disabled={disabled}
          />
        </div>
        <div>
          <p className="field-label">Contar desde</p>
          <Segmented
            label="Contar desde"
            value={value.desde}
            onChange={(desde) => onChange({ ...value, desde })}
            options={[{ value: 'CALIBRACION', label: 'La calibración' }, { value: 'FECHA', label: 'Una fecha' }]}
            disabled={disabled}
            className="cal-segmented-fill h-11"
          />
        </div>
      </div>
      {value.desde === 'FECHA' ? (
        <div>
          <FieldLabel htmlFor={`${idPrefix}-inicio`}>Primera verificación</FieldLabel>
          <input
            id={`${idPrefix}-inicio`}
            type="date"
            value={value.fechaInicio}
            onChange={(event) => onChange({ ...value, fechaInicio: event.target.value })}
            disabled={disabled}
            className="field h-11 font-medium tabular-nums sm:w-60"
          />
        </div>
      ) : (
        <p className="cal-hint">
          Se repite {everyMonthsLabel(value.frecuenciaMeses).toLowerCase()} a partir de cada calibración y se omite si coincide con la recalibración.
        </p>
      )}
    </div>
  );
}

const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-sm font-semibold text-fg shadow-xs transition-colors hover:border-fg/25 hover:bg-surface-2';

/** Revisión del certificado vigente por un segundo usuario (NB/ISO/IEC 17025, 7.5.1). */
function CertificateReview({ revision, canEdit, onRevisar }) {
  if (!revision) return null;
  if (revision.estado === 'REVISADO') {
    return (
      <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] leading-snug">
        <ShieldCheck className="mt-px h-[18px] w-[18px] flex-none text-success" aria-hidden="true" />
        <span className="min-w-0">
          <span className="font-semibold text-fg">Revisado por {revision.revisadoPor}</span>
          <span className="block text-xs text-fg-muted">
            Comparado con el original{revision.revisadoEn ? ` el ${formatDate(revision.revisadoEn.slice(0, 10))}` : ''}
            {revision.observaciones ? ` · ${revision.observaciones}` : ''}
          </span>
        </span>
      </p>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-3">
      <p className="text-[13px] font-semibold text-fg">Pendiente de revisión</p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">
        Otra persona debe comparar estos datos con el certificado original.
      </p>
      {canEdit && (revision.puedeRevisar ? (
        <button type="button" onClick={onRevisar} className={`${secondaryButton} mt-3`}>
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Revisar certificado
        </button>
      ) : (
        <p className="mt-2 text-xs text-fg-subtle">{revision.motivo}</p>
      ))}
    </div>
  );
}

/**
 * Ficha de un equipo: su plan (calibración y verificación interna), el
 * certificado vigente con sus acciones y el historial completo.
 */
export function EquipmentModal({
  equipo,
  ajustes,
  personal,
  canEdit,
  historyVersion,
  onClose,
  onSaved,
  onRegistrarCertificado,
  onCorregirCertificado,
  onRevisarCertificado,
  onAnularCertificado,
  onEditarDatos,
  onDarDeBaja,
}) {
  const baseId = useId();
  const [calibracion, setCalibracion] = useState(() => ({
    activo: equipo.enPlan,
    responsableId: equipo.calibracion?.responsableId ?? null,
    ...pickAlert(equipo.calibracion),
  }));
  const [verificacion, setVerificacion] = useState(() => verificationState(equipo.verificacion));
  const [verResponsable, setVerResponsable] = useState(equipo.verificacion?.responsableId ?? null);
  const [verAlerta, setVerAlerta] = useState(() => pickAlert(equipo.verificacion));
  const [saving, setSaving] = useState(false);
  const disabled = !canEdit || saving;
  const vigencia = VIGENCIA[equipo.vigencia] || VIGENCIA.SIN_DATOS;
  const history = useEquipmentHistory(equipo.id, historyVersion);

  const save = async (close) => {
    if (verificacion.activo && verificacion.desde === 'FECHA' && !verificacion.fechaInicio) {
      toast.error('Indica la fecha de la primera verificación.');
      return;
    }
    setSaving(true);
    try {
      await calibrationApi.saveEquipo(equipo.id, {
        calibracion,
        verificacion: { ...verificationPayload(verificacion), responsableId: verResponsable, ...verAlerta },
      });
      toast.success(`Plan de ${equipo.codigo} actualizado`);
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={equipo.codigo}
      subtitle={(
        <>
          <span className="font-medium text-fg">{equipo.instrumento}</span>
          <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
          <span>{equipo.planta}</span>
        </>
      )}
      busy={saving}
      actions={canEdit && (
        <button
          type="button"
          onClick={onEditarDatos}
          aria-label="Editar datos del equipo"
          title="Editar datos del equipo"
          className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Editar datos</span>
        </button>
      )}
      footer={(close) => (
        <>
          {canEdit && (
            <DangerButton onClick={onDarDeBaja} disabled={saving} label="Dar de baja">
              <PowerOff className="h-4 w-4" />
              <span className="hidden sm:inline">Dar de baja</span>
            </DangerButton>
          )}
          <div className="ml-auto flex items-center gap-2">
            {canEdit ? (
              <>
                <CancelButton onClick={close} disabled={saving} />
                <PrimaryButton onClick={() => save(close)} busy={saving}>Guardar plan</PrimaryButton>
              </>
            ) : (
              <CancelButton onClick={close}>Cerrar</CancelButton>
            )}
          </div>
        </>
      )}
    >
      <ModalColumns>
        <ModalSection title="Plan del equipo" description="Qué se programa, quién responde y cuándo se avisa.">
          <BlockTitle leading={<Glyph tipo="CALIBRACION" size={10} />}>Calibración</BlockTitle>
          <div className="space-y-4">
            <Switch
              label="Incluir en el plan anual"
              description="La próxima calibración es la fecha de vencimiento del certificado."
              checked={calibracion.activo}
              onChange={(activo) => setCalibracion(current => ({ ...current, activo }))}
              disabled={disabled}
            />
            {calibracion.activo && (
              <>
                <div>
                  <FieldLabel htmlFor={`${baseId}-cal-resp`}>Responsable</FieldLabel>
                  <ResponsableSelect
                    id={`${baseId}-cal-resp`}
                    value={calibracion.responsableId}
                    fallbackName={equipo.calibracion?.responsableNombre}
                    onChange={(responsableId) => setCalibracion(current => ({ ...current, responsableId }))}
                    personal={personal}
                    disabled={disabled}
                  />
                </div>
                <AlertFields
                  value={calibracion}
                  onChange={(alerta) => setCalibracion(current => ({ ...current, ...alerta }))}
                  ajustes={ajustes}
                  disabled={disabled}
                />
              </>
            )}
          </div>

          <div className="my-6 h-px bg-line" />

          <BlockTitle leading={<Glyph tipo="VERIFICACION" size={10} />}>Verificación interna</BlockTitle>
          <div className="space-y-4">
            <Switch
              label="Programar verificación interna"
              description="Comprobaciones intermedias entre calibraciones."
              checked={verificacion.activo}
              onChange={(activo) => setVerificacion(current => ({ ...current, activo }))}
              disabled={disabled}
            />
            {verificacion.activo && (
              <>
                <VerificationFields value={verificacion} onChange={setVerificacion} disabled={disabled} idPrefix={`${baseId}-ver`} />
                <div>
                  <FieldLabel htmlFor={`${baseId}-ver-resp`}>Responsable</FieldLabel>
                  <ResponsableSelect
                    id={`${baseId}-ver-resp`}
                    value={verResponsable}
                    fallbackName={equipo.verificacion?.responsableNombre}
                    onChange={setVerResponsable}
                    personal={personal}
                    disabled={disabled}
                  />
                </div>
                <AlertFields value={verAlerta} onChange={setVerAlerta} ajustes={ajustes} disabled={disabled} />
              </>
            )}
          </div>
        </ModalSection>

        <ModalSection
          aside
          title="Certificado vigente"
          description="Datos registrados en los equipos de calibración."
          action={<ToneBadge tone={vigencia.tone}>{vigencia.label}</ToneBadge>}
        >
          <dl className="cal-facts">
            <div className="col-span-full">
              <dt>Número</dt>
              <dd>{equipo.certificado || 'Sin certificado registrado'}</dd>
            </div>
            <div>
              <dt>Emitido</dt>
              <dd>{formatDate(equipo.certFecha)}</dd>
            </div>
            <div>
              <dt>Vence</dt>
              <dd className={equipo.vigencia === 'VENCIDO' ? 'text-danger' : undefined}>{formatDate(equipo.vence)}</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>{periodLabel(equipo.periodoDias)}{equipo.periodoDias ? ` (${equipo.periodoDias} días)` : ''}</dd>
            </div>
            <div>
              <dt>Ente calibrador</dt>
              <dd>{equipo.enteCalibrador || '—'}</dd>
            </div>
            {equipo.enPlan && equipo.proximaCalibracion && (
              <div className="col-span-full">
                <dt>Próxima calibración</dt>
                <dd>
                  {formatDate(equipo.proximaCalibracion.fechaPlan)}
                  <span className="ml-1.5 font-normal text-fg-muted">· {occurrenceWhen(equipo.proximaCalibracion)}</span>
                </dd>
              </div>
            )}
          </dl>
          {equipo.certFecha && (
            <CertificateReview revision={history.data?.revision} canEdit={canEdit} onRevisar={onRevisarCertificado} />
          )}
          {canEdit && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={onRegistrarCertificado} className={secondaryButton}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                {equipo.certFecha ? 'Registrar certificado nuevo' : 'Registrar primer certificado'}
              </button>
            </div>
          )}
          <p className="cal-hint mt-4">
            El vencimiento se calcula como emisión + vigencia. Al registrar un certificado nuevo, el anterior pasa al historial y el plan se recalcula.
          </p>
          {verificacion.activo && (
            <div className="mt-5">
              <DatePreview title="Próximas verificaciones" request={previewRequest(equipo.id, verificacion)} />
            </div>
          )}

          {(equipo.observaciones || equipo.registradoPor) && (
            <dl className="cal-facts mt-6 border-t border-line pt-5">
              {equipo.observaciones && (
                <div className="col-span-full">
                  <dt>Observaciones del equipo</dt>
                  <dd className="whitespace-pre-line font-normal">{equipo.observaciones}</dd>
                </div>
              )}
              {equipo.registradoPor && (
                <div className="col-span-full">
                  <dt>Último registro</dt>
                  <dd className="font-normal">
                    {equipo.registradoPor}{equipo.registradoEn ? ` · ${formatDate(equipo.registradoEn)}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className="mt-6 border-t border-line pt-5">
            <EquipmentHistory
              historial={history.data}
              loading={history.loading}
              error={history.error}
              canEdit={canEdit}
              onCorregir={onCorregirCertificado}
              onAnular={onAnularCertificado}
            />
          </div>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}

/** Ficha para dar la misma configuración a varios equipos. */
export function BulkEquipmentModal({ equipos, ajustes, personal, onClose, onSaved }) {
  const baseId = useId();
  const [applyVerification, setApplyVerification] = useState(false);
  const [verificacion, setVerificacion] = useState(() => ({ ...verificationState(null), activo: true }));
  const [applyResponsable, setApplyResponsable] = useState(false);
  const [responsableId, setResponsableId] = useState(null);
  const [applyAlert, setApplyAlert] = useState(false);
  const [alerta, setAlerta] = useState({ alertaDias: null, alertaFrecuencia: null, alertaCorreo: null });
  const [saving, setSaving] = useState(false);

  const codes = useMemo(() => equipos.map(equipo => equipo.codigo), [equipos]);
  const nothing = !applyVerification && !applyResponsable && !applyAlert;

  const save = async (close) => {
    if (applyVerification && verificacion.activo && verificacion.desde === 'FECHA' && !verificacion.fechaInicio) {
      toast.error('Indica la fecha de la primera verificación.');
      return;
    }
    setSaving(true);
    try {
      await calibrationApi.saveEquipos({
        equipoIds: equipos.map(equipo => equipo.id),
        ...(applyVerification ? { verificacion: verificationPayload(verificacion) } : {}),
        ...(applyResponsable ? { responsableId } : {}),
        ...(applyAlert ? { alerta } : {}),
      });
      toast.success(`${equipos.length} equipos actualizados`);
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Configurar ${equipos.length} equipos`}
      subtitle="Solo se cambia lo que actives; el resto de cada equipo se conserva."
      busy={saving}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => save(close)} busy={saving} disabled={nothing}>
            Aplicar a {equipos.length}
          </PrimaryButton>
        </div>
      )}
    >
      <ModalColumns>
        <ModalSection title="Cambios" description="Activa lo que quieras aplicar a todos los equipos elegidos.">
          <Switch
            label="Cambiar la verificación interna"
            description="Activa, desactiva o ajusta su frecuencia."
            checked={applyVerification}
            onChange={setApplyVerification}
          />
          {applyVerification && (
            <div className="mt-4 space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-xs">
              <Switch
                label="Programar verificación interna"
                checked={verificacion.activo}
                onChange={(activo) => setVerificacion(current => ({ ...current, activo }))}
              />
              {verificacion.activo && (
                <VerificationFields value={verificacion} onChange={setVerificacion} idPrefix={`${baseId}-ver`} />
              )}
            </div>
          )}

          <div className="my-5 h-px bg-line" />

          <Switch
            label="Cambiar el responsable"
            description="Para la calibración y la verificación de cada equipo."
            checked={applyResponsable}
            onChange={setApplyResponsable}
          />
          {applyResponsable && (
            <div className="mt-4">
              <FieldLabel htmlFor={`${baseId}-resp`}>Responsable</FieldLabel>
              <ResponsableSelect id={`${baseId}-resp`} value={responsableId} onChange={setResponsableId} personal={personal} />
            </div>
          )}

          <div className="my-5 h-px bg-line" />

          <Switch
            label="Cambiar los avisos"
            description="Por ejemplo: empezar a avisar un mes antes."
            checked={applyAlert}
            onChange={setApplyAlert}
          />
          {applyAlert && (
            <div className="mt-4">
              <AlertFields value={alerta} onChange={setAlerta} ajustes={ajustes} />
            </div>
          )}
        </ModalSection>

        <ModalSection aside title="Equipos seleccionados" description={`${equipos.length} equipos recibirán los cambios.`}>
          <ul className="flex flex-wrap gap-1.5" aria-label="Equipos seleccionados">
            {codes.map(code => (
              <li key={code} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium tabular-nums text-fg shadow-xs">
                {code}
              </li>
            ))}
          </ul>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}
