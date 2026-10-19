import { useCallback, useId, useState } from 'react';
import { AlertCircle, Ban, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Dropdown } from '../../calibration/components/Dropdown';
import {
  BlockTitle,
  CancelButton,
  DangerButton,
  FieldLabel,
  Modal,
  ModalColumns,
  ModalSection,
  ToneBadge,
} from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { rimApi } from '../api/rim';
import {
  ESTADOS_COMPONENTE,
  ESTADOS_GENERALES,
  ESTADOS_RIM,
  MOTIVOS_ANULACION,
  NIVELES_SUCIEDAD,
  descripcionInstrumento,
  fechaHora,
  filasDanos,
  filasInventario,
} from '../domain/rim';
import { ETAPAS_RIM } from '../domain/seguimiento';
import { Dato, Firma } from './ficha';
import { EjecucionModal, EntregaModal, RimSeguimiento } from './RimSeguimiento';

function Anulacion({ anulacion }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="note">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-danger">
        <Ban className="h-4 w-4" aria-hidden="true" /> RIM anulado
      </p>
      <p className="mt-1.5 whitespace-pre-line text-[13px] text-fg">{anulacion.motivo}</p>
      <p className="mt-1 text-[12.5px] text-fg-muted">
        {[
          anulacion.anuladoPorNombre ? `${anulacion.anuladoPorNombre} (${anulacion.anuladoPor})` : anulacion.anuladoPor,
          fechaHora(anulacion.anuladoEn),
          anulacion.origen === 'servicemet' ? 'en el teléfono, antes de subirlo' : 'en DataMET+',
        ].filter(Boolean).join(' · ')}
      </p>
      {anulacion.reemplazadoPor && (
        <p className="mt-1 text-[12.5px] text-fg-muted">
          Reemplazado por <span className="font-mono font-semibold text-fg">{anulacion.reemplazadoPor}</span>
        </p>
      )}
    </div>
  );
}

/** «Otro motivo» del desplegable: el motivo se escribe completo. */
const OTRO_MOTIVO = 'otro';

/** Pide el motivo de la anulación y, si lo hay, el RIM que lo reemplaza. */
function AnularRimModal({ rim, onClose, onAnulado }) {
  const baseId = useId();
  const [frecuente, setFrecuente] = useState('');
  const [motivo, setMotivo] = useState('');
  const [reemplazo, setReemplazo] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const elegido = frecuente && frecuente !== OTRO_MOTIVO ? frecuente : '';
  const texto = [elegido, motivo.trim()].filter(Boolean).join('. ');

  const anular = async (close) => {
    if (texto.length < 10) {
      setError('Elige un motivo o escríbelo (al menos 10 caracteres).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const actualizado = await rimApi.anular(rim.n, { motivo: texto, reemplazadoPor: reemplazo.trim() || null });
      toast.success(`${rim.codigo} quedó anulado.`);
      onAnulado(actualizado);
      close();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      size="md"
      title={`Anular ${rim.codigo}`}
      subtitle={[rim.cliente.nombre, rim.instrumento.codMetrica].filter(Boolean).join(' · ')}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <button
            type="button"
            onClick={() => anular(close)}
            disabled={busy}
            className="ml-auto flex h-10 items-center gap-2 rounded-xl bg-danger px-4 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Anular RIM
          </button>
        </>
      )}
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <p className="text-[13px] leading-relaxed text-fg-muted">
          El RIM no se modifica ni se borra: queda anulado, con el motivo, quién lo anuló y cuándo, y sigue visible en el historial.
          Si corresponde, emita un RIM nuevo e indique aquí su código.
        </p>
        <div>
          <FieldLabel htmlFor={`${baseId}-frecuente`}>Motivo</FieldLabel>
          <Dropdown
            id={`${baseId}-frecuente`}
            ariaLabel="Motivo"
            value={frecuente}
            onChange={setFrecuente}
            placeholder="Elegir un motivo frecuente…"
            options={[
              ...MOTIVOS_ANULACION.map(value => ({ value, label: value })),
              { value: OTRO_MOTIVO, label: 'Otro motivo (escribirlo abajo)' },
            ]}
            disabled={busy}
          />
        </div>
        <div>
          <FieldLabel htmlFor={`${baseId}-detalle`} hint={elegido ? '(opcional)' : undefined}>
            {elegido ? 'Detalle' : 'Motivo de la anulación'}
          </FieldLabel>
          <textarea
            id={`${baseId}-detalle`}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            rows={3}
            maxLength={900}
            disabled={busy}
            className="field resize-y py-3 leading-relaxed"
          />
        </div>
        <div>
          <FieldLabel htmlFor={`${baseId}-reemplazo`} hint="(opcional)">RIM que lo reemplaza</FieldLabel>
          <input
            id={`${baseId}-reemplazo`}
            value={reemplazo}
            onChange={(event) => setReemplazo(event.target.value.toUpperCase())}
            placeholder="RIM-26-0042"
            maxLength={20}
            disabled={busy}
            autoComplete="off"
            className="field h-11 font-mono font-medium tracking-wide"
          />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/** Imprime solo la ficha (ver rim.css). */
function imprimir() {
  document.body.classList.add('rim-imprimiendo');
  const limpiar = () => {
    document.body.classList.remove('rim-imprimiendo');
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  window.print();
}

/** Insignia del encabezado: anulado o, si está vigente, la etapa alcanzada. */
const insigniaDe = (rim) => {
  if (rim.estado === 'anulado' || !ETAPAS_RIM[rim.etapa]) return ESTADOS_RIM[rim.estado];
  return ETAPAS_RIM[rim.etapa];
};

/**
 * Ficha de un RIM en solo lectura: lo que se recibió, las dos firmas, su
 * ejecución, su entrega y su trazabilidad. El RIM no se edita: se anula
 * (jefes de área y niveles 2 y 3), y la ejecución y la entrega se registran
 * aparte, cada una con su historial.
 */
export function RimDetailModal({ n, onClose, onChanged }) {
  const load = useCallback(() => rimApi.registro(n), [n]);
  const { data: cargado, error, reload } = useResource(load);
  // Tras anular o registrar se muestra la respuesta del servidor sin volver a cargar.
  const [actualizado, setActualizado] = useState(null);
  const [anulando, setAnulando] = useState(false);
  // null | { etapa: 'ejecucion' } | { etapa: 'entrega', accion }
  const [registrando, setRegistrando] = useState(null);
  const rim = actualizado || cargado;

  const estado = rim ? insigniaDe(rim) : null;

  const guardado = (detalle) => {
    setActualizado(detalle);
    onChanged();
  };
  // Otro usuario guardó antes: se vuelve a cargar la ficha del servidor.
  const conflicto = () => {
    setActualizado(null);
    reload();
    onChanged();
  };
  const inventario = rim ? filasInventario(rim.inventario) : [];
  const danos = rim ? filasDanos(rim.danos) : [];

  return (
    <>
      <Modal
        title={rim ? rim.codigo : 'RIM'}
        subtitle={rim ? [`N.º ${rim.n}`, rim.origenLabel, rim.areaLabel, rim.formatoAnterior && 'código con formato anterior'].filter(Boolean).join(' · ') : 'Cargando…'}
        actions={estado && <ToneBadge tone={estado.tone}>{estado.label}</ToneBadge>}
        onClose={onClose}
        footer={(close) => (
          <>
            <CancelButton onClick={close}>Cerrar</CancelButton>
            <div className="ml-auto flex items-center gap-1">
              {rim && (
                <button
                  type="button"
                  onClick={imprimir}
                  className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir
                </button>
              )}
              {rim?.acciones.anular && (
                <DangerButton onClick={() => setAnulando(true)}>
                  <Ban className="h-4 w-4" aria-hidden="true" /> Anular RIM
                </DangerButton>
              )}
            </div>
          </>
        )}
      >
        {error && !rim && (
          <div className="m-5 flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
            <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-[13px] text-fg">{error.message}</p>
            <button type="button" onClick={reload} className="text-[13px] font-semibold text-fg underline underline-offset-4">Reintentar</button>
          </div>
        )}
        {!rim && !error && (
          <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Cargando el RIM">
            <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
          </div>
        )}
        {rim && (
          <ModalColumns>
            <div>
              {rim.anulacion && <div className="px-5 pt-6 sm:px-6"><Anulacion anulacion={rim.anulacion} /></div>}

              <ModalSection title="Cliente e instrumento">
                <dl>
                  <Dato label="Cliente">{[rim.cliente.nombre, rim.cliente.codigo && `(${rim.cliente.codigo})`].filter(Boolean).join(' ')}</Dato>
                  <Dato label="Razón social">{rim.cliente.razonSocial}</Dato>
                  <Dato label="NIT">{rim.cliente.nit}</Dato>
                  <Dato label="Planta">{[rim.planta.codigo, rim.planta.nombre].filter(Boolean).join(' · ')}</Dato>
                  <Dato label="Dirección">{[rim.planta.direccion, rim.planta.departamento].filter(Boolean).join(' - ')}</Dato>
                  <Dato label="Servicio">{[rim.servicio.nombre, rim.servicio.secaOtst].filter(Boolean).join(' · ')}</Dato>
                  <Dato label="Código métrica" mono>{rim.instrumento.codMetrica}</Dato>
                  <Dato label="Instrumento">{descripcionInstrumento(rim.instrumento)}</Dato>
                  <Dato label="Serie">{rim.instrumento.serie}</Dato>
                  <Dato label="Capacidad">{[rim.instrumento.capacidad, rim.instrumento.unidad].filter(Boolean).join(' ')}</Dato>
                  <Dato label="Resolución">{[rim.instrumento.division, rim.instrumento.unidad].filter(Boolean).join(' ')}</Dato>
                  <Dato label="Ubicación">{rim.instrumento.ubicacion}</Dato>
                  <Dato label="Observaciones">{rim.instrumento.observaciones}</Dato>
                </dl>
              </ModalSection>

              <ModalSection title="Motivo de la recepción">
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg">{rim.motivo}</p>
              </ModalSection>

              <ModalSection title="Inventario de componentes">
                {inventario.length === 0
                  ? <p className="text-[13px] text-fg-muted">No se registraron componentes.</p>
                  : (
                    <ul className="divide-y divide-line rounded-2xl border border-line">
                      {inventario.map(fila => {
                        const estadoComponente = ESTADOS_COMPONENTE[fila.estado];
                        return (
                          <li key={fila.key} className="flex items-center justify-between gap-3 px-3.5 py-2 text-[13px]">
                            <span className="text-fg">
                              {fila.nombre}
                              {fila.cantidad && <span className="ml-1.5 text-fg-muted">× {fila.cantidad}</span>}
                            </span>
                            <ToneBadge tone={estadoComponente?.tone || 'neutral'}>{estadoComponente?.label || fila.estado}</ToneBadge>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                {rim.inventario.observaciones && (
                  <p className="mt-3 whitespace-pre-line text-[13px] text-fg-muted">{rim.inventario.observaciones}</p>
                )}
              </ModalSection>

              <ModalSection title="Estado físico y pruebas">
                <dl>
                  <Dato label="Estado general">{ESTADOS_GENERALES[rim.estadoGeneral] || rim.estadoGeneral}</Dato>
                  <Dato label="Nivel de suciedad">{NIVELES_SUCIEDAD[rim.nivelSuciedad] || rim.nivelSuciedad}</Dato>
                  <Dato label="Pruebas de funcionamiento">{rim.pruebas.realizadas ? 'Sí' : 'No'}</Dato>
                  <Dato label="Descripción de pruebas">{rim.pruebas.descripcion}</Dato>
                </dl>
                {danos.length > 0 && (
                  <>
                    <BlockTitle>Daños detectados</BlockTitle>
                    <ul className="space-y-1 text-[13px]">
                      {danos.map(dano => (
                        <li key={dano.tipo}>
                          <span className="font-medium text-fg">{dano.tipo}</span>
                          {dano.lugares && <span className="text-fg-muted"> · {dano.lugares}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {rim.descripcionDanos && <p className="mt-3 whitespace-pre-line text-[13px] text-fg-muted">{rim.descripcionDanos}</p>}
              </ModalSection>

              {rim.fotos.length > 0 && (
                <ModalSection title="Fotos">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {rim.fotos.map(foto => (
                      <a key={foto.orden} href={foto.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-line">
                        <img src={foto.url} alt={foto.nombre} className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]" />
                      </a>
                    ))}
                  </div>
                </ModalSection>
              )}
            </div>

            <div className="border-t border-line bg-surface-2/50 lg:border-l lg:border-t-0">
              <ModalSection title="Recepción y firmas">
                <dl>
                  <Dato label="Entregó">{rim.recepcion.contactoNombre}</Dato>
                  <Dato label="Cargo">{rim.recepcion.contactoCargo}</Dato>
                  <Dato label="Teléfono">{rim.recepcion.contactoTelefono}</Dato>
                  <Dato label="Correo">{rim.recepcion.contactoCorreo}</Dato>
                  <Dato label="Recibió (Métrica)">{rim.recepcion.representanteMetrica}</Dato>
                  <Dato label="Lugar">{rim.recepcion.lugar}</Dato>
                  <Dato label="Técnico asignado">{rim.recepcion.tecnicoAsignado}</Dato>
                </dl>
                <div className="mt-4 grid gap-4">
                  <Firma titulo="Firma del cliente" nombre={rim.recepcion.contactoNombre} src={rim.firmas.cliente} />
                  <Firma titulo="Firma del representante de Métrica" nombre={rim.recepcion.representanteMetrica} src={rim.firmas.representante} />
                </div>
              </ModalSection>

              <RimSeguimiento
                rim={rim}
                onEditarEjecucion={() => setRegistrando({ etapa: 'ejecucion' })}
                onAccionEntrega={(accion) => setRegistrando({ etapa: 'entrega', accion })}
              />

              <ModalSection title="Trazabilidad" description="Quién lo emitió y cuándo llegó al servidor.">
                <dl>
                  <Dato label="Emitido">{fechaHora(rim.trazabilidad.emitidoEn)}</Dato>
                  <Dato label="Emitido por">{rim.trazabilidad.emitidoPor}</Dato>
                  <Dato label="Registrado">{fechaHora(rim.trazabilidad.registradoEn)}</Dato>
                  <Dato label="Registrado por">
                    {rim.trazabilidad.registradoPorNombre
                      ? `${rim.trazabilidad.registradoPorNombre} (${rim.trazabilidad.registradoPor})`
                      : rim.trazabilidad.registradoPor}
                  </Dato>
                  <Dato label="Versión">{rim.trazabilidad.appVersion}</Dato>
                  <Dato label="Talonario">{rim.trazabilidad.talonarioId ? `N.º ${rim.trazabilidad.talonarioId}` : null}</Dato>
                  <Dato label="Instalación" mono>{rim.trazabilidad.instalacion}</Dato>
                  <Dato label="Identificador" mono>{rim.trazabilidad.uuid}</Dato>
                </dl>
              </ModalSection>
            </div>
          </ModalColumns>
        )}
      </Modal>

      {registrando?.etapa === 'ejecucion' && rim && (
        <EjecucionModal rim={rim} onClose={() => setRegistrando(null)} onGuardado={guardado} onConflicto={conflicto} />
      )}
      {registrando?.etapa === 'entrega' && rim && (
        <EntregaModal
          rim={rim}
          accion={registrando.accion}
          onClose={() => setRegistrando(null)}
          onGuardado={guardado}
          onConflicto={conflicto}
        />
      )}

      {anulando && rim && (
        <AnularRimModal
          rim={rim}
          onClose={() => setAnulando(false)}
          onAnulado={guardado}
        />
      )}
    </>
  );
}
