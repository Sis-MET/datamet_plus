import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowLeft, BadgeCheck, Camera, ChevronRight, Download, Eye, FilePenLine, FileText, History, Info, Loader2,
  FolderOpen, Printer, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { Button } from '../../../shared/components/ui/Button';
import {
  CancelButton, Modal, PrimaryButton, Segmented, ToneBadge,
} from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { soporteApi } from '../api/soporte';
import { avisosEmision } from '../domain/avisos';
import { aNumero } from '../domain/calculos';
import {
  ESTADOS_INFORME, cambiosParaGuardar, fechaHora, formatoFecha, mismoValor, nombreArchivo, notasRevision, pieDeInforme,
  pieDeRevision, prepararPdfEmitido, valorGuardado, valoresInforme,
} from '../domain/informe';
import { PLANTILLAS, seccionesEditor, tipoServicio } from '../domain/plantillas';
import { FotosPanel } from './FotosPanel';
import { HistorialPanel } from './HistorialPanel';
import { MotivoModal } from './MotivoModal';
import { RevisionesPanel } from './RevisionesPanel';
import { SeccionEditor } from './secciones';
import { Impresion, VistaPrevia } from './VistaPrevia';
import { GuardadoPdf } from './GuardadoPdf';
import { pedirDestino } from './destinoPdf';
import { ValidacionPanel } from './ValidacionPanel';
import { GuardarPdfModal } from './GuardarPdfModal';
import { DocumentosPanel, PdfGuardadoModal } from './DocumentosPanel';

const tiene = (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto, clave);
const vacio = (valor) => valor === null || valor === undefined || String(valor).trim() === '';
const NUMERICAS = new Set(['decimal', 'entero']);

/** Tarjeta de una sección del formulario. */
function Seccion({ seccion, editor }) {
  const distintos = seccion.campos.filter(c => editor.estadoCampo(c.campo, c.tipo).distinto).length;
  return (
    <section id={`seccion-${seccion.id}`} aria-labelledby={`titulo-${seccion.id}`} className="card scroll-mt-24 p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 id={`titulo-${seccion.id}`} className="text-sm font-semibold text-fg">{seccion.titulo}</h3>
        {distintos > 0 && (
          <span className="cal-badge cal-tone-info" title="Datos distintos de los que subió el técnico desde ServiceMET">
            {distintos} {distintos === 1 ? 'dato corregido' : 'datos corregidos'}
          </span>
        )}
      </div>
      <SeccionEditor seccion={seccion} editor={editor} />
    </section>
  );
}

function EmitirModal({ informe, avisos, reemision = null, onIr, onClose, onConfirm, onEmitido }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const emitido = useRef(null);
  const confirmar = async (close) => {
    setBusy(true);
    setError(null);
    try {
      emitido.current = await onConfirm();
      close();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      size="md"
      title={reemision ? `Reemitir ${informe.numero} · Rev. ${reemision}` : `Emitir ${informe.numero}`}
      subtitle={informe.tipoLabel}
      onClose={() => { onClose(); if (emitido.current) onEmitido(emitido.current); }}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            <PrimaryButton onClick={() => confirmar(close)} busy={busy} busyLabel={reemision ? 'Reemitiendo' : 'Emitiendo'}>
              {reemision ? 'Reemitir informe' : 'Emitir informe'}
            </PrimaryButton>
          </div>
        </>
      )}
    >
      <div className="space-y-3 px-5 py-5 text-[13px] leading-relaxed text-fg-muted sm:px-6">
        {avisos.length > 0 ? (
          <section aria-label="Revisión antes de emitir" className="rounded-2xl border border-warning/30 bg-warning/5 p-3">
            <p className="mb-2 flex items-center gap-2 font-semibold text-fg">
              <AlertTriangle className="h-4 w-4 flex-none text-warning" aria-hidden="true" />
              Revise antes de {reemision ? 'reemitir' : 'emitir'} ({avisos.length})
            </p>
            <ul className="divide-y divide-line/60">
              {avisos.map(aviso => (
                <li key={aviso.id}>
                  <button
                    type="button"
                    onClick={() => onIr(aviso.seccion)}
                    disabled={busy}
                    className="flex w-full items-center gap-2 py-1.5 text-left text-[12.5px] text-fg transition-colors hover:text-info"
                  >
                    <span className="min-w-0 flex-1">{aviso.texto}</span>
                    <ChevronRight className="h-3.5 w-3.5 flex-none text-fg-subtle" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px]">Puede {reemision ? 'reemitir' : 'emitir'} igual; cada aviso lleva a la sección para corregirlo.</p>
          </section>
        ) : (
          <p className="flex items-center gap-2 text-fg">
            <BadgeCheck className="h-4 w-4 flex-none text-success" aria-hidden="true" />
            La revisión no encontró datos faltantes.
          </p>
        )}
        {reemision ? (
          <>
            <p>
              Al reemitirlo, la Rev. {reemision} pasa a ser la vigente: queda quién la reemitió y cuándo, el pie dice que
              reemplaza a la Rev. {reemision - 1} y el informe cierra con el motivo de la revisión.
            </p>
            <p>La Rev. {reemision - 1} se conserva tal como se entregó y se puede volver a imprimir desde el historial.</p>
          </>
        ) : (
          <>
            <p>Al emitirlo queda registrado quién lo emitió y cuándo, y el PDF sale sin la marca «BORRADOR».</p>
            <p>
              Después, para cambiarlo (por ejemplo, a pedido del cliente) se abre una revisión con su motivo; la emitida sigue
              vigente hasta que se reemita.
            </p>
          </>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        <p>Después de emitir, elija la carpeta donde se guardará el PDF del informe.</p>
      </div>
    </Modal>
  );
}

function CancelarRevisionModal({ informe, pendientes, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const confirmar = async (close) => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      size="md"
      title={`Cancelar la revisión ${informe.revisionAbierta.revision}`}
      subtitle={informe.numero}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy}>Seguir con la revisión</CancelButton>
          <button
            type="button"
            onClick={() => confirmar(close)}
            disabled={busy}
            className="ml-auto flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Cancelar la revisión
          </button>
        </>
      )}
    >
      <div className="space-y-3 px-5 py-5 text-[13px] leading-relaxed text-fg-muted sm:px-6">
        <p>
          Se descartan los cambios del borrador y el informe vuelve a la Rev. {informe.revision} tal como se emitió, con sus
          datos y sus fotos.{pendientes > 0 ? ' También se pierden los datos sin guardar.' : ''}
        </p>
        <p>La cancelación queda en el historial con lo que se deshizo.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function SalirModal({ cantidad, onClose, onSalir }) {
  return (
    <Modal
      size="md"
      title="Hay cambios sin guardar"
      onClose={onClose}
      footer={(close) => (
        <>
          <CancelButton onClick={close}>Seguir editando</CancelButton>
          <button
            type="button"
            onClick={onSalir}
            className="ml-auto flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
          >
            Descartar y salir
          </button>
        </>
      )}
    >
      <p className="px-5 py-5 text-[13px] leading-relaxed text-fg-muted sm:px-6">
        {cantidad === 1 ? 'Un dato no se guardó.' : `${cantidad} datos no se guardaron.`} Si sale, se pierden.
      </p>
    </Modal>
  );
}

/**
 * Informe de un servicio: formulario por secciones (como el Excel), vista
 * previa con el diseño de la plantilla, fotografías, historial, emisión y
 * PDF. Los datos de ServiceMET no se modifican: lo corregido se guarda aparte
 * con su historial.
 */
export function InformeEditor({ tipo, codigo, onVolver }) {
  const load = useCallback(() => soporteApi.informe(tipo, codigo), [tipo, codigo]);
  const { data: cargado, error, reload } = useResource(load);
  const { data: opciones } = useResource(soporteApi.filtros);
  const cargarArchivos = useCallback(() => soporteApi.documentos(tipo, codigo), [tipo, codigo]);
  const { data: archivo, error: errorArchivo, loading: cargandoArchivo, reload: recargarArchivo } = useResource(cargarArchivos);
  const [actualizado, setActualizado] = useState(null);
  const [pendientes, setPendientes] = useState({});
  const [tab, setTab] = useState('datos');
  const [guardando, setGuardando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  // Descarga local opcional, independiente del archivo del área.
  const [guardandoPdf, setGuardandoPdf] = useState(null);
  const [destinoServidor, setDestinoServidor] = useState(null);
  const [pdfAbierto, setPdfAbierto] = useState(null);
  // Reemisión: abrir o cancelar la revisión, y la copia de una revisión emitida
  // que se está imprimiendo o guardando en PDF.
  const [abriendo, setAbriendo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [revisionDoc, setRevisionDoc] = useState(null);
  const [cargandoRevision, setCargandoRevision] = useState(null);
  // Campos cuyo texto se reemplazó con la sugerencia de Gemini.
  const [asistidos, setAsistidos] = useState(() => new Set());

  const informe = actualizado || cargado;
  const informeRef = useRef(informe);
  useEffect(() => {
    informeRef.current = informe;
  }, [informe]);

  // Al recargar desde el servidor (conflicto) se descarta la copia local.
  const recargar = useCallback(() => {
    setActualizado(null);
    reload();
  }, [reload]);

  const plantilla = PLANTILLAS[tipo];
  const secciones = useMemo(() => seccionesEditor(plantilla), [plantilla]);
  const editable = Boolean(informe?.acciones?.editar);
  const emitido = informe?.estado === 'EMITIDO';
  const enRevision = informe?.estado === 'EN_REVISION';
  // Un informe emitido no se edita: primero se abre una revisión.
  const editableDatos = editable && !emitido && !['PENDIENTE', 'APROBADO'].includes(informe?.validacion?.estado);

  const columnasEditables = useMemo(() => new Set(Object.keys(informe?.columnas || {})), [informe]);
  const tiposNumericos = useMemo(() => Object.fromEntries(
    Object.entries(informe?.columnas || {}).filter(([, meta]) => NUMERICAS.has(meta.tipo)).map(([campo]) => [campo, 'numero']),
  ), [informe]);

  const valores = useMemo(() => valoresInforme(informe, pendientes), [informe, pendientes]);
  const cantidadPendientes = Object.keys(pendientes).length;

  const estadoCampo = useCallback((campo, tipoCampo) => {
    const meta = informe?.columnas?.[campo];
    const numerico = NUMERICAS.has(meta?.tipo) || tipoCampo === 'numero' || tipoCampo === 'entero';
    const pendiente = tiene(pendientes, campo);
    const valor = pendiente ? pendientes[campo] : valorGuardado(informe, campo);
    const original = informe?.fuente?.[campo] ?? null;
    return {
      valor,
      original,
      pendiente,
      distinto: !mismoValor(valor, original, numerico ? 'numero' : undefined),
      bloqueado: !editableDatos || !meta,
      max: meta?.max || undefined,
      invalido: numerico && !vacio(valor) && aNumero(valor) === null,
    };
  }, [editableDatos, informe, pendientes]);

  const cambiar = useCallback((campo, valor) => {
    setPendientes((actual) => {
      const siguiente = { ...actual };
      if (mismoValor(valor, valorGuardado(informeRef.current, campo), tiposNumericos[campo])) delete siguiente[campo];
      else siguiente[campo] = valor;
      return siguiente;
    });
  }, [tiposNumericos]);

  const redaccion = useMemo(() => ({
    disponible: Boolean(informe?.acciones?.redaccion),
    sugerir: async ({ campo, seccion, texto }) => (await soporteApi.redaccion({
      tipo, codigo, campo, seccion, texto, version: informe.version,
      cambios: cambiosParaGuardar(informe, pendientes, tiposNumericos),
    })).texto,
    marcar: (campo) => setAsistidos(actual => new Set(actual).add(campo)),
    asistido: (campo) => asistidos.has(campo),
  }), [asistidos, informe, tipo, codigo, pendientes, tiposNumericos]);

  const editor = useMemo(() => ({
    valores,
    estadoCampo,
    cambiar,
    columnasEditables,
    tecnicos: opciones?.tecnicos || [],
    redaccion,
  }), [valores, estadoCampo, cambiar, columnasEditables, opciones, redaccion]);

  const descartar = () => {
    setPendientes({});
    setAsistidos(new Set());
  };

  /**
   * Las fotos llaman a `accion` a través de aquí. Ya no se pide motivo por
   * cambio: un informe emitido se cambia abriendo una revisión, que lleva el
   * motivo una sola vez.
   */
  const conMotivo = useCallback((_opciones, accion) => Promise.resolve(accion(null)).then(() => true), []);

  /** Respuesta del servidor (el informe completo) o recarga si hubo conflicto. */
  const aplicar = useCallback(async (promesa) => {
    try {
      const nuevo = await promesa;
      setActualizado(nuevo);
      return nuevo;
    } catch (failure) {
      if (failure.status === 409) {
        toast.error(failure.message);
        recargar();
      }
      throw failure;
    }
  }, [recargar]);

  const acciones = useMemo(() => ({
    conMotivo,
    agregarFoto: (body) => aplicar(soporteApi.agregarFoto(tipo, codigo, body)),
    editarFoto: (id, body) => aplicar(soporteApi.editarFoto(tipo, codigo, id, body)),
    quitarFoto: (id, body) => aplicar(soporteApi.quitarFoto(tipo, codigo, id, body)),
    ordenarFotos: (body) => aplicar(soporteApi.ordenarFotos(tipo, codigo, body)),
  }), [aplicar, codigo, conMotivo, tipo]);

  const guardar = async () => {
    const invalidos = Object.keys(pendientes).filter(campo => estadoCampo(campo).invalido);
    if (invalidos.length > 0) {
      toast.error('Hay números mal escritos. Corríjalos antes de guardar.');
      return;
    }
    const cambios = cambiosParaGuardar(informe, pendientes, tiposNumericos);
    if (Object.keys(cambios).length === 0) {
      descartar();
      return;
    }
    const ia = [...asistidos].filter(campo => tiene(cambios, campo));
    setGuardando(true);
    try {
      await aplicar(soporteApi.guardar(tipo, codigo, { version: informe.version, cambios, ia }));
      descartar();
      toast.success(enRevision ? `Guardado en el borrador de la Rev. ${informe.revisionAbierta.revision}.` : 'Cambios guardados.');
    } catch (failure) {
      if (failure.status !== 409) toast.error(failure.message);
    } finally {
      setGuardando(false);
    }
  };

  // Atajo Ctrl+S / ⌘S para guardar.
  const guardarRef = useRef(guardar);
  useEffect(() => {
    guardarRef.current = guardar;
  });
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

  // Aviso del navegador al cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (cantidadPendientes === 0) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [cantidadPendientes]);

  const volver = () => (cantidadPendientes > 0 ? setSaliendo(true) : onVolver());

  if (error && !informe) {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={onVolver} className="flex w-max items-center gap-1.5 text-[13px] font-semibold text-fg-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Informes
        </button>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">{error.message}</p>
          <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
        </div>
      </div>
    );
  }

  if (!informe) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Cargando el informe">
        <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
      </div>
    );
  }

  const estado = ESTADOS_INFORME[informe.estado];
  const servicio = tipoServicio(tipo);
  const titulo = nombreArchivo(plantilla, informe.numero, valores, emitido ? informe.revision : 0);
  // Con la revisión abierta, el documento es su borrador (con la marca).
  const documento = {
    plantilla,
    numero: informe.numero,
    valores,
    fotos: informe.fotos,
    borrador: !emitido,
    pie: pieDeInforme(informe),
    notas: notasRevision(informe.revisiones, informe.revisionAbierta),
  };
  const copiaVigente = (informe.revisiones || []).some(copia => copia.revision === informe.revision);

  /**
   * Imprime o guarda en PDF una revisión emitida tal como se entregó. La
   * carpeta de destino se elige en el archivo del área.
   */
  const cargarRevision = async (revision, modo) => {
    setCargandoRevision(revision);
    try {
      const copia = await soporteApi.revision(tipo, codigo, revision);
      const valoresCopia = { ...copia.fuente, ...copia.datos };
      const copiaDoc = {
        modo,
        titulo: nombreArchivo(plantilla, informe.numero, valoresCopia, revision),
        documento: {
          plantilla,
          numero: informe.numero,
          valores: valoresCopia,
          fotos: copia.fotos,
          borrador: false,
          pie: pieDeRevision(copia, informe.numero),
          notas: notasRevision(copia.revisiones),
        },
      };
      if (modo === 'pdf') setDestinoServidor({ ...copiaDoc, revision, version: informe.version });
      else setRevisionDoc(copiaDoc);
    } catch (failure) {
      toast.error(failure.message);
    } finally {
      setCargandoRevision(null);
    }
  };
  const avisos = avisosEmision({ plantilla, valores, fotos: informe.fotos });

  /** Copia local opcional, separada del archivo compartido del área. */
  const descargarCopia = async () => {
    if (!emitido) return;
    const destino = await pedirDestino(titulo);
    if (destino === undefined) return;
    setGuardandoPdf({ destino });
  };
  const guardarPdf = () => { if (emitido) setDestinoServidor(prepararPdfEmitido(informe, plantilla)); };
  const documentos = archivo?.documentos || [];
  const pdfVigente = documentos.find(doc => !doc.borrador && doc.revision === informe.revision);

  /** Lleva a la sección de un aviso (o a las fotos). */
  const irA = (seccion) => {
    setEmitiendo(false);
    setTab(seccion === 'fotos' ? 'fotos' : 'datos');
    if (seccion !== 'fotos') {
      setTimeout(() => {
        document.getElementById(`seccion-${seccion}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  const TABS = [
    { value: 'datos', label: 'Datos del informe', icon: <FileText className="h-4 w-4" aria-hidden="true" /> },
    {
      value: 'fotos',
      label: 'Fotografías',
      icon: <Camera className="h-4 w-4" aria-hidden="true" />,
      count: informe.fotos.length || undefined,
    },
    { value: 'vista', label: 'Vista previa', icon: <Eye className="h-4 w-4" aria-hidden="true" /> },
    {
      value: 'historial',
      label: 'Historial',
      icon: <History className="h-4 w-4" aria-hidden="true" />,
      count: informe.historial.length || undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-3">
        <button type="button" onClick={volver} className="flex w-max items-center gap-1.5 text-[13px] font-semibold text-fg-muted transition-colors hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Informes
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-xl font-semibold tracking-wide text-fg">{informe.numero}</h2>
              <ToneBadge tone={estado.tone}>{estado.label}{(emitido || enRevision) && informe.revision > 0 ? ` · rev. ${informe.revision}` : ''}</ToneBadge>
            </div>
            <p className="mt-1 text-[13px] text-fg-muted">
              {[servicio.label, valores.cliente, valores.personal, formatoFecha(valores.fecha_servicio)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setImprimiendo(true)} disabled={!emitido || imprimiendo} title={!emitido ? 'Apruebe y emita el informe antes de imprimir' : undefined}>
              {imprimiendo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="h-4 w-4" aria-hidden="true" />}
              Imprimir
            </Button>
            <Button
              variant="secondary"
              onClick={guardarPdf}
              disabled={!emitido || Boolean(guardandoPdf) || cantidadPendientes > 0}
              title={!emitido ? 'Apruebe y emita el informe antes de guardar el PDF' : cantidadPendientes > 0 ? 'Guarde los cambios antes de guardar el PDF' : 'Guardar el informe como PDF en la carpeta que elija'}
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              Guardar PDF
            </Button>
            <Button variant="ghost" onClick={descargarCopia} disabled={!emitido || Boolean(guardandoPdf) || cantidadPendientes > 0} title={!emitido ? 'Apruebe y emita el informe antes de descargar' : 'Descargar una copia en esta computadora'}>
              <Download className="h-4 w-4" aria-hidden="true" /> Descargar copia
            </Button>
            {pdfVigente && <Button variant="secondary" onClick={() => setPdfAbierto(pdfVigente)}>
              <FileText className="h-4 w-4" aria-hidden="true" /> Abrir PDF
            </Button>}
            {editable && emitido && (
              <Button onClick={() => setAbriendo(true)}>
                <FilePenLine className="h-4 w-4" aria-hidden="true" /> Abrir revisión
              </Button>
            )}
            {editable && enRevision && (
              <Button variant="ghost" onClick={() => setCancelando(true)} disabled={guardando}>
                <Undo2 className="h-4 w-4" aria-hidden="true" /> Cancelar revisión
              </Button>
            )}
            {editable && !emitido && informe.validacion?.estado === 'APROBADO' && (
              <Button
                onClick={() => setEmitiendo(true)}
                disabled={cantidadPendientes > 0}
                title={cantidadPendientes > 0 ? 'Guarde los cambios antes de emitir' : undefined}
              >
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                {enRevision ? `Reemitir · Rev. ${informe.revisionAbierta.revision}` : 'Emitir informe'}
                {avisos.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-black/10 px-1.5 text-[11px] tabular-nums" title={`${avisos.length} avisos antes de emitir`}>
                    {avisos.length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!emitido && (
        <ValidacionPanel informe={informe} pendientes={cantidadPendientes} avisos={avisos.length}
          onAccion={aplicar} tipo={tipo} codigo={codigo} />
      )}

      {!editable && (
        <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-muted">
          <Info className="h-4 w-4 flex-none" aria-hidden="true" />
          Solo lectura: los informes los editan el área de Soporte Técnico y Sistemas. Puede verlos, imprimirlos y guardarlos en PDF.
        </p>
      )}

      {editable && emitido && (
        <p className="flex items-start gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-muted">
          <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <span>
            Emitido{informe.revision > 0 ? ` · Rev. ${informe.revision}` : ''}. Para cambiarlo (por ejemplo, a pedido del cliente), abra una
            revisión con su motivo: los cambios se guardan como borrador y esta revisión sigue vigente hasta que reemita.
          </span>
        </p>
      )}

      {enRevision && (
        <section aria-label="Revisión en borrador" className="flex flex-wrap items-start gap-3 rounded-2xl border border-info/30 bg-info/5 px-4 py-3">
          <FilePenLine className="mt-0.5 h-4 w-4 flex-none text-info" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-semibold text-fg">Revisión {informe.revisionAbierta.revision} en borrador</p>
            <p className="mt-0.5 break-words text-fg"><span className="font-medium">Motivo:</span> {informe.revisionAbierta.motivo}</p>
            <p className="mt-0.5 text-fg-muted">
              Abierta por {informe.revisionAbierta.abiertaPor?.nombre || informe.revisionAbierta.abiertaPor?.usuario} · {fechaHora(informe.revisionAbierta.abiertaEn)}
              {' · '}La Rev. {informe.revision} sigue vigente: es la que tiene el cliente hasta que reemita.
            </p>
          </div>
          {copiaVigente && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => cargarRevision(informe.revision, 'imprimir')}
                disabled={cargandoRevision !== null}
                isLoading={cargandoRevision === informe.revision}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Imprimir Rev. {informe.revision}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => cargarRevision(informe.revision, 'pdf')} disabled={cargandoRevision !== null}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF Rev. {informe.revision}
              </Button>
            </div>
          )}
        </section>
      )}

      {emitido && archivo && !cargandoArchivo && !errorArchivo && !pdfVigente && <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-fg">
        <FolderOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1"><strong>PDF pendiente de guardar.</strong> El informe ya está emitido. Elija una carpeta para guardar esta revisión.</p>
        <Button variant="secondary" onClick={guardarPdf}>Elegir carpeta</Button>
      </div>}
      <DocumentosPanel documentos={documentos} nombreRaiz={archivo?.nombreRaiz} error={errorArchivo} cargando={cargandoArchivo}
        onRecargar={recargarArchivo} onAbrir={setPdfAbierto} />

      <Segmented
        label="Partes del informe"
        value={tab}
        onChange={setTab}
        options={TABS}
        className="cal-tabs self-start xl:[&>button:nth-child(3)]:hidden"
      />

      <div className={cn('grid gap-5', tab !== 'vista' && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]')}>
        <div className="flex min-w-0 flex-col gap-4">
          {tab === 'datos' && (
            <>
              {editable && (
                <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-fg-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                  Los datos vienen de ServiceMET. Lo que corrija aquí se guarda en el informe con su historial y no cambia el registro original del técnico.
                </p>
              )}
              {secciones.map(seccion => <Seccion key={seccion.id} seccion={seccion} editor={editor} />)}
            </>
          )}
          {tab === 'fotos' && <FotosPanel informe={informe} editable={editableDatos} acciones={acciones} />}
          {tab === 'historial' && (
            <>
              <RevisionesPanel
                informe={informe}
                cargando={cargandoRevision}
                onImprimir={revision => cargarRevision(revision, 'imprimir')}
                onPdf={revision => cargarRevision(revision, 'pdf')}
              />
              <HistorialPanel informe={informe} plantilla={plantilla} />
            </>
          )}
          {tab === 'vista' && <VistaPrevia {...documento} />}
        </div>

        {tab !== 'vista' && (
          <aside className="hidden min-w-0 xl:block" aria-label="Vista previa del informe">
            <div className="sticky top-[calc(var(--topbar-height)+16px)] max-h-[calc(100dvh-var(--topbar-height)-32px)] overflow-y-auto overscroll-contain rounded-2xl">
              <VistaPrevia {...documento} />
            </div>
          </aside>
        )}
      </div>

      {cantidadPendientes > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-pop" role="status">
          <span className="h-2 w-2 flex-none rounded-full bg-info" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">
            {cantidadPendientes === 1 ? '1 dato sin guardar' : `${cantidadPendientes} datos sin guardar`}
            {emitido && <span className="text-fg-muted"> · se pedirá el motivo</span>}
          </p>
          <CancelButton onClick={descartar} disabled={guardando}>Descartar</CancelButton>
          <PrimaryButton onClick={guardar} busy={guardando}>Guardar</PrimaryButton>
        </div>
      )}

      {emitiendo && (
        <EmitirModal
          informe={informe}
          avisos={avisos}
          reemision={enRevision ? informe.revisionAbierta.revision : null}
          onIr={irA}
          onClose={() => setEmitiendo(false)}
          onEmitido={nuevo => setDestinoServidor(prepararPdfEmitido(nuevo, plantilla))}
          onConfirm={async () => {
            if (enRevision) {
              const nuevo = await aplicar(soporteApi.reemitir(tipo, codigo, { version: informe.version }));
              return nuevo;
            }
            const nuevo = await aplicar(soporteApi.emitir(tipo, codigo, { version: informe.version }));
            return nuevo;
          }}
        />
      )}

      {abriendo && (
        <MotivoModal
          titulo={`Abrir una revisión de ${informe.numero}`}
          descripcion={`Los cambios se guardarán como borrador de la Rev. ${informe.revision + 1}, sin pedir motivo en cada guardado. La Rev. ${informe.revision} sigue vigente (es la que se imprime) hasta que reemita; si se arrepiente, puede cancelar la revisión.`}
          etiqueta="Motivo de la revisión"
          placeholder="Por ejemplo: el cliente pidió corregir la ubicación del equipo."
          accion="Abrir revisión"
          onClose={() => setAbriendo(false)}
          onConfirm={async (motivo) => {
            await aplicar(soporteApi.abrirRevision(tipo, codigo, { version: informe.version, motivo }));
            toast.success(`Revisión ${informe.revision + 1} abierta: los cambios se guardan como borrador.`);
          }}
        />
      )}

      {cancelando && (
        <CancelarRevisionModal
          informe={informe}
          pendientes={cantidadPendientes}
          onClose={() => setCancelando(false)}
          onConfirm={async () => {
            await aplicar(soporteApi.cancelarRevision(tipo, codigo, { version: informe.version }));
            descartar();
            toast.success(`Revisión cancelada: vuelve la Rev. ${informe.revision}.`);
          }}
        />
      )}

      {saliendo && (
        <SalirModal
          cantidad={cantidadPendientes}
          onClose={() => setSaliendo(false)}
          onSalir={() => {
            descartar();
            onVolver();
          }}
        />
      )}

      {imprimiendo && <Impresion {...documento} titulo={titulo} onTerminar={() => setImprimiendo(false)} />}
      {destinoServidor && <GuardarPdfModal tipo={tipo} codigo={codigo} {...destinoServidor}
        onClose={() => setDestinoServidor(null)} onGuardado={recargarArchivo} />}
      {pdfAbierto && <PdfGuardadoModal key={pdfAbierto.id} documento={pdfAbierto} onClose={() => setPdfAbierto(null)} />}
      {guardandoPdf && (
        <GuardadoPdf {...documento} titulo={titulo} destino={guardandoPdf.destino} onTerminar={() => setGuardandoPdf(null)} />
      )}
      {revisionDoc?.modo === 'imprimir' && (
        <Impresion {...revisionDoc.documento} titulo={revisionDoc.titulo} onTerminar={() => setRevisionDoc(null)} />
      )}
    </div>
  );
}
