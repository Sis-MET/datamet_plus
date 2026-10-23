import { useCallback, useEffect, useId, useState } from 'react';
import {
  AlertCircle, Ban, CalendarClock, CalendarPlus, FileText, Handshake, Loader2, MessageSquareText, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../shared/components/ui/Button';
import { cn } from '../../../../shared/utils/cn';
import { capitalize, formatDate } from '../../../calibration/domain/format';
import {
  BlockTitle, CancelButton, FieldLabel, Modal, ModalColumns, ModalSection, ToneBadge,
} from '../../../calibration/components/primitives';
import { soporteApi } from '../../api/soporte';
import { ESTADOS_INFORME } from '../../domain/informe';
import {
  ACCIONES, ESTADO_SUGERENCIA, SEGUIMIENTO_UI, cuando, formaDe, gestionTitulo, subtituloEquipo, sugeridoLabel, tipoLabel,
  tonoTexto, medidaPesaje,
} from '../../domain/proximos';
import { Glifo, SituacionBadge } from './piezas';

const ICONO_ACCION = {
  CONTACTO: MessageSquareText,
  COORDINACION: Handshake,
  REPROGRAMACION: CalendarClock,
  DESCARTE: Ban,
  REACTIVACION: RotateCcw,
};

const fechaHora = (iso) => (iso
  ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
  : '—');

function Dato({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] font-medium text-fg">{children || '—'}</dd>
    </div>
  );
}

/** Formulario de una gestión: fecha (si corresponde) y nota o motivo. */
function FormGestion({ accion, proximo, equipo, hoy, onCancel, onSaved }) {
  const baseId = useId();
  const meta = ACCIONES[accion];
  const conFecha = Boolean(meta.fecha);
  const [fecha, setFecha] = useState(accion === 'COORDINACION' ? (proximo?.fecha && proximo.fecha >= hoy ? proximo.fecha : '') : '');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const minimo = accion === 'COORDINACION' ? hoy : equipo.origen?.fecha || undefined;
  const valido = nota.trim().length >= 10 && (!conFecha || Boolean(fecha));

  const guardar = async (event) => {
    event.preventDefault();
    setGuardando(true);
    try {
      const ficha = await soporteApi.seguimiento({
        codMetrica: equipo.id,
        origenTipo: equipo.origen.tipo,
        origenCodigo: equipo.origen.codigo,
        accion,
        fecha: conFecha ? fecha : null,
        nota,
        ultimo: equipo.ultimoSeguimientoId ?? null,
      });
      toast.success(`${meta.label}: registrado`);
      onSaved(ficha);
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar.');
      // Otra persona registró algo o hubo un servicio nuevo: se recarga la ficha.
      if (error.status === 409) onSaved(null);
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/60 p-4">
      <p className="text-[13px] font-semibold text-fg">{meta.boton}</p>
      {conFecha && (
        <div>
          <FieldLabel htmlFor={`${baseId}-fecha`}>{meta.fecha}</FieldLabel>
          <input
            id={`${baseId}-fecha`}
            type="date"
            required
            value={fecha}
            min={minimo}
            onChange={(event) => setFecha(event.target.value)}
            className="field h-11 w-48 font-medium tabular-nums"
          />
        </div>
      )}
      <div>
        <FieldLabel htmlFor={`${baseId}-nota`} hint="(mínimo 10 caracteres)">{meta.nota}</FieldLabel>
        <textarea
          id={`${baseId}-nota`}
          required
          rows={3}
          maxLength={500}
          value={nota}
          onChange={(event) => setNota(event.target.value)}
          placeholder={meta.ejemplo}
          className="field min-h-[84px] resize-y py-2.5 leading-relaxed"
          data-autofocus
        />
      </div>
      <p className="text-xs text-fg-muted">Queda en el seguimiento del equipo con su nombre, la fecha y la hora; no se puede borrar.</p>
      <div className="flex justify-end gap-2">
        <CancelButton onClick={onCancel} disabled={guardando} />
        <Button type="submit" isLoading={guardando} disabled={!valido} variant={accion === 'DESCARTE' ? 'danger' : 'primary'}>
          {meta.boton}
        </Button>
      </div>
    </form>
  );
}

/** Tarjeta del próximo servicio: fecha, situación, de dónde salió y las gestiones. */
function TarjetaProximo({ equipo, hoy, editar, onSaved }) {
  const [accion, setAccion] = useState(null);
  const proximo = equipo.proximo;
  const descartado = proximo?.descartada;
  const conFecha = Boolean(proximo?.fecha);

  const acciones = !editar || !SEGUIMIENTO_UI ? [] : descartado
    ? ['REACTIVACION']
    : conFecha
      ? ['CONTACTO', 'COORDINACION', 'REPROGRAMACION', 'DESCARTE']
      : ['REPROGRAMACION'];

  return (
    <div>
      {conFecha ? (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
          <div className="flex flex-wrap items-start gap-3">
            <Glifo forma={formaDe(proximo)} situacion={proximo.situacion} size={14} className="mt-1" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-tight text-fg">{capitalize(formatDate(proximo.fecha, "EEEE d 'de' MMMM 'de' yyyy"))}</p>
              <p className={cn('mt-0.5 text-[13px] font-medium', tonoTexto(proximo.situacion))}>{cuando(proximo)}</p>
            </div>
            <SituacionBadge situacion={proximo.situacion} />
          </div>
          <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <Dato label="Tipo de servicio sugerido">{sugeridoLabel(proximo)}</Dato>
            <Dato label="Sugerido en">
              {tipoLabel(equipo.origen.tipo)} del {formatDate(equipo.origen.fecha)}
              {equipo.origen.otst && <span className="block text-xs font-normal text-fg-muted">OTST de referencia {equipo.origen.otst}</span>}
            </Dato>
            {proximo.reprogramada && <Dato label="Fecha sugerida por el técnico">{proximo.fechaSugerida ? formatDate(proximo.fechaSugerida) : 'Sin fecha'}</Dato>}
            {proximo.ultimoContacto && (
              <Dato label="Último contacto con el cliente">
                {formatDate(proximo.ultimoContacto.registradoEn?.slice(0, 10))} · {proximo.ultimoContacto.usuarioNombre || proximo.ultimoContacto.usuario}
              </Dato>
            )}
          </dl>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-[13px] text-fg-muted">
          <p className="font-semibold text-fg">{descartado ? 'Descartado' : 'Sin fecha de próximo servicio'}</p>
          <p className="mt-1">
            {descartado
              ? 'Este equipo no genera avisos hasta que se reactive.'
              : `El último servicio que cuenta (${tipoLabel(equipo.origen?.tipo)} del ${formatDate(equipo.origen?.fecha)}) no sugirió fecha.${SEGUIMIENTO_UI ? ' Puede programar una.' : ''}`}
          </p>
        </div>
      )}

      {descartado && conFecha && (
        <p className="mt-3 text-[13px] text-fg-muted">Descartado: no aparece en «Requieren atención» ni en los correos hasta que se reactive.</p>
      )}

      {acciones.length > 0 && !accion && (
        <div className="mt-4 flex flex-wrap gap-2">
          {acciones.map((clave) => {
            const Icono = clave === 'REPROGRAMACION' && !conFecha ? CalendarPlus : ICONO_ACCION[clave];
            return (
              <Button
                key={clave}
                size="sm"
                variant={clave === 'DESCARTE' ? 'ghost' : 'secondary'}
                className={clave === 'DESCARTE' ? 'text-danger hover:bg-danger/10 hover:text-danger' : undefined}
                onClick={() => setAccion(clave)}
              >
                <Icono className="h-3.5 w-3.5" aria-hidden="true" />
                {clave === 'REPROGRAMACION' && !conFecha ? 'Programar fecha' : ACCIONES[clave].boton}
              </Button>
            );
          })}
        </div>
      )}

      {accion && (
        <FormGestion
          key={accion}
          accion={accion}
          proximo={proximo}
          equipo={equipo}
          hoy={hoy}
          onCancel={() => setAccion(null)}
          onSaved={(ficha) => {
            setAccion(null);
            onSaved(ficha);
          }}
        />
      )}
    </div>
  );
}

/** Servicios del equipo, del más reciente al más antiguo, con lo que sugirió cada uno. */
function Servicios({ servicios, onAbrirInforme }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {servicios.map((servicio) => {
        const estadoInforme = ESTADOS_INFORME[servicio.estadoInforme];
        const sugerencia = ESTADO_SUGERENCIA[servicio.sugerencia];
        return (
          <li key={`${servicio.tipo}:${servicio.codigo}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <Glifo forma={formaDe({ clase: 'SERVICIO', tipo: servicio.tipo })} situacion="REALIZADO" size={11} className="mt-1" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-fg">
                {tipoLabel(servicio.tipo)} <span className="font-normal text-fg-muted">· {formatDate(servicio.fecha)}</span>
              </p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {[servicio.numero, estadoInforme && `Informe ${estadoInforme.label.toLowerCase()}`, servicio.tecnico].filter(Boolean).join(' · ')}
              </p>
              {(servicio.fechaProx || servicio.tipoSugerido || servicio.recomendacion) && (
                <p className="mt-1 text-xs text-fg">
                  {servicio.fechaProx ? `Sugirió el ${formatDate(servicio.fechaProx)}` : 'Sin fecha sugerida'}
                  {servicio.tipoSugerido && ` · ${sugeridoLabel(servicio)}`}
                  {servicio.atendidaPor && (
                    <span className="text-fg-muted"> · atendida con el {tipoLabel(servicio.atendidaPor.tipo).toLowerCase()} del {formatDate(servicio.atendidaPor.fecha)}</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-none flex-col items-end gap-1.5">
              {sugerencia && <ToneBadge tone={sugerencia.tone}>{sugerencia.label}</ToneBadge>}
              <button
                type="button"
                onClick={() => onAbrirInforme({ tipo: servicio.tipo, codigo: servicio.codigo })}
                className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Abrir informe
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Bitácora del seguimiento del equipo, de lo más reciente a lo más antiguo. */
function Seguimiento({ gestiones, origen }) {
  if (gestiones.length === 0) {
    return <p className="text-[13px] text-fg-muted">Todavía no hay gestiones registradas.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {gestiones.map((gestion) => {
        const Icono = ICONO_ACCION[gestion.accion] || MessageSquareText;
        const anterior = origen && (gestion.origenTipo !== origen.tipo || gestion.origenCodigo !== origen.codigo);
        return (
          <li key={gestion.id} className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-surface text-fg-muted shadow-xs ring-1 ring-line">
              <Icono className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-fg">{gestionTitulo(gestion)}</p>
              <p className="mt-0.5 whitespace-pre-line break-words text-[13px] text-fg">{gestion.nota}</p>
              <p className="mt-1 text-xs text-fg-muted">
                {gestion.usuarioNombre || gestion.usuario} · {fechaHora(gestion.registradoEn)}
                {anterior && ' · de una fecha anterior'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Ficha de un equipo: su próximo servicio con las gestiones del área, los
 * servicios realizados y el seguimiento.
 */
export function EquipoFicha({ codMetrica, onClose, onAbrirInforme }) {
  const [estado, setEstado] = useState({ cargando: true, data: null, error: null });

  const cargar = useCallback(async () => {
    try {
      const data = await soporteApi.equipo(codMetrica);
      setEstado({ cargando: false, data, error: null });
    } catch (error) {
      setEstado(actual => ({ ...actual, cargando: false, error }));
    }
  }, [codMetrica]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const data = estado.data;
  const equipo = data?.equipo;

  return (
    <Modal
      title={equipo ? equipo.codMetrica : codMetrica}
      subtitle={equipo ? [equipo.cliente, subtituloEquipo(equipo)].filter(Boolean).join(' · ') : 'Próximo servicio del equipo'}
      onClose={onClose}
    >
      {(close) => {
        if (estado.cargando && !data) {
          return (
            <div className="flex min-h-60 items-center justify-center" role="status" aria-label="Cargando el equipo">
              <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
            </div>
          );
        }
        if (!data) {
          return (
            <p className="m-6 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger" role="alert">
              <AlertCircle className="h-4 w-4" /> {estado.error?.message || 'No se pudo cargar el equipo.'}
            </p>
          );
        }
        return (
          <ModalColumns>
            <div>
              <ModalSection title="Próximo servicio" description="Sale del último mantenimiento, instalación o verificación del equipo.">
                <TarjetaProximo
                  equipo={equipo}
                  hoy={data.hoy}
                  editar={data.permisos.editar}
                  onSaved={(ficha) => {
                    if (ficha) setEstado({ cargando: false, data: ficha, error: null });
                    else cargar();
                  }}
                />
              </ModalSection>
              <div className="border-t border-line">
                <ModalSection title="Servicios del equipo" description={`${equipo.servicios.length} ${equipo.servicios.length === 1 ? 'servicio registrado' : 'servicios registrados'} en ServiceMET.`}>
                  <Servicios
                    servicios={equipo.servicios}
                    onAbrirInforme={(informe) => {
                      close();
                      onAbrirInforme(informe);
                    }}
                  />
                </ModalSection>
              </div>
            </div>
            <ModalSection title="Datos del equipo" aside>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2"><Dato label="Cliente">{equipo.cliente}</Dato></div>
                <div className="col-span-2"><Dato label="Planta">{equipo.planta}</Dato></div>
                <Dato label="Ciudad">{equipo.ciudad}</Dato>
                <Dato label="Código Métrica">{equipo.codMetrica}</Dato>
                <Dato label="Instrumento">{equipo.instrumento}</Dato>
                <Dato label="Marca">{equipo.marca}</Dato>
                <Dato label="Modelo">{equipo.modelo}</Dato>
                <Dato label="Serie">{equipo.serie}</Dato>
                <Dato label="Código interno">{equipo.codInt}</Dato>
                <Dato label="Ubicación">{equipo.ubicacion}</Dato>
                <Dato label="Capacidad máxima">{medidaPesaje(equipo.capacidadMaxima, equipo.unidades)}</Dato>
                <Dato label="Rangos de pesaje">{equipo.tipoRango || 'Sin datos de rangos'}</Dato>
                {(equipo.rangos || []).map(rango => (
                  <div className="col-span-2" key={rango.numero}>
                    <Dato label={`Rango ${rango.numero}`}>
                      Máx. {medidaPesaje(rango.capacidad, equipo.unidades)} · d = {medidaPesaje(rango.division, equipo.unidades)}
                      {rango.verificacion != null && ` · e = ${medidaPesaje(rango.verificacion, equipo.unidades)}`}
                    </Dato>
                  </div>
                ))}
              </dl>
              {/* Con el seguimiento oculto, la bitácora solo aparece si ya tiene gestiones. */}
              {(SEGUIMIENTO_UI || data.seguimiento.length > 0) && (
                <div className="mt-6 border-t border-line pt-5">
                  <BlockTitle>Seguimiento</BlockTitle>
                  <Seguimiento gestiones={data.seguimiento} origen={equipo.origen} />
                </div>
              )}
            </ModalSection>
          </ModalColumns>
        );
      }}
    </Modal>
  );
}
