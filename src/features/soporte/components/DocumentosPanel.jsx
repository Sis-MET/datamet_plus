import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { Modal, ToneBadge } from '../../calibration/components/primitives';
import { soporteApi } from '../api/soporte';
import { fechaHora } from '../domain/informe';
import { VisorPdf } from './VisorPdf';

export function DocumentosPanel({ documentos, nombreRaiz = 'Soporte Técnico', error, cargando, onRecargar, onAbrir }) {
  return <section aria-label="PDF guardados" className="rounded-2xl border border-line bg-surface p-4">
    <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-fg"><FileText className="h-4 w-4 text-fg-muted" aria-hidden="true" />PDF guardados</h3>
    {cargando ? <p role="status" className="mt-3 text-sm text-fg-muted">Consultando documentos…</p>
      : error ? <div role="alert" className="mt-3 flex flex-wrap items-center gap-3"><p className="min-w-0 flex-1 text-sm text-fg">{error.message}</p><Button size="sm" variant="secondary" onClick={onRecargar}>Reintentar</Button></div>
        : documentos.length === 0 ? <p className="mt-2 text-[13px] text-fg-muted">Al guardar un PDF en la carpeta que elija, podrá abrirlo desde aquí.</p>
          : <ul className="mt-3 divide-y divide-line">{documentos.map(doc => <li key={doc.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1 basis-48">
              <p className="break-all text-[13px] font-semibold text-fg">{doc.nombre}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted"><ToneBadge tone={doc.borrador ? 'warning' : 'success'}>{doc.borrador ? 'Borrador' : 'Emitido'} · Rev. {doc.revision}</ToneBadge>{doc.borrador && doc.version != null ? `Versión ${doc.version} · ` : ''}{fechaHora(doc.guardadoEn)}</p>
              <p className="mt-1 break-words text-xs text-fg-muted">{nombreRaiz}{doc.carpeta ? ` / ${doc.carpeta.split('/').join(' / ')}` : ''} · {doc.guardadoPor?.nombre || doc.guardadoPor?.usuario}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onAbrir(doc)}><FileText className="h-3.5 w-3.5" aria-hidden="true" />Abrir PDF</Button>
          </li>)}</ul>}
  </section>;
}

export function PdfGuardadoModal({ documento, onClose }) {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    let activo = true;
    let url;
    soporteApi.abrirPdf(documento.id).then(blob => {
      if (!activo) return;
      url = URL.createObjectURL(blob);
      setEstado({ intento, url });
    }).catch(error => { if (activo) setEstado({ intento, error }); });
    return () => { activo = false; if (url) URL.revokeObjectURL(url); };
  }, [documento.id, intento]);
  const actual = estado?.intento === intento ? estado : null;
  return <Modal title="PDF guardado" subtitle={documento.nombre} onClose={onClose}
    actions={actual?.url && <a href={actual.url} download={documento.nombre} title="Descargar PDF" className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-2"><Download className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Descargar PDF</span></a>}>
    {!actual ? <div role="status" className="flex h-56 items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Abriendo PDF…</div>
      : actual.error ? <div role="alert" className="space-y-3 p-6"><p className="text-sm text-fg">{actual.error.message}</p><Button variant="secondary" onClick={() => setIntento(i => i + 1)}>Reintentar</Button></div>
        : <div className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-fg-muted">
            <span>{documento.borrador ? 'Borrador' : 'Emitido'} · Rev. {documento.revision}</span>
            <a href={actual.url} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-1.5 font-semibold text-fg hover:underline"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />Abrir en otra pestaña</a>
          </div>
          <VisorPdf url={actual.url} nombre={documento.nombre} />
        </div>}
  </Modal>;
}
