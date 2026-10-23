import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';

/** PDF.js se carga al abrir un archivo; no depende del visor nativo del navegador. */
export function VisorPdf({ url, nombre }) {
  const [cargado, setCargado] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [ancho, setAncho] = useState(0);
  const [renderizado, setRenderizado] = useState(null);
  const contenedor = useRef(null);
  const canvas = useRef(null);
  const pdf = cargado?.url === url ? cargado.pdf : null;
  const clave = `${url}:${pagina}:${zoom}:${ancho}`;
  const listo = renderizado?.clave === clave && renderizado.listo;
  const error = cargado?.error || (renderizado?.clave === clave && renderizado.error);

  useEffect(() => {
    let activo = true;
    let tarea;
    Promise.all([import('pdfjs-dist/build/pdf.mjs'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
      .then(async ([pdfjs, worker]) => {
        if (!activo) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        tarea = pdfjs.getDocument({ url, isEvalSupported: false });
        const documento = await tarea.promise;
        if (activo) setCargado({ url, pdf: documento });
      }).catch(cause => { if (activo) setCargado({ url, error: cause }); });
    return () => { activo = false; tarea?.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAncho(Math.max(1, Math.floor(entry.contentRect.width))));
    if (contenedor.current) observer.observe(contenedor.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !ancho || !canvas.current) return undefined;
    let activo = true;
    let tarea;
    pdf.getPage(pagina).then(async hoja => {
      if (!activo) return;
      const base = hoja.getViewport({ scale: 1 });
      const viewport = hoja.getViewport({ scale: (ancho * zoom / 100) / base.width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2, 4096 / viewport.width);
      const lienzo = canvas.current;
      lienzo.width = Math.floor(viewport.width * ratio);
      lienzo.height = Math.floor(viewport.height * ratio);
      lienzo.style.width = `${Math.floor(viewport.width)}px`;
      lienzo.style.height = `${Math.floor(viewport.height)}px`;
      tarea = hoja.render({ canvasContext: lienzo.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await tarea.promise;
      if (activo) setRenderizado({ clave, listo: true });
    }).catch(cause => { if (activo) setRenderizado({ clave, error: cause }); });
    return () => { activo = false; tarea?.cancel(); };
  }, [pdf, pagina, zoom, ancho, clave]);

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line px-4 py-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" className="h-10 w-10 px-0" disabled={!pdf || pagina <= 1} onClick={() => setPagina(p => p - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
        <span className="text-xs tabular-nums text-fg-muted">{pdf ? `${pagina} de ${pdf.numPages}` : 'PDF'}</span>
        <Button size="sm" variant="ghost" className="h-10 w-10 px-0" disabled={!pdf || pagina >= pdf.numPages} onClick={() => setPagina(p => p + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
      </div>
      <label><span className="sr-only">Zoom del PDF</span><select value={zoom} disabled={!pdf} onChange={event => setZoom(Number(event.target.value))} className="h-10 rounded-lg border border-line bg-surface px-2 text-xs text-fg focus:ring-2 focus:ring-focus">
        <option value={100}>Ajustar ancho</option><option value={125}>125 %</option><option value={150}>150 %</option><option value={200}>200 %</option>
      </select></label>
    </div>
    <div className="h-[60dvh] overflow-auto overscroll-contain bg-surface-2 p-3 sm:p-4">
      <div ref={contenedor} className="relative min-h-40">
        {error ? <p role="alert" className="p-4 text-sm text-fg">No se pudo mostrar el PDF. Puede descargarlo o abrirlo en otra pestaña.</p>
          : <>
            {!listo && <div role="status" className="absolute inset-0 flex items-start justify-center gap-2 pt-12 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Cargando página…</div>}
            <canvas ref={canvas} role="img" aria-label={`Página ${pagina}${pdf ? ` de ${pdf.numPages}` : ''} de ${nombre}`} data-ready={Boolean(listo)} className={listo ? 'block bg-white shadow-sm' : 'invisible'} />
          </>}
      </div>
    </div>
  </div>;
}
