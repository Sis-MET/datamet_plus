import { useId, useState } from 'react';
import { ArrowRight, Info, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { calibrationApi } from '../api/calibration';
import {
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

/** Ficha de una fecha del plan: su detalle y el seguimiento (realizada, reprogramada…). */
export function EventModal({ occurrence, equipo, hoy, canEdit, onClose, onSaved, onOpenEquipo, onOpenActividad }) {
  const baseId = useId();
  const editable = canEdit && occurrence.editable;
  const [estado, setEstado] = useState(occurrence.estado);
  const [fechaRealizada, setFechaRealizada] = useState(
    occurrence.fechaRealizada || (occurrence.fechaPlan <= hoy ? occurrence.fechaPlan : hoy)
  );
  const [fechaReprogramada, setFechaReprogramada] = useState(occurrence.fechaReprogramada || '');
  const [resultado, setResultado] = useState(occurrence.resultado || '');
  const [observaciones, setObservaciones] = useState(occurrence.observaciones || '');
  const [saving, setSaving] = useState(false);

  const tipo = TIPOS[occurrence.tipo];
  const isEquipment = occurrence.tipo !== 'ACTIVIDAD';
  const pendiente = estado === 'PROGRAMADO' || estado === 'EN_PROCESO';
  const openConfig = isEquipment ? onOpenEquipo : onOpenActividad;

  const save = async (close) => {
    if (estado === 'REALIZADO' && !fechaRealizada) {
      toast.error('Indica la fecha en que se realizó.');
      return;
    }
    setSaving(true);
    try {
      await calibrationApi.saveEvento({
        serie: occurrence.serie,
        fechaProgramada: occurrence.fechaProgramada,
        estado,
        fechaReprogramada: pendiente && fechaReprogramada && fechaReprogramada !== occurrence.fechaProgramada ? fechaReprogramada : null,
        fechaRealizada: estado === 'REALIZADO' ? fechaRealizada : null,
        resultado: estado === 'REALIZADO' && occurrence.tipo === 'VERIFICACION' && resultado ? resultado : null,
        observaciones: observaciones.trim() || null,
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

  const reset = async (close) => {
    setSaving(true);
    try {
      await calibrationApi.resetEvento(occurrence);
      toast.success('La fecha volvió a su programación original');
      setSaving(false);
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo restablecer.');
      setSaving(false);
    }
  };

  const whenTone = occurrence.situacion === 'VENCIDO'
    ? 'text-danger'
    : occurrence.situacion === 'PROXIMO' ? 'text-warning' : 'text-fg-muted';

  return (
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
              onClick={() => reset(close)}
              disabled={saving}
              title="Quitar los cambios guardados de esta fecha"
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
        </ModalSection>

        <ModalSection
          aside
          title="Seguimiento"
          description={editable ? 'Registra qué pasó con esta fecha.' : 'Estado registrado de esta fecha.'}
        >
          {editable ? (
            <div className="space-y-5">
              <Segmented label="Estado" value={estado} onChange={setEstado} options={ESTADOS} className="cal-segmented-fill" />

              {estado === 'REALIZADO' && (
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
                  {occurrence.tipo === 'VERIFICACION' && (
                    <div>
                      <p className="field-label">Resultado</p>
                      <Segmented
                        label="Resultado"
                        value={resultado}
                        onChange={(value) => setResultado(current => (current === value ? '' : value))}
                        options={[{ value: 'CONFORME', label: 'Conforme' }, { value: 'NO_CONFORME', label: 'No conforme' }]}
                        className="cal-segmented-fill"
                      />
                    </div>
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
            </div>
          ) : (
            <dl className="cal-facts">
              <Fact label="Estado" wide>{situationLabel(occurrence.situacion, occurrence.tipo)}</Fact>
              <Fact label="Observaciones" wide className="whitespace-pre-line font-normal">
                {occurrence.observaciones || 'Sin observaciones.'}
              </Fact>
            </dl>
          )}

          {occurrence.actualizadoPor && (
            <div className="mt-5 flex items-start gap-2 text-xs leading-4 text-fg-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p>
                Última edición por <span className="font-medium text-fg">{occurrence.actualizadoPor}</span>
                {occurrence.actualizadoEn && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {new Date(occurrence.actualizadoEn).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })}
                  </>
                )}
              </p>
            </div>
          )}
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}
