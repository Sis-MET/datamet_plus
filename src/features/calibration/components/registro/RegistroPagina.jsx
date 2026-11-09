import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, BadgeCheck, Calculator, Eye, FilePenLine, FileText, FileUp, History, Info, Loader2, Send, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../../shared/utils/cn';
import { safeStorage } from '../../../../shared/utils/storage';
import { Button } from '../../../../shared/components/ui/Button';
import { useResource } from '../../../system/hooks/useResource';
import { calibrationApi } from '../../api/calibration';
import { formatDate } from '../../domain/format';
import { ESTADOS_REGISTRO } from '../../domain/registro';
import { SECCIONES, instrumentoTexto, seccionDeAviso } from '../../domain/servicios';
import { CancelButton, Modal, PrimaryButton, Segmented, ToneBadge } from '../primitives';
import { EnviarRegistroModal } from '../EnviarRegistroModal';
import { PuntosAcordadosModal } from '../PuntosAcordadosModal';
import { ReasonModal } from '../ReasonModal';
import { AutorizarModal, SubirFirmadoModal } from '../certificado/EmisionModales';
import { HistorialRegistro } from './HistorialRegistro';
import { PreviaCertificado } from './PreviaCertificado';
import { ResultadosRegistro } from './ResultadosRegistro';
import { IndiceSecciones, SeccionesRegistro } from './SeccionesRegistro';
import { useRegistroEditor } from './useRegistroEditor';
import './registro.css';

const MODELO_GUARDADO = 'datamet_cal_modelo_certificado';
const leerModelo = () => (safeStorage.getItem(MODELO_GUARDADO) === 'sugerido' ? 'sugerido' : 'actual');

/** Estado del registro y lo que toca hacer ahora, como la validación de Soporte. */
function EstadoPanel({ data, pendientes, onAccion }) {
  const estado = ESTADOS_REGISTRO[data.estado] || ESTADOS_REGISTRO.PENDIENTE;
  const r = data.registro;
  const p = data.permisos;
  const autorizada = data.emisiones.find(e => e.estado === 'AUTORIZADO');
  const vigente = data.emisiones.find(e => e.estado === 'EMITIDO');
  const guardaPrimero = pendientes > 0 ? 'Guarda los cambios primero' : undefined;
  return (
    <section aria-label="Estado del registro" className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge tone={estado.tone}>{estado.label}</ToneBadge>
            {vigente && <span className="text-[12.5px] text-fg-muted">Vigente: emisión {String(vigente.emision).padStart(2, '0')}, firmada el {vigente.firmaFecha}</span>}
          </div>
          <p className="mt-2 text-fg-muted">{estado.descripcion} Los datos de ServiceMET no se modifican: las correcciones quedan en el registro con su historial.</p>
          {r?.enviadoPor && data.estado !== 'BORRADOR' && <p className="mt-1 text-xs text-fg-muted">Enviado por {r.enviadoPor} · {formatDate(r.enviadoEn?.slice(0, 10))}</p>}
          {r?.revisadoPor && ['APROBADO', 'OBSERVADO', 'AUTORIZADO', 'EMITIDO'].includes(data.estado) && (
            <p className="mt-1 text-xs text-fg-muted">Revisado por {r.revisadoPor} · {formatDate(r.revisadoEn?.slice(0, 10))}</p>
          )}
          {autorizada && <p className="mt-1 text-xs text-fg-muted">Autorizado por {autorizada.autorizadoPor}: emisión {String(autorizada.emision).padStart(2, '0')}, {autorizada.archivo}</p>}
          {r?.observacion && ['OBSERVADO', 'BORRADOR'].includes(data.estado) && (
            <p className="mt-2 break-words text-fg"><strong>Observación{r.revisadoPor ? ` de ${r.revisadoPor}` : ''}:</strong> {r.observacion}</p>
          )}
          {r?.revisionMotivo && <p className="mt-2 break-words text-fg"><strong>Revisión del certificado:</strong> {r.revisionMotivo}</p>}
          {data.cambioDesdeEnvio && <p className="mt-2 text-warning">Los datos cambiaron desde el envío: hay que retirarlo y volver a enviarlo.</p>}
          {p.motivoRevisar && <p className="mt-2 text-fg-muted">{p.motivoRevisar}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.retirar && <Button variant="ghost" onClick={() => onAccion('retirar')}><Undo2 className="h-4 w-4" aria-hidden="true" /> Retirar de revisión</Button>}
          {p.reabrir && <Button variant="secondary" onClick={() => onAccion('reabrir')}>Reabrir</Button>}
          {p.anularAutorizacion && <Button variant="secondary" onClick={() => onAccion('anular')}>Anular autorización</Button>}
          {p.abrirRevision && <Button variant="secondary" onClick={() => onAccion('revisionCertificado')}><FilePenLine className="h-4 w-4" aria-hidden="true" /> Abrir revisión</Button>}
          {p.revisar && (
            <>
              <Button variant="secondary" onClick={() => onAccion('observar')}>Devolver con observación</Button>
              <Button onClick={() => onAccion('aprobar')}><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Aprobar</Button>
            </>
          )}
          {p.enviar && <Button onClick={() => onAccion('enviar')} disabled={pendientes > 0} title={guardaPrimero}><Send className="h-4 w-4" aria-hidden="true" /> Enviar a revisión</Button>}
          {p.autorizar && <Button onClick={() => onAccion('autorizar')}><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Autorizar certificado</Button>}
          {p.subirFirmado && <Button onClick={() => onAccion('firmado')}><FileUp className="h-4 w-4" aria-hidden="true" /> Subir PDF firmado</Button>}
        </div>
      </div>
    </section>
  );
}

function SalirModal({ cantidad, onClose, onSalir }) {
  return (
    <Modal
      size="md"
      title="Hay cambios sin guardar"
      subtitle={cantidad === 1 ? '1 dato sin guardar' : `${cantidad} datos sin guardar`}
      onClose={onClose}
      footer={(close) => (
        <>
          <CancelButton onClick={close}>Seguir editando</CancelButton>
          <div className="ml-auto"><PrimaryButton onClick={() => { close(); onSalir(); }}>Salir sin guardar</PrimaryButton></div>
        </>
      )}
    >
      <p className="px-5 py-5 text-[13px] text-fg-muted sm:px-6">Si sales, se pierden las correcciones que todavía no guardaste.</p>
    </Modal>
  );
}

/**
 * Página de trabajo del registro de calibración de un servicio, como el
 * editor de informes de Soporte: el estado y sus acciones arriba; los datos
 * de ServiceMET corregibles en el lugar, sección por sección; los resultados
 * del cálculo; el historial; y, al costado, el certificado tal como saldría,
 * que se actualiza mientras se corrige.
 */
export function RegistroPagina({ codigo, canEdit, onVolver }) {
  const load = useCallback(() => calibrationApi.registro(codigo), [codigo]);
  const { data, error, reload } = useResource(load);
  const editor = useRegistroEditor(data);
  const [tab, setTab] = useState('datos');
  const [modelo, setModeloEstado] = useState(leerModelo);
  const [emisionVista, setEmisionVista] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [puntos, setPuntos] = useState(false);

  const setModelo = (valor) => {
    safeStorage.setItem(MODELO_GUARDADO, valor);
    setModeloEstado(valor);
  };

  const porSeccion = useMemo(() => {
    const mapa = new Map(SECCIONES.map(s => [s.id, []]));
    for (const aviso of data?.avisos || []) mapa.get(seccionDeAviso(aviso))?.push(aviso);
    return mapa;
  }, [data]);

  const guardar = async () => {
    if (editor.cantidad === 0) return;
    if (editor.clasePendiente && editor.clase?.valor && !editor.clase.origen) {
      toast.error('Indica de dónde sale la clase del instrumento.');
      return;
    }
    setGuardando(true);
    try {
      await calibrationApi.guardarRegistro(codigo, { version: data.registro?.version ?? null, ...editor.cambios, motivo: motivo.trim() || null });
      editor.descartar();
      setMotivo('');
      toast.success('Correcciones guardadas');
      reload();
    } catch (failure) {
      toast.error(failure.message || 'No se pudieron guardar las correcciones.');
      if (failure.status === 409) reload();
    } finally {
      setGuardando(false);
    }
  };

  /** Guardado directo (piezas de una carga, anexo): no pasa por la barra de cambios. */
  const guardarDirecto = async (cambios, mensaje = 'Piezas guardadas') => {
    await calibrationApi.guardarRegistro(codigo, { version: data.registro?.version ?? null, ...cambios });
    toast.success(mensaje);
    reload();
  };

  const ejecutar = async (accion, mensaje) => {
    try {
      await accion();
      toast.success(mensaje);
      reload();
    } catch (failure) {
      toast.error(failure.message || 'No se pudo completar la acción.');
    }
  };

  const accion = (cual) => {
    if (cual === 'retirar') ejecutar(() => calibrationApi.retirarRegistro(codigo), 'Registro retirado de revisión');
    else if (cual === 'aprobar') ejecutar(() => calibrationApi.revisarRegistro(codigo, { decision: 'APROBAR' }), 'Registro aprobado');
    else setConfirmar(cual);
  };

  // Ctrl+S / ⌘S guarda.
  const guardarRef = useRef(guardar);
  useEffect(() => { guardarRef.current = guardar; });
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        guardarRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  // Aviso del navegador al cerrar con cambios sin guardar.
  useEffect(() => {
    if (editor.cantidad === 0) return undefined;
    const handler = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editor.cantidad]);

  const volver = () => (editor.cantidad > 0 ? setSaliendo(true) : onVolver());

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={onVolver} className="flex w-max items-center gap-1.5 text-[13px] font-semibold text-fg-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Certificados
        </button>
        {error ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
            <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-[13px] text-fg">{error.message}</p>
            <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
          </div>
        ) : (
          <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Cargando el registro">
            <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
          </div>
        )}
      </div>
    );
  }

  const m = data.modelo;
  const editable = data.permisos.editar;
  const titulo = `SECA ${m.servicio.seca?.libro || m.servicio.seca?.original || '—'} · RECA ${m.servicio.reca?.texto || m.servicio.reca?.original || '—'}`;
  const errores = data.avisos.filter(a => a.nivel === 'error').length;
  const avisos = data.avisos.filter(a => a.nivel === 'aviso').length;
  const previa = (completo) => (
    <PreviaCertificado
      codigo={codigo}
      version={data.registro?.version ?? 0}
      estado={data.estado}
      cambios={editor.cambios}
      pendientes={editor.cantidad}
      modelo={modelo}
      onModelo={setModelo}
      emision={completo ? emisionVista : null}
      completo={completo}
    />
  );

  const TABS = [
    { value: 'datos', label: 'Datos del servicio', icon: <FileText className="h-4 w-4" aria-hidden="true" />, count: errores + avisos || undefined, alert: errores > 0 },
    { value: 'resultados', label: 'Resultados', icon: <Calculator className="h-4 w-4" aria-hidden="true" /> },
    { value: 'vista', label: 'Vista previa', icon: <Eye className="h-4 w-4" aria-hidden="true" /> },
    { value: 'historial', label: 'Historial', icon: <History className="h-4 w-4" aria-hidden="true" />, count: data.historial.length || undefined },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <button type="button" onClick={volver} className="flex w-max items-center gap-1.5 text-[13px] font-semibold text-fg-muted transition-colors hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Certificados
        </button>
        <div className="min-w-0">
          <h2 className="font-mono text-xl font-semibold tracking-wide text-fg">{titulo}</h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            {[m.cliente.razonSocial || m.cliente.nombre, [m.instrumento.codigoMetrica, instrumentoTexto(m.instrumento)].filter(Boolean).join(' · '),
              m.servicio.tecnico.usuario ? m.servicio.tecnico.nombre : m.servicio.tecnico.original, formatDate(m.servicio.fecha)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <EstadoPanel data={data} pendientes={editor.cantidad} onAccion={accion} />

      {!editable && data.estado !== 'PENDIENTE' && ['EN_REVISION', 'APROBADO', 'AUTORIZADO', 'EMITIDO'].includes(data.estado) && (
        <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-muted">
          <Info className="h-4 w-4 flex-none" aria-hidden="true" />
          {data.estado === 'EN_REVISION' ? 'En revisión: para corregir hay que retirarlo.' : data.estado === 'EMITIDO' ? 'Emitido: para cambiarlo, abre una revisión con su motivo.' : 'Aprobado: para corregir hay que reabrirlo.'}
        </p>
      )}

      <Segmented label="Partes del registro" value={tab} onChange={setTab} options={TABS} className="cal-tabs self-start xl:[&>button:nth-child(3)]:hidden" />

      <div className={cn('grid gap-5', tab !== 'vista' && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]')}>
        <div className="flex min-w-0 flex-col gap-4">
          {tab === 'datos' && (
            <>
              <IndiceSecciones porSeccion={porSeccion} />
              <SeccionesRegistro
                data={data}
                editor={editor}
                editable={editable}
                porSeccion={porSeccion}
                onPuntosAcordados={() => setPuntos(true)}
                puedeAcordar={canEdit}
                onAnexo={valor => guardarDirecto({ anexo: valor }, valor ? 'Se agrega el anexo de información adicional' : 'Se quita el anexo de información adicional')
                  .catch(failure => toast.error(failure.message))}
              />
            </>
          )}
          {tab === 'resultados' && <ResultadosRegistro data={data} editable={editable} onGuardar={guardarDirecto} />}
          {tab === 'vista' && previa(true)}
          {tab === 'historial' && <HistorialRegistro data={data} onVerEmision={(emision) => { setEmisionVista(emision); setTab('vista'); }} />}
        </div>
        {tab !== 'vista' && (
          <aside className="hidden min-w-0 xl:block" aria-label="Vista previa del certificado">
            <div className="sticky top-[calc(var(--topbar-height)+16px)] max-h-[calc(100dvh-var(--topbar-height)-32px)] overflow-y-auto overscroll-contain rounded-2xl">
              {previa(false)}
            </div>
          </aside>
        )}
      </div>

      {editor.cantidad > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-pop" role="status">
          <span className="h-2 w-2 flex-none rounded-full bg-warning" aria-hidden="true" />
          <p className="text-[13px] text-fg">{editor.cantidad === 1 ? '1 dato sin guardar' : `${editor.cantidad} datos sin guardar`}</p>
          <input
            value={motivo}
            maxLength={500}
            onChange={event => setMotivo(event.target.value)}
            aria-label="Motivo de las correcciones"
            placeholder="Motivo (opcional)"
            className="field h-9 min-w-[160px] flex-1 rounded-lg text-[13px]"
          />
          <CancelButton onClick={() => { editor.descartar(); setMotivo(''); }} disabled={guardando}>Descartar</CancelButton>
          <PrimaryButton onClick={guardar} busy={guardando}>Guardar</PrimaryButton>
        </div>
      )}

      {saliendo && <SalirModal cantidad={editor.cantidad} onClose={() => setSaliendo(false)} onSalir={() => { editor.descartar(); onVolver(); }} />}
      {puntos && (
        <PuntosAcordadosModal
          codMetrica={m.instrumento.codigoMetrica}
          unidadInstrumento={m.instrumento.unidad}
          instrumento={[m.instrumento.codigoMetrica, instrumentoTexto(m.instrumento)].filter(Boolean).join(' · ')}
          onClose={() => setPuntos(false)}
          onSaved={reload}
        />
      )}
      {confirmar === 'enviar' && (
        <EnviarRegistroModal
          titulo={titulo}
          avisos={data.avisos}
          calculo={data.calculo}
          onIr={(seccion) => {
            setConfirmar(null);
            setTab(seccion === 'resultados' ? 'resultados' : 'datos');
            setTimeout(() => document.getElementById(`registro-${seccion}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
          }}
          onClose={() => setConfirmar(null)}
          onConfirm={async () => {
            await calibrationApi.enviarRegistro(codigo);
            toast.success('Registro enviado a revisión');
            reload();
          }}
        />
      )}
      {confirmar === 'observar' && (
        <ReasonModal
          title="Devolver con una observación" subtitle={titulo} heading="Observar el registro"
          description="El registro vuelve a quien lo elaboró para que lo corrija y lo envíe de nuevo."
          confirmLabel="Devolver" reasonLabel="Observación" reasonPlaceholder="Qué debe revisar o corregir"
          onConfirm={async (observacion) => { await calibrationApi.revisarRegistro(codigo, { decision: 'OBSERVAR', observacion }); toast.success('Registro observado'); reload(); }}
          onClose={() => setConfirmar(null)}
        />
      )}
      {confirmar === 'reabrir' && (
        <ReasonModal
          title="Reabrir el registro aprobado" subtitle={titulo} heading="Volver a borrador"
          description="Se podrá corregir y deberá enviarse y aprobarse de nuevo. El motivo queda en el historial."
          confirmLabel="Reabrir"
          onConfirm={async (texto) => { await calibrationApi.reabrirRegistro(codigo, { motivo: texto }); toast.success('Registro reabierto'); reload(); }}
          onClose={() => setConfirmar(null)}
        />
      )}
      {confirmar === 'autorizar' && (
        <AutorizarModal codigo={codigo} onClose={() => setConfirmar(null)} onAutorizado={() => { toast.success('Certificado autorizado: descarga el PDF para firmar en la vista previa'); reload(); setTab('vista'); }} />
      )}
      {confirmar === 'firmado' && (
        <SubirFirmadoModal
          codigo={codigo}
          emision={data.emisiones.find(e => e.estado === 'AUTORIZADO')}
          onClose={() => setConfirmar(null)}
          onEmitido={(resultado) => { toast.success(`Certificado emitido: firmado el ${resultado.fechaFirma}`); reload(); }}
        />
      )}
      {confirmar === 'anular' && (
        <ReasonModal
          title="Anular la autorización" subtitle={titulo} heading="Volver a aprobado"
          description="La emisión autorizada queda anulada (no se borra) y el certificado se puede volver a autorizar. Úsalo si el PDF salió con un error antes de firmarlo."
          confirmLabel="Anular"
          onConfirm={async (texto) => { await calibrationApi.anularAutorizacion(codigo, { motivo: texto }); toast.success('Autorización anulada'); reload(); }}
          onClose={() => setConfirmar(null)}
        />
      )}
      {confirmar === 'revisionCertificado' && (
        <ReasonModal
          title="Abrir una revisión del certificado" subtitle={titulo} heading="Reemisión"
          description="El registro vuelve a borrador; después se revisa, se autoriza y se firma la emisión siguiente, que reemplaza a la vigente. El motivo va en el certificado."
          confirmLabel="Abrir revisión" reasonLabel="Motivo de la revisión" reasonPlaceholder="Ej.: corrección de la razón social a pedido del cliente"
          onConfirm={async (texto) => { await calibrationApi.abrirRevisionCertificado(codigo, { motivo: texto }); toast.success('Revisión abierta'); reload(); }}
          onClose={() => setConfirmar(null)}
        />
      )}
    </div>
  );
}
