import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, FilePlus2, Info, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { calibrationApi } from '../api/calibration';
import {
  ACCIONES_FECHA,
  TIPOS,
  alertSummary,
  capitalize,
  formatDate,
  formatLongDate,
  occurrenceTitle,
  occurrenceWhen,
  periodLabel,
  situationLabel,
} from '../domain/format';
import { HistoryList } from './HistoryList';
import { ReasonModal } from './ReasonModal';
import {
  CancelButton,
  FieldLabel,
  Glyph,
  Modal,
  ModalColumns,
  ModalSection,
  PrimaryButton,
  Segmented,
  StatusBadge,
} from './primitives';

const ESTADOS = [
  { value: 'PROGRAMADO', label: 'Programada' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'REALIZADO', label: 'Realizada' },
  { value: 'CANCELADO', label: 'Cancelada' },
];

const dateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
  : null);

const sameUser = (a, b) => Boolean(a && b) && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();

function Note({ children }) {
  return (
    <p className="flex gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">
      <Info className="mt-0.5 h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function Fact({ label, children, wide = false, className }) {
  return (
    <div className={wide ? 'col-span-full' : undefined}>
      <dt>{label}</dt>
      <dd className={className}>{children}</dd>
    </div>
  );
}

/** Versiones guardadas de una fecha, de la más reciente a la primera. */
function useEventHistory(occurrence, version) {
  const enabled = occurrence.editable && occurrence.origen !== 'CERTIFICADO';
  const [state, setState] = useState({ items: null, error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    calibrationApi.eventoHistorial(occurrence)
      .then(items => { if (active) setState({ items, error: null }); })
      .catch(error => { if (active) setState({ items: null, error }); });
    return () => { active = false; };
  }, [enabled, occurrence, version]);
  return { enabled, ...state };
}

/**
 * Ficha de una fecha del plan: su detalle y el seguimiento (realizada,
 * reprogramada…). Lo ya registrado como realizado solo se cambia con motivo;
 * una verificación realizada lleva su hoja de datos y la revisa otra persona.
 */
export function EventModal({ occurrence, equipo, hoy, canEdit, usuario, onClose, onSaved, onOpenEquipo, onOpenActividad, onRegistrarCertificado }) {
  const baseId = useId();
  const editable = canEdit && occurrence.editable;
  const isVerification = occurrence.tipo === 'VERIFICACION';
  const original = {
    estado: occurrence.estado,
    fechaRealizada: occurrence.fechaRealizada || (occurrence.fechaPlan <= hoy ? occurrence.fechaPlan : hoy),
    fechaReprogramada: occurrence.fechaReprogramada || '',
    resultado: occurrence.resultado || '',
    registroRef: occurrence.registroRef || '',
    observaciones: occurrence.observaciones || '',
  };
  const [estado, setEstado] = useState(original.estado);
  const [fechaRealizada, setFechaRealizada] = useState(original.fechaRealizada);
  const [fechaReprogramada, setFechaReprogramada] = useState(original.fechaReprogramada);
  const [resultado, setResultado] = useState(original.resultado);
  const [registroRef, setRegistroRef] = useState(original.registroRef);
  const [observaciones, setObservaciones] = useState(original.observaciones);
  const [motivo, setMotivo] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [revisado, setRevisado] = useState(occurrence.revisadoPor ? { por: occurrence.revisadoPor, en: occurrence.revisadoEn } : null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const resetDone = useRef(false);
  const history = useEventHistory(occurrence, historyVersion);

  const tipo = TIPOS[occurrence.tipo];
  const isEquipment = occurrence.tipo !== 'ACTIVIDAD';
  const pendiente = estado === 'PROGRAMADO' || estado === 'EN_PROCESO';
  const realizada = estado === 'REALIZADO';
  const openConfig = isEquipment ? onOpenEquipo : onOpenActividad;
  // La calibración se cierra con el certificado: registrarlo recalcula el plan.
  const puedeRegistrarCertificado = editable && onRegistrarCertificado && occurrence.tipo === 'CALIBRACION'
    && !occurrence.proyectado && !['REALIZADO', 'CANCELADO'].includes(occurrence.situacion);

  // Lo que ya figuraba como realizado es un registro técnico: cambiarlo pide motivo.
  const registrada = occurrence.guardado && occurrence.estado === 'REALIZADO';
  const dirty = estado !== original.estado
    || observaciones.trim() !== original.observaciones
    || (realizada && (fechaRealizada !== original.fechaRealizada || resultado !== original.resultado || registroRef.trim() !== original.registroRef))
    || (pendiente && fechaReprogramada !== original.fechaReprogramada);
  const needsMotivo = registrada && dirty;

  const errors = {
    resultado: realizada && isVerification && !resultado ? 'Indica el resultado de la verificación.' : null,
    registroRef: realizada && isVerification && !registroRef.trim() ? 'Indica la hoja o el archivo con los datos de la verificación.' : null,
    motivo: needsMotivo && motivo.trim().length < 3 ? 'Escribe el motivo del cambio (al menos 3 caracteres).' : null,
  };

  const save = async (close) => {
    setAttempted(true);
    if (realizada && !fechaRealizada) {
      toast.error('Indica la fecha en que se realizó.');
      return;
    }
    const firstError = Object.values(errors).find(Boolean);
    if (firstError) {
      toast.error(firstError);
      return;
    }
    if (!dirty) {
      close();
      return;
    }
    setSaving(true);
    try {
      await calibrationApi.saveEvento({
        serie: occurrence.serie,
        fechaProgramada: occurrence.fechaProgramada,
        estado,
        fechaReprogramada: pendiente && fechaReprogramada && fechaReprogramada !== occurrence.fechaProgramada ? fechaReprogramada : null,
        fechaRealizada: realizada ? fechaRealizada : null,
        resultado: realizada && isVerification && resultado ? resultado : null,
        registroRef: realizada && isVerification ? registroRef.trim() : null,
        observaciones: observaciones.trim() || null,
        motivo: needsMotivo ? motivo.trim() : null,
      });
      toast.success('Cambios guardados');
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
      setSaving(false);
    }
  };

  const review = async () => {
    setSaving(true);
    try {
      const result = await calibrationApi.revisarEvento(occurrence);
      setRevisado({ por: result?.data?.revisadoPor || usuario, en: new Date().toISOString() });
      setHistoryVersion(value => value + 1);
      toast.success('Revisión registrada');
      onSaved();
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar la revisión.');
    }
    setSaving(false);
  };

  const whenTone = occurrence.situacion === 'VENCIDO'
    ? 'text-danger'
    : occurrence.situacion === 'PROXIMO' ? 'text-warning' : 'text-fg-muted';
  const autorPropio = sameUser(usuario, occurrence.actualizadoPor);
  const showReview = isVerification && occurrence.guardado && occurrence.estado === 'REALIZADO';

  return (
    <>
      <Modal
        onClose={onClose}
        title={occurrenceTitle(occurrence)}
        subtitle={(
          <>
            <span className="font-medium text-fg">{tipo.label}</span>
            <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
            <span>{capitalize(formatLongDate(occurrence.fechaPlan))}</span>
          </>
        )}
        busy={saving}
        footer={(close) => (editable ? (
          <>
            {occurrence.guardado && (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                disabled={saving}
                title="Volver a la programación original; lo registrado queda en el historial"
                aria-label="Restablecer la fecha"
                className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Restablecer</span>
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <CancelButton onClick={close} disabled={saving} />
              <PrimaryButton onClick={() => save(close)} busy={saving}>Guardar cambios</PrimaryButton>
            </div>
          </>
        ) : (
          <div className="ml-auto">
            <CancelButton onClick={close}>Cerrar</CancelButton>
          </div>
        ))}
      >
        <ModalColumns>
          <ModalSection
            title="Detalle"
            description={isEquipment
              ? [occurrence.instrumento, occurrence.planta].filter(Boolean).join(' · ')
              : (occurrence.categoria || 'Actividad del área')}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Glyph tipo={occurrence.tipo} situacion={occurrence.situacion} proyectado={occurrence.proyectado} size={12} />
              <StatusBadge situacion={occurrence.situacion} tipo={occurrence.tipo} proyectado={occurrence.proyectado} />
              {occurrence.estado === 'EN_PROCESO' && occurrence.situacion === 'VENCIDO' && (
                <StatusBadge situacion="EN_PROCESO" tipo={occurrence.tipo} />
              )}
              {occurrence.situacion !== 'REALIZADO' && occurrence.situacion !== 'CANCELADO' && (
                <span className={cn('text-[13px] font-medium', whenTone)}>{occurrenceWhen(occurrence)}</span>
              )}
            </div>

            <dl className="cal-facts mt-5">
              <Fact label={occurrence.origen === 'CERTIFICADO' ? 'Emisión del certificado' : 'Fecha programada'} wide>
                {capitalize(formatLongDate(occurrence.fechaProgramada))}
              </Fact>
              {occurrence.fechaReprogramada && (
                <Fact label="Reprogramada para" wide>{capitalize(formatLongDate(occurrence.fechaReprogramada))}</Fact>
              )}
              {occurrence.estado === 'REALIZADO' && occurrence.origen !== 'CERTIFICADO' && (
                <Fact label="Realizada el">{formatDate(occurrence.fechaRealizada)}</Fact>
              )}
              {occurrence.resultado && (
                <Fact label="Resultado" className={occurrence.resultado === 'CONFORME' ? 'text-success' : 'text-danger'}>
                  {occurrence.resultado === 'CONFORME' ? 'Conforme' : 'No conforme'}
                </Fact>
              )}
              {occurrence.registroRef && <Fact label="Hoja de datos" wide>{occurrence.registroRef}</Fact>}
              <Fact label="Responsable">{occurrence.responsableNombre || 'Sin asignar'}</Fact>
              <Fact label="Aviso">{alertSummary(occurrence.alerta)}</Fact>
              {occurrence.tipo === 'CALIBRACION' && equipo && (
                <>
                  <Fact label="Certificado vigente" wide>{equipo.certificado || '—'}</Fact>
                  <Fact label="Ente calibrador">{equipo.enteCalibrador || '—'}</Fact>
                  <Fact label="Vigencia">{periodLabel(equipo.periodoDias)}</Fact>
                </>
              )}
              {occurrence.descripcion && <Fact label="Descripción" wide>{occurrence.descripcion}</Fact>}
            </dl>

            <div className="mt-5 flex flex-col gap-2">
              {occurrence.proyectado && (
                <Note>Fecha estimada: depende de que la calibración anterior se realice a tiempo. No genera avisos hasta entonces.</Note>
              )}
              {occurrence.origen === 'CERTIFICADO' && (
                <Note>Esta fecha sale del certificado registrado en los equipos de calibración y no se edita desde el cronograma.</Note>
              )}
              {occurrence.tipo === 'CALIBRACION' && occurrence.origen !== 'CERTIFICADO' && (
                <Note>Al registrar el nuevo certificado del equipo, el plan se recalcula solo desde la nueva fecha de emisión.</Note>
              )}
            </div>

            {openConfig && (
              <button
                type="button"
                onClick={openConfig}
                className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg underline decoration-fg/30 underline-offset-4 transition-colors hover:decoration-fg"
              >
                {isEquipment ? 'Ver la configuración del equipo' : 'Ver la actividad'}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            {history.enabled && (history.items?.length > 0 || history.error) && (
              <section aria-label="Historial de esta fecha" className="mt-7 border-t border-line pt-5">
                <h4 className="mb-2.5 text-[13px] font-semibold text-fg">Historial de esta fecha</h4>
                {history.error ? (
                  <p className="text-[13px] text-danger" role="alert">No se pudo cargar el historial: {history.error.message}</p>
                ) : (
                  <HistoryList
                    items={history.items.map(item => ({
                      ...item,
                      title: ACCIONES_FECHA[item.accion] || item.accion,
                    }))}
                  />
                )}
              </section>
            )}
            {history.enabled && !history.items && !history.error && occurrence.guardado && (
              <p className="mt-7 flex items-center gap-2 border-t border-line pt-5 text-[13px] text-fg-muted" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando historial…
              </p>
            )}
          </ModalSection>

          <ModalSection
            aside
            title="Seguimiento"
            description={editable ? 'Registra qué pasó con esta fecha.' : 'Estado registrado de esta fecha.'}
          >
            {puedeRegistrarCertificado && (
              <div className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-xs">
                <p className="text-[13px] font-semibold text-fg">¿Ya llegó el certificado?</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">
                  Regístralo y la calibración queda realizada: el plan se recalcula desde la nueva emisión.
                </p>
                <button
                  type="button"
                  onClick={onRegistrarCertificado}
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-colors hover:bg-brand-hover"
                >
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Registrar certificado
                </button>
              </div>
            )}
            {editable ? (
              <div className="space-y-5">
                <Segmented label="Estado" value={estado} onChange={setEstado} options={ESTADOS} className="cal-segmented-fill" />

                {realizada && (
                  <div className="space-y-4">
                    <div>
                      <FieldLabel htmlFor={`${baseId}-realizada`}>Fecha de realización</FieldLabel>
                      <input
                        id={`${baseId}-realizada`}
                        type="date"
                        value={fechaRealizada}
                        max={hoy}
                        onChange={(event) => setFechaRealizada(event.target.value)}
                        className="field h-11 font-medium tabular-nums"
                      />
                    </div>
                    {isVerification && (
                      <>
                        <div>
                          <p className="field-label">Resultado</p>
                          <Segmented
                            label="Resultado"
                            value={resultado}
                            onChange={setResultado}
                            options={[{ value: 'CONFORME', label: 'Conforme' }, { value: 'NO_CONFORME', label: 'No conforme' }]}
                            className="cal-segmented-fill"
                          />
                          {attempted && errors.resultado && <p className="field-error">{errors.resultado}</p>}
                        </div>
                        <div>
                          <FieldLabel htmlFor={`${baseId}-ref`}>Hoja de datos de la verificación</FieldLabel>
                          <input
                            id={`${baseId}-ref`}
                            type="text"
                            value={registroRef}
                            maxLength={150}
                            onChange={(event) => setRegistroRef(event.target.value)}
                            placeholder="Código o archivo, ej.: RV-F1-202-2026-01"
                            aria-invalid={attempted && errors.registroRef ? true : undefined}
                            className={cn('field h-11', attempted && errors.registroRef && 'field-invalid')}
                          />
                          {attempted && errors.registroRef
                            ? <p className="field-error">{errors.registroRef}</p>
                            : <p className="cal-hint mt-1.5">Donde quedaron las lecturas, el patrón usado y las condiciones.</p>}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {pendiente && (
                  <div>
                    <FieldLabel htmlFor={`${baseId}-reprogramar`} hint="(opcional)">Reprogramar para</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input
                        id={`${baseId}-reprogramar`}
                        type="date"
                        value={fechaReprogramada}
                        onChange={(event) => setFechaReprogramada(event.target.value)}
                        className="field h-11 font-medium tabular-nums"
                      />
                      {fechaReprogramada && (
                        <button
                          type="button"
                          onClick={() => setFechaReprogramada('')}
                          className="h-11 shrink-0 rounded-xl px-3 text-[13px] font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    {fechaReprogramada && fechaReprogramada !== occurrence.fechaProgramada && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-muted">
                        {formatDate(occurrence.fechaProgramada)} <ArrowRight className="h-3 w-3" aria-hidden="true" /> {formatDate(fechaReprogramada)}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor={`${baseId}-obs`} hint="(opcional)">Observaciones</FieldLabel>
                    <span className="mb-1.5 text-xs tabular-nums text-fg-subtle">{observaciones.length}/500</span>
                  </div>
                  <textarea
                    id={`${baseId}-obs`}
                    value={observaciones}
                    maxLength={500}
                    onChange={(event) => setObservaciones(event.target.value)}
                    placeholder={occurrence.tipo === 'CALIBRACION' ? 'Ej.: enviado a IBMETRO el 3 de octubre' : 'Hallazgos, acciones o pendientes…'}
                    className="field min-h-[112px] resize-y py-3 leading-relaxed"
                  />
                </div>

                {needsMotivo && (
                  <div className="rounded-2xl border border-warning/35 bg-warning/[0.06] p-4">
                    <FieldLabel htmlFor={`${baseId}-motivo`}>Motivo del cambio</FieldLabel>
                    <p className="-mt-0.5 mb-2 text-[12.5px] leading-snug text-fg-muted">
                      Esta fecha ya figuraba como realizada. La versión anterior queda en el historial con este motivo.
                    </p>
                    <textarea
                      id={`${baseId}-motivo`}
                      value={motivo}
                      maxLength={300}
                      onChange={(event) => setMotivo(event.target.value)}
                      placeholder="Ej.: se cargó el resultado de otra pesa"
                      aria-invalid={attempted && errors.motivo ? true : undefined}
                      className={cn('field min-h-[80px] resize-y py-3 leading-relaxed', attempted && errors.motivo && 'field-invalid')}
                    />
                    {attempted && errors.motivo && <p className="field-error">{errors.motivo}</p>}
                  </div>
                )}
              </div>
            ) : (
              <dl className="cal-facts">
                <Fact label="Estado" wide>{situationLabel(occurrence.situacion, occurrence.tipo)}</Fact>
                <Fact label="Observaciones" wide className="whitespace-pre-line font-normal">
                  {occurrence.observaciones || 'Sin observaciones.'}
                </Fact>
              </dl>
            )}

            {showReview && (
              <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-xs">
                {revisado ? (
                  <p className="flex items-start gap-2.5 text-[13px] leading-snug">
                    <ShieldCheck className="mt-px h-[18px] w-[18px] flex-none text-success" aria-hidden="true" />
                    <span>
                      <span className="font-semibold text-fg">Revisada por {revisado.por}</span>
                      {revisado.en && <span className="block text-xs text-fg-muted">{dateTime(revisado.en)}</span>}
                    </span>
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] font-semibold text-fg">Pendiente de revisión</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">
                      Otra persona confirma que los datos coinciden con la hoja de la verificación.
                    </p>
                    {canEdit && (autorPropio ? (
                      <p className="mt-2.5 text-xs text-fg-subtle">La registraste tú: debe revisarla otra persona.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={review}
                        disabled={saving || dirty}
                        title={dirty ? 'Guarda o descarta los cambios antes de revisar' : undefined}
                        className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-sm font-semibold text-fg shadow-xs transition-colors hover:border-fg/25 hover:bg-surface-2 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Confirmar revisión
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {occurrence.actualizadoPor && (
              <div className="mt-5 flex items-start gap-2 text-xs leading-4 text-fg-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <p>
                  Última edición por <span className="font-medium text-fg">{occurrence.actualizadoPor}</span>
                  {occurrence.actualizadoEn && (
                    <>
                      <span aria-hidden="true"> · </span>
                      {dateTime(occurrence.actualizadoEn)}
                    </>
                  )}
                </p>
              </div>
            )}
          </ModalSection>
        </ModalColumns>
      </Modal>

      {confirmReset && (
        <ReasonModal
          title="Restablecer la fecha"
          subtitle={occurrenceTitle(occurrence)}
          heading="Vuelve a su programación original"
          description="Se quita lo registrado en esta fecha. La versión actual queda en el historial con el motivo."
          confirmLabel="Restablecer"
          requireReason={registrada}
          reasonPlaceholder="Ej.: se registró en el equipo equivocado"
          onClose={() => {
            setConfirmReset(false);
            if (resetDone.current) onClose();
          }}
          onConfirm={async (reason) => {
            await calibrationApi.resetEvento({ ...occurrence, motivo: reason });
            resetDone.current = true;
            toast.success('La fecha volvió a su programación original');
            onSaved();
          }}
        />
      )}
    </>
  );
}
