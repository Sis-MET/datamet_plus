import { useEffect, useId, useState } from 'react';
import { AlertCircle, Ban, ChevronDown, History, PencilLine, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '../../../shared/components/ui/Input';
import { TextArea } from '../../../shared/components/ui/TextArea';
import { cn } from '../../../shared/utils/cn';
import { CancelButton, Modal, ModalSection, PrimaryButton, ToneBadge } from '../../calibration/components/primitives';
import { rimApi } from '../api/rim';
import { fechaHora } from '../domain/rim';
import {
  CAMPOS_EJECUCION,
  CAMPOS_ENTREGA,
  cambiosEjecucion,
  cambiosEntrega,
  cuerpoEjecucion,
  cuerpoEntrega,
  etiquetaCampo,
  fechaLaPaz,
  nombresPersonal,
  quien,
  valorLegible,
  valoresEjecucion,
  valoresEntrega,
} from '../domain/seguimiento';
import { Dato, Firma } from './ficha';
import { SignatureField } from './SignatureField';

const TONO_TIPO = { registro: 'neutral', avance: 'info', correccion: 'warning', anulacion: 'danger' };

/** Botón de una sección de la ficha; no se imprime. */
function AccionSeccion({ onClick, icon, danger = false, children }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rim-no-print flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[12.5px] font-semibold transition-colors',
        danger
          ? 'border-danger/30 text-danger hover:bg-danger/10'
          : 'border-line text-fg hover:bg-fg/[0.05]',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {children}
    </button>
  );
}

/** «Registrado por … · fecha» de la versión vigente. */
function Registrado({ version }) {
  const accion = { registro: 'Registrado', avance: 'Actualizado', correccion: 'Corregido' }[version.tipo] || 'Registrado';
  return (
    <p className="mt-3 text-[12px] text-fg-subtle">
      {accion} por {[quien(version), fechaHora(version.registradoEn)].filter(Boolean).join(' · ')}
    </p>
  );
}

/** Qué cambió en una versión: «Campo: antes → después». */
function Cambios({ cambios }) {
  if (!cambios?.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-fg-muted">
      {cambios.map(cambio => (
        <li key={cambio.campo}>
          <span className="text-fg">{etiquetaCampo(cambio.campo)}:</span>{' '}
          {cambio.antes !== null && (
            <>
              <del>{valorLegible(cambio.campo, cambio.antes)}</del>{' → '}
            </>
          )}
          {valorLegible(cambio.campo, cambio.despues) ?? <em>vacío</em>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Versiones anteriores, de la más reciente a la más antigua. En pantalla se
 * despliega a pedido; al imprimir sale completo.
 */
function Historial({ titulo, versiones, children }) {
  const [abierto, setAbierto] = useState(false);
  const listaId = useId();
  if (versiones.length < 2) return null;
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setAbierto(value => !value)}
        aria-expanded={abierto}
        aria-controls={listaId}
        className="rim-no-print flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-muted transition-colors hover:text-fg"
      >
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        Historial ({versiones.length})
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', abierto && 'rotate-180')} aria-hidden="true" />
      </button>
      <p className="hidden text-[12.5px] font-semibold text-fg print:block">Historial</p>
      <ol
        id={listaId}
        aria-label={titulo}
        className={cn('mt-3 space-y-3 border-l border-line pl-4', abierto ? 'block' : 'hidden print:block')}
      >
        {versiones.map(version => (
          <li key={version.id} className="text-[12.5px]">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <ToneBadge tone={TONO_TIPO[version.tipo] || 'neutral'}>{version.tipoLabel}</ToneBadge>
              <span className="text-fg-muted">{[quien(version), fechaHora(version.registradoEn)].filter(Boolean).join(' · ')}</span>
            </p>
            {version.motivo && <p className="mt-1 whitespace-pre-line text-fg">Motivo: {version.motivo}</p>}
            {children(version)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Ejecución vigente (6.2), con su historial de versiones. */
function SeccionEjecucion({ rim, onEditar }) {
  const { ejecucion, acciones } = rim.seguimiento;
  const vigente = ejecucion.vigente;
  const hayDatos = vigente && Object.values(vigente.datos).some(value => value !== null);
  let boton = null;
  if (acciones.registrarEjecucion) boton = 'Registrar';
  else if (acciones.completarEjecucion) boton = acciones.corregirEjecucion ? 'Completar o corregir' : 'Completar';

  return (
    <ModalSection
      title="Ejecución"
      description="Ingreso a Soporte Técnico, fechas y números del servicio."
      action={boton && (
        <AccionSeccion onClick={onEditar} icon={vigente ? PencilLine : Plus}>{boton}</AccionSeccion>
      )}
    >
      {hayDatos ? (
        <dl>
          {CAMPOS_EJECUCION.map(def => (
            <Dato key={def.campo} label={def.label}>{valorLegible(def.campo, vigente.datos[def.campo])}</Dato>
          ))}
        </dl>
      ) : (
        <p className="text-[13px] text-fg-muted">
          {vigente ? 'Los datos de la ejecución se quitaron por corrección.' : 'Todavía no se registró la ejecución.'}
        </p>
      )}
      {vigente && <Registrado version={vigente} />}
      <Historial titulo="Historial de la ejecución" versiones={ejecucion.historial}>
        {version => <Cambios cambios={version.cambios} />}
      </Historial>
    </ModalSection>
  );
}

/** Entrega vigente (6.3) con sus dos firmas, y su historial. */
function SeccionEntrega({ rim, onAccion }) {
  const { entrega, acciones } = rim.seguimiento;
  const vigente = entrega.vigente;
  const anulada = !vigente && entrega.historial[0]?.tipo === 'anulacion';
  const botones = [
    acciones.registrarEntrega && <AccionSeccion key="registro" onClick={() => onAccion('registro')} icon={Plus}>Registrar entrega</AccionSeccion>,
    acciones.corregirEntrega && <AccionSeccion key="correccion" onClick={() => onAccion('correccion')} icon={PencilLine}>Corregir</AccionSeccion>,
    acciones.anularEntrega && <AccionSeccion key="anulacion" onClick={() => onAccion('anulacion')} icon={Ban} danger>Anular</AccionSeccion>,
  ].filter(Boolean);

  return (
    <ModalSection
      title="Entrega"
      description="Devolución del instrumento al cliente, con las dos firmas."
      action={botones.length > 0 && <div className="flex shrink-0 gap-1.5">{botones}</div>}
    >
      {vigente ? (
        <>
          <dl>
            {CAMPOS_ENTREGA.map(def => (
              <Dato key={def.campo} label={def.label}>{valorLegible(def.campo, vigente.datos[def.campo])}</Dato>
            ))}
          </dl>
          <div className="mt-4 grid gap-4">
            <Firma titulo="Firma de quien recibe" nombre={vigente.datos.recibeNombre} src={vigente.firmas.cliente} />
            <Firma titulo="Firma de quien entrega por Métrica" nombre={vigente.datos.entregaPor} src={vigente.firmas.representante} />
          </div>
          <Registrado version={vigente} />
        </>
      ) : (
        <p className="text-[13px] text-fg-muted">
          {anulada
            ? 'La entrega registrada se anuló (ver historial). Puede registrarse la entrega correcta.'
            : 'El instrumento todavía no se entregó.'}
        </p>
      )}
      <Historial titulo="Historial de la entrega" versiones={entrega.historial}>
        {version => (
          <>
            {version.tipo === 'registro' && version.datos && (
              <p className="mt-1 text-fg-muted">
                {[
                  version.datos.recibeNombre && `Recibió ${version.datos.recibeNombre}`,
                  version.datos.entregaPor && `entregó ${version.datos.entregaPor}`,
                  valorLegible('fechaEntrega', version.datos.fechaEntrega),
                  version.datos.lugarEntrega,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            <Cambios cambios={version.cambios} />
          </>
        )}
      </Historial>
    </ModalSection>
  );
}

/**
 * Ejecución y entrega en la ficha del RIM (columna derecha). Sin el script
 * 016 en el servidor, solo el aviso.
 */
export function RimSeguimiento({ rim, onEditarEjecucion, onAccionEntrega }) {
  const seguimiento = rim.seguimiento;
  if (!seguimiento) return null;
  if (!seguimiento.disponible) {
    return (
      <ModalSection title="Ejecución y entrega">
        <p className="flex gap-2 text-[13px] text-fg-muted" role="note">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {seguimiento.mensaje || 'La ejecución y la entrega no están disponibles.'}
        </p>
      </ModalSection>
    );
  }
  return (
    <>
      <SeccionEjecucion rim={rim} onEditar={onEditarEjecucion} />
      <SeccionEntrega rim={rim} onAccion={onAccionEntrega} />
    </>
  );
}

/** Nombres del personal para sugerir en los campos de nombre. */
function usePersonal() {
  const [nombres, setNombres] = useState([]);
  useEffect(() => {
    let activo = true;
    rimApi.personal()
      .then((lista) => {
        if (activo) setNombres(nombresPersonal(lista));
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);
  return nombres;
}

function ListaPersonal({ id, nombres }) {
  return (
    <datalist id={id}>
      {nombres.map(nombre => <option key={nombre} value={nombre} />)}
    </datalist>
  );
}

const subtitulo = (rim) => [rim.cliente.nombre, rim.instrumento.codMetrica].filter(Boolean).join(' · ');

/** Guarda y avisa; ante un conflicto (otro usuario guardó antes) recarga la ficha. */
async function enviar({ accion, exito, onGuardado, onConflicto, setError, setBusy, close }) {
  setBusy(true);
  setError(null);
  try {
    const actualizado = await accion();
    toast.success(exito);
    onGuardado(actualizado);
    close();
  } catch (failure) {
    setBusy(false);
    if (failure.status === 409) {
      toast.error(failure.message);
      onConflicto();
      close();
      return;
    }
    setError(failure.message);
  }
}

const EXITO_EJECUCION = {
  registro: 'registró la ejecución',
  avance: 'completó la ejecución',
  correccion: 'corrigió la ejecución',
};

/**
 * Registra, completa o corrige la ejecución. Completar campos vacíos lo
 * puede cualquiera; cambiar un dato registrado es una corrección (jefes de
 * área y niveles 2 y 3) y pide el motivo. La versión anterior no se toca.
 */
export function EjecucionModal({ rim, onClose, onGuardado, onConflicto }) {
  const { ejecucion, acciones } = rim.seguimiento;
  const vigente = ejecucion.vigente;
  const puedeCorregir = acciones.corregirEjecucion;
  const [valores, setValores] = useState(() => valoresEjecucion(rim));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const personal = usePersonal();
  const listaId = useId();

  const { tipo, cambios } = cambiosEjecucion(vigente?.datos, valores);
  const corrige = tipo === 'correccion';
  const desde = fechaLaPaz(rim.emitidoEn);
  const hoy = fechaLaPaz();
  const hayBloqueados = !puedeCorregir && CAMPOS_EJECUCION.some(def => vigente?.datos?.[def.campo]);

  const guardar = (close) => {
    if (!tipo) {
      setError(vigente ? 'No cambiaste ningún dato.' : 'Completa al menos un dato de la ejecución.');
      return;
    }
    if (corrige && motivo.trim().length < 10) {
      setError('Escribe el motivo de la corrección (al menos 10 caracteres).');
      return;
    }
    enviar({
      accion: () => rimApi.ejecucion(rim.n, cuerpoEjecucion(valores, { anteriorId: vigente?.id ?? null, motivo: corrige ? motivo : null })),
      exito: `Se ${EXITO_EJECUCION[tipo]} de ${rim.codigo}.`,
      onGuardado, onConflicto, setError, setBusy, close,
    });
  };

  return (
    <Modal
      title={vigente ? `Ejecución de ${rim.codigo}` : `Registrar ejecución de ${rim.codigo}`}
      subtitle={subtitulo(rim)}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            <PrimaryButton onClick={() => guardar(close)} busy={busy}>Guardar</PrimaryButton>
          </div>
        </>
      )}
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <p className="text-[13px] leading-relaxed text-fg-muted">
          Cada vez que guardas queda una versión nueva, con tu usuario y la hora; la anterior se conserva en el historial.
          {hayBloqueados && ' Los datos ya registrados solo los corrige un jefe de área o los niveles 2 y 3: puedes completar los vacíos.'}
        </p>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {CAMPOS_EJECUCION.map(def => (
            <Input
              key={def.campo}
              label={def.label}
              type={def.fecha ? 'date' : 'text'}
              value={valores[def.campo] ?? ''}
              onChange={(event) => setValores(current => ({ ...current, [def.campo]: event.target.value }))}
              maxLength={def.max}
              min={def.fecha ? desde : undefined}
              max={def.fecha ? hoy : undefined}
              list={def.personal ? listaId : undefined}
              autoComplete="off"
              disabled={!puedeCorregir && Boolean(vigente?.datos?.[def.campo])}
            />
          ))}
        </div>
        <ListaPersonal id={listaId} nombres={personal} />
        {corrige && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3">
            <p className="mb-3 text-[13px] text-fg">
              Estás cambiando datos ya registrados ({cambios.filter(cambio => cambio.antes !== null).map(cambio => etiquetaCampo(cambio.campo)).join(', ')}).
              Es una corrección: indica el motivo.
            </p>
            <TextArea
              label="Motivo de la corrección"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              rows={2}
              maxLength={1000}
              required
            />
          </div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

const TITULO_ENTREGA = { registro: 'Registrar entrega', correccion: 'Corregir entrega', anulacion: 'Anular entrega' };
const EXITO_ENTREGA = { registro: 'registró la entrega', correccion: 'corrigió la entrega', anulacion: 'anuló la entrega' };

/** Primer dato que falta para registrar o corregir la entrega. */
function faltanteEntrega(valores) {
  if (String(valores.recibeNombre).trim().length < 3) return 'Escribe el nombre de quien recibe por el cliente.';
  if (String(valores.entregaPor).trim().length < 3) return 'Escribe el nombre de quien entrega por Métrica.';
  if (!valores.fechaEntrega) return 'Indica la fecha de entrega.';
  if (!String(valores.lugarEntrega).trim()) return 'Indica el lugar de entrega.';
  return null;
}

/**
 * Registra la entrega con las dos firmas en pantalla, la corrige (conserva
 * las firmas; pide motivo) o la anula con motivo.
 */
export function EntregaModal({ rim, accion, onClose, onGuardado, onConflicto }) {
  const { entrega } = rim.seguimiento;
  const [valores, setValores] = useState(() => valoresEntrega(rim, accion));
  const [firmas, setFirmas] = useState({ cliente: null, representante: null });
  const [motivo, setMotivo] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const personal = usePersonal();
  const listaId = useId();
  const desde = fechaLaPaz(rim.emitidoEn);
  const hoy = fechaLaPaz();

  const guardar = (close) => {
    setIntentado(true);
    let problema = null;
    if (accion !== 'anulacion') problema = faltanteEntrega(valores);
    if (!problema && accion === 'registro' && (!firmas.cliente || !firmas.representante)) {
      problema = 'Faltan las firmas: deben firmar quien recibe y quien entrega.';
    }
    if (!problema && accion === 'correccion' && cambiosEntrega(entrega.vigente?.datos, valores).length === 0) {
      problema = 'No cambiaste ningún dato.';
    }
    if (!problema && accion !== 'registro' && motivo.trim().length < 10) {
      problema = `Escribe el motivo de la ${accion === 'anulacion' ? 'anulación' : 'corrección'} (al menos 10 caracteres).`;
    }
    if (problema) {
      setError(problema);
      return;
    }
    enviar({
      accion: () => rimApi.entrega(rim.n, cuerpoEntrega(accion, valores, { anteriorId: entrega.ultimaId, firmas, motivo })),
      exito: `Se ${EXITO_ENTREGA[accion]} de ${rim.codigo}.`,
      onGuardado, onConflicto, setError, setBusy, close,
    });
  };

  const campo = (def) => (
    def.largo ? (
      <div key={def.campo} className="sm:col-span-2">
        <TextArea
          label={`${def.label} (opcional)`}
          value={valores[def.campo] ?? ''}
          onChange={(event) => setValores(current => ({ ...current, [def.campo]: event.target.value }))}
          rows={2}
          maxLength={def.max}
        />
      </div>
    ) : (
      <Input
        key={def.campo}
        label={def.label}
        type={def.fecha ? 'date' : 'text'}
        value={valores[def.campo] ?? ''}
        onChange={(event) => setValores(current => ({ ...current, [def.campo]: event.target.value }))}
        maxLength={def.max}
        min={def.fecha ? desde : undefined}
        max={def.fecha ? hoy : undefined}
        list={def.personal ? listaId : undefined}
        autoComplete="off"
        required
      />
    )
  );

  return (
    <Modal
      size={accion === 'registro' ? 'lg' : 'md'}
      title={`${TITULO_ENTREGA[accion]} de ${rim.codigo}`}
      subtitle={subtitulo(rim)}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            {accion === 'anulacion' ? (
              <button
                type="button"
                onClick={() => guardar(close)}
                disabled={busy}
                className="flex h-10 items-center gap-2 rounded-xl bg-danger px-4 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Anular entrega
              </button>
            ) : (
              <PrimaryButton onClick={() => guardar(close)} busy={busy}>
                {accion === 'registro' ? 'Registrar entrega' : 'Guardar corrección'}
              </PrimaryButton>
            )}
          </div>
        </>
      )}
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <p className="text-[13px] leading-relaxed text-fg-muted">
          {accion === 'registro' && 'Quien recibe el instrumento por el cliente y quien lo entrega por Métrica firman en pantalla.'}
          {accion === 'correccion' && 'La corrección queda como una versión nueva, con su motivo; la anterior se conserva en el historial. Las firmas registradas se conservan.'}
          {accion === 'anulacion' && 'La entrega no se borra: queda anulada con su motivo y visible en el historial. Después puede registrarse la entrega correcta.'}
        </p>
        {accion !== 'anulacion' && (
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {CAMPOS_ENTREGA.map(campo)}
          </div>
        )}
        <ListaPersonal id={listaId} nombres={personal} />
        {accion === 'registro' && (
          <div className="grid gap-x-4 sm:grid-cols-2">
            <SignatureField
              label="Firma de quien recibe (cliente)"
              onEnd={(value) => setFirmas(current => ({ ...current, cliente: value }))}
              error={intentado && !firmas.cliente ? { message: 'Falta la firma de quien recibe.' } : null}
            />
            <SignatureField
              label="Firma de quien entrega (Métrica)"
              onEnd={(value) => setFirmas(current => ({ ...current, representante: value }))}
              error={intentado && !firmas.representante ? { message: 'Falta la firma de quien entrega.' } : null}
            />
          </div>
        )}
        {accion !== 'registro' && (
          <TextArea
            label={accion === 'anulacion' ? 'Motivo de la anulación' : 'Motivo de la corrección'}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            rows={3}
            maxLength={1000}
            required
            data-autofocus={accion === 'anulacion' ? true : undefined}
          />
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
