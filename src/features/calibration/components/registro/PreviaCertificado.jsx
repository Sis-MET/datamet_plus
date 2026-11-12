import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, Download, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../../shared/utils/cn';
import { Button } from '../../../../shared/components/ui/Button';
import { calibrationApi } from '../../api/calibration';
import { Segmented } from '../primitives';
import { CertificadoDocumento } from '../certificado/CertificadoDocumento';
import { CertificadoProfesional } from '../certificado/CertificadoProfesional';
import { PdfCertificado } from '../certificado/PdfCertificado';
import { descargar } from '../certificado/descargar';

const ANCHO_HOJA = (210 / 25.4) * 96;
const ESPERA = 700;

const MODELOS = [
  { value: 'actual', label: 'Modelo actual' },
  { value: 'sugerido', label: 'Modelo sugerido' },
];

// Zoom sobre el ajuste al ancho del panel (1 = ajustado). Se recuerda en este
// navegador: en una pantalla chica conviene dejarlo más grande.
const ZOOM = { min: 0.5, max: 3, paso: 0.1 };
const CLAVE_ZOOM = 'datamet_previa_zoom';
const limitarZoom = valor => Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, valor)) * 100) / 100;
const zoomGuardado = () => {
  try {
    const valor = Number(localStorage.getItem(CLAVE_ZOOM));
    return valor > 0 ? limitarZoom(valor) : 1;
  } catch {
    return 1;
  }
};

const botonZoom = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[12px] font-semibold tabular-nums text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Hojas a escala del ancho del panel. Ctrl (o ⌘) + rueda del mouse, o pellizcar
 * en el touchpad, acerca o aleja solo la vista previa; los botones hacen lo mismo.
 */
function Hojas({ contenido, borrador, modelo }) {
  const ref = useRef(null);
  const [ajuste, setAjuste] = useState(0.55);
  const [zoom, setZoomEstado] = useState(zoomGuardado);
  const setZoom = useCallback((siguiente) => setZoomEstado((actual) => {
    const valor = limitarZoom(typeof siguiente === 'function' ? siguiente(actual) : siguiente);
    try { localStorage.setItem(CLAVE_ZOOM, String(valor)); } catch { /* sin almacenamiento: solo en esta vista */ }
    return valor;
  }), []);
  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;
    const medir = () => setAjuste(Math.max(0.25, Math.min(1.2, (nodo.clientWidth - 32) / ANCHO_HOJA)));
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);
  // La rueda con Ctrl hace zoom de la vista previa, no de toda la página.
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;
    const alGirar = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(z => z * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    nodo.addEventListener('wheel', alGirar, { passive: false });
    return () => nodo.removeEventListener('wheel', alGirar);
  }, [setZoom]);
  const Documento = modelo === 'sugerido' ? CertificadoProfesional : CertificadoDocumento;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1" role="group" aria-label="Zoom de la vista previa">
        <span className="mr-auto text-[11.5px] text-fg-subtle">Ctrl + rueda del mouse para acercar o alejar</span>
        <button type="button" className={botonZoom} onClick={() => setZoom(z => z - ZOOM.paso)} disabled={zoom <= ZOOM.min} aria-label="Alejar" title="Alejar">
          <ZoomOut className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cn(botonZoom, 'w-14')}
          onClick={() => setZoom(1)}
          disabled={zoom === 1}
          title="Ajustar al ancho del panel"
          aria-label={`Zoom ${Math.round(zoom * 100)} %; ajustar al ancho`}
        >
          {Math.round(zoom * 100)} %
        </button>
        <button type="button" className={botonZoom} onClick={() => setZoom(z => z + ZOOM.paso)} disabled={zoom >= ZOOM.max} aria-label="Acercar" title="Acercar">
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div ref={ref} className={cn('rounded-2xl bg-surface-3 p-4', modelo === 'sugerido' ? 'cp-vista' : 'cc-vista')} style={{ overflow: 'auto' }}>
        {/* Del ancho de las hojas: centrado si cabe; si no, se desplaza desde el borde izquierdo. */}
        <div style={{ zoom: ajuste * zoom, width: 'max-content', margin: '0 auto' }}>
          <Documento contenido={contenido} borrador={borrador} />
        </div>
      </div>
    </div>
  );
}

function Lista({ items, tono }) {
  if (!items?.length) return null;
  const Icono = tono === 'danger' ? AlertOctagon : AlertTriangle;
  return (
    <ul className="flex flex-col gap-1">
      {items.map(item => (
        <li key={item} className="flex gap-2 text-[12px] leading-snug text-fg">
          <Icono className={cn('mt-0.5 h-3.5 w-3.5 flex-none', tono === 'danger' ? 'text-danger' : 'text-warning')} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * El pre-informe: el certificado tal como saldría, con los cambios que aún
 * no se guardan (se recalcula en el servidor al dejar de escribir). Elige
 * entre el modelo actual (hoja CERT) y el sugerido; descarga el PDF.
 * `emision`: una emisión ya autorizada o emitida en particular.
 */
export function PreviaCertificado({ codigo, version, estado, cambios, pendientes, modelo, onModelo, emision = null, completo = false }) {
  const [previa, setPrevia] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(null);
  const [generando, setGenerando] = useState(null);
  const pedido = useRef(0);
  const clave = JSON.stringify(cambios);

  useEffect(() => {
    const id = pedido.current + 1;
    pedido.current = id;
    const conCambios = pendientes > 0 && emision == null;
    const temporizador = setTimeout(async () => {
      setCargando(true);
      try {
        const resultado = conCambios
          ? await calibrationApi.vistaPreviaCertificado(codigo, JSON.parse(clave))
          : await calibrationApi.certificado(codigo, emision);
        if (pedido.current !== id) return;
        setPrevia(resultado);
        setFallo(null);
      } catch (error) {
        if (pedido.current === id) setFallo(error.message);
      } finally {
        if (pedido.current === id) setCargando(false);
      }
    }, conCambios ? ESPERA : 0);
    return () => clearTimeout(temporizador);
  }, [clave, codigo, emision, estado, pendientes, version]);

  const paraFirmar = previa && !previa.borrador && previa.emision?.estado === 'AUTORIZADO';
  // Se firma y se emite el modelo actual; el sugerido es una propuesta.
  const nombre = previa?.archivo
    ? previa.archivo.replace(/\.pdf$/i, `${previa.borrador || modelo === 'sugerido' ? ' BORRADOR' : ''}${modelo === 'sugerido' ? ' MODELO SUGERIDO' : ''}`)
    : `${codigo} BORRADOR`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Modelo de certificado" value={modelo} onChange={onModelo} options={MODELOS} className="cal-tabs" />
        <span className="ml-auto flex items-center gap-2">
          {cargando && <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-label="Actualizando la vista previa" />}
          {previa && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setGenerando({ firmar: paraFirmar && modelo === 'actual' })}
              disabled={Boolean(generando) || pendientes > 0}
              title={pendientes > 0 ? 'Guarda los cambios para descargar el PDF' : undefined}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {paraFirmar && modelo === 'actual' ? 'PDF para firmar' : 'PDF borrador'}
            </Button>
          )}
        </span>
      </div>
      <p className="text-[12px] text-fg-muted">
        {pendientes > 0 && emision == null
          ? 'Con los cambios sin guardar. '
          : previa && !previa.borrador ? 'Contenido congelado de la emisión autorizada. ' : 'Con los datos guardados. '}
        {modelo === 'sugerido' ? 'El modelo sugerido es una propuesta de diseño: se emite con el modelo actual.' : 'Mismo diseño de la hoja CERT del libro.'}
      </p>
      {fallo && <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger" role="alert">{fallo}</p>}
      {previa && (completo || previa.bloqueos?.length > 0) && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5">
          <Lista items={previa.bloqueos} tono="danger" />
          {completo && <Lista items={previa.avisos} tono="warning" />}
          {!previa.bloqueos?.length && !previa.avisos?.length && <p className="text-[12px] text-fg-muted">Nada pendiente para emitirlo.</p>}
        </div>
      )}
      {previa ? <Hojas contenido={previa.contenido} borrador={previa.borrador} modelo={modelo} /> : !fallo && (
        <div className="flex min-h-[40vh] items-center justify-center rounded-2xl bg-surface-3" role="status" aria-label="Armando el certificado">
          <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
        </div>
      )}
      {generando && previa && (
        <PdfCertificado
          contenido={previa.contenido}
          modelo={modelo}
          borrador={previa.borrador || modelo === 'sugerido'}
          titulo={nombre}
          marca={generando.firmar ? previa.marca || '' : ''}
          onListo={(blob) => {
            descargar(blob, `${nombre}.pdf`);
            toast.success(`Se descargó ${nombre}.pdf`);
            setGenerando(null);
          }}
          onError={(error) => {
            toast.error(`No se pudo preparar el PDF: ${error.message}`);
            setGenerando(null);
          }}
        />
      )}
    </div>
  );
}
