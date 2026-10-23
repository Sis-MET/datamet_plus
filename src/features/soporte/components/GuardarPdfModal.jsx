import { useCallback, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, ArrowUp, ChevronRight, Folder, FolderOpen, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { CancelButton, FieldLabel, Modal, PrimaryButton } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { soporteApi } from '../api/soporte';
import { GuardadoPdf } from './GuardadoPdf';

/** Extiende el editor: explorador de carpetas existentes, sin imponer jerarquía. */
export function GuardarPdfModal({ tipo, codigo, version, revision, documento, titulo, onClose, onGuardado }) {
  const [carpeta, setCarpeta] = useState('');
  const [nombre, setNombre] = useState(`${titulo}.pdf`);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(null);
  const [errorGuardado, setErrorGuardado] = useState(null);
  const pdfPreparado = useRef(null);
  const id = useId();
  // Se identifica la respuesta por carpeta: una respuesta anterior nunca
  // habilita guardar en una carpeta cuya carga todavía no terminó.
  const load = useCallback(async () => {
    try { return { carpeta, datos: await soporteApi.carpetas(carpeta) }; }
    catch (error) { return { carpeta, error }; }
  }, [carpeta]);
  const { data, loading, reload } = useResource(load);
  const actual = data?.carpeta === carpeta ? data : null;
  const cargando = loading || !actual;
  const error = !cargando && actual?.error;
  const partes = carpeta ? carpeta.split('/') : [];
  const carpetas = (actual?.datos?.carpetas || []).filter(item => item.nombre.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es')));
  const valido = nombre.trim().length > 4 && nombre.length <= 220 && /\.pdf$/i.test(nombre)
    && !/[<>:"/\\|?*]/.test(nombre) && [...nombre].every(c => c.charCodeAt(0) >= 32) && !/[. ]$/.test(nombre)
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(nombre);
  const navegar = ruta => { setCarpeta(ruta); setBusqueda(''); setErrorGuardado(null); };
  const subir = async (pdf, cerrar) => {
    const guardado = await soporteApi.guardarPdf(tipo, codigo, pdf, { carpeta, nombre, version, revision, borrador: documento.borrador });
    onGuardado(guardado);
    cerrar();
  };
  const confirmar = async cerrar => {
    setErrorGuardado(null);
    const cache = pdfPreparado.current?.nombre === nombre ? pdfPreparado.current.pdf : null;
    setGuardando({ cerrar, generar: !cache });
    if (!cache) return;
    try { await subir(cache, cerrar); toast.success(`Se guardó ${nombre}.`); }
    catch (failure) { setErrorGuardado(failure.message); }
    finally { setGuardando(null); }
  };

  return (
    <Modal title="Guardar PDF" subtitle={documento.borrador ? `Borrador · Rev. ${revision}` : `Informe emitido · Rev. ${revision}`}
      size="md" onClose={onClose} busy={Boolean(guardando)}
      footer={close => <>
        <CancelButton onClick={close} disabled={Boolean(guardando)}>Cancelar</CancelButton>
        <div className="ml-auto">
          <PrimaryButton busy={Boolean(guardando)} busyLabel="Guardando PDF…"
            disabled={cargando || Boolean(error) || !valido}
            onClick={() => confirmar(close)}>
            Guardar aquí
          </PrimaryButton>
        </div>
      </>}>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-[13px] leading-relaxed text-fg-muted">Elija la carpeta de OneDrive del área donde guardará este documento.</p>
        <nav aria-label="Carpeta de destino" className="flex flex-wrap items-center gap-1 text-[13px]">
          <button type="button" onClick={() => navegar('')} disabled={Boolean(guardando)}
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-semibold text-fg hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus">
            <FolderOpen className="h-4 w-4 text-fg-muted" aria-hidden="true" /> {actual?.datos?.nombreRaiz || 'Soporte Técnico'}
          </button>
          {partes.map((parte, index) => <span key={index} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
            <button type="button" onClick={() => navegar(partes.slice(0, index + 1).join('/'))} disabled={Boolean(guardando)}
              aria-current={index === partes.length - 1 ? 'location' : undefined}
              className="min-h-10 max-w-full break-all rounded-lg px-2 text-left text-fg hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus">{parte}</button>
          </span>)}
        </nav>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={!carpeta || Boolean(guardando)} onClick={() => navegar(partes.slice(0, -1).join('/'))} title="Subir una carpeta">
            <ArrowUp className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Subir una carpeta</span>
          </Button>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line px-3 focus-within:ring-2 focus-within:ring-focus">
            <Search className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <input type="search" aria-label="Buscar carpeta" placeholder="Buscar en esta carpeta…" value={busqueda}
              onChange={event => setBusqueda(event.target.value)} disabled={Boolean(guardando)}
              className="h-10 w-full min-w-0 bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted" />
          </label>
          <Button size="sm" variant="secondary" onClick={reload} disabled={cargando || Boolean(guardando)} title="Actualizar carpetas">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Actualizar carpetas</span>
          </Button>
        </div>
        <div aria-busy={cargando} className="h-[min(32dvh,280px)] min-h-36 overflow-y-auto overscroll-contain rounded-xl border border-line">
          {cargando ? <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando carpetas…</div>
            : error ? <div role="alert" className="flex h-full flex-col items-start justify-center gap-3 p-4">
              <p className="text-sm text-fg">{error.message}</p><Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
            </div>
              : carpetas.length === 0 ? <p className="p-4 text-sm leading-relaxed text-fg-muted">{busqueda ? 'No hay carpetas con ese nombre.' : 'Esta carpeta no tiene subcarpetas. Puede guardar el PDF aquí.'}</p>
                : <ul className="divide-y divide-line">{carpetas.map(item => <li key={item.ruta}>
                  <button type="button" disabled={Boolean(guardando)} onClick={() => navegar(item.ruta)}
                    aria-label={`Abrir carpeta ${item.nombre}`} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm text-fg hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                    <Folder className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" /><span className="min-w-0 flex-1 break-words">{item.nombre}</span><ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                  </button>
                </li>)}</ul>}
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-nombre`}>Nombre del archivo</FieldLabel>
          <input id={`${id}-nombre`} value={nombre} onChange={event => { setNombre(event.target.value); setErrorGuardado(null); }}
            disabled={Boolean(guardando)} maxLength={220}
            className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-focus focus:ring-2 focus:ring-focus/20 disabled:opacity-50"
            aria-invalid={!valido} aria-describedby={!valido ? `${id}-error` : undefined} />
          {!valido && <p id={`${id}-error`} className="field-error mt-1">Escriba un nombre válido terminado en .pdf.</p>}
        </div>
        {errorGuardado && <p role="alert" className="flex items-start gap-2 text-sm text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{errorGuardado}</p>}
      </div>
      {guardando?.generar && <GuardadoPdf {...documento} titulo={nombre.replace(/\.pdf$/i, '')}
        onGuardar={async pdf => {
          pdfPreparado.current = { nombre, pdf };
          await subir(pdf, guardando.cerrar);
        }} onError={failure => setErrorGuardado(failure.message)} onTerminar={() => setGuardando(null)} />}
    </Modal>
  );
}
