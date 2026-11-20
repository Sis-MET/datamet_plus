import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SignatureCanvas from 'react-signature-canvas';
import { Check, Eraser, Maximize2, RotateCcw, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

const ALTO_RECUADRO = 200;
/** Lado mayor de la firma ampliada: nítida en el PDF sin pesar de más. */
const MAX_LADO_FIRMA = 1400;
const ENFOCABLES = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Rectángulo de los píxeles dibujados (no transparentes); null si no hay. */
function areaDibujada(canvas) {
  const { width, height } = canvas;
  const pixeles = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let izquierda = width;
  let derecha = -1;
  let arriba = height;
  let abajo = -1;
  for (let y = 0; y < height; y += 1) {
    const fila = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (pixeles[fila + x * 4 + 3] === 0) continue;
      if (x < izquierda) izquierda = x;
      if (x > derecha) derecha = x;
      if (y < arriba) arriba = y;
      abajo = y;
    }
  }
  if (derecha < 0) return null;
  return { x: izquierda, y: arriba, ancho: derecha - izquierda + 1, alto: abajo - arriba + 1 };
}

/**
 * Firma recortada a lo dibujado, con un margen, y reducida si es muy grande:
 * en un recuadro chico se ve del mismo tamaño que en la pantalla completa.
 * (El recorte de react-signature-canvas depende de trim-canvas, que no carga
 * con Vite.)
 */
function firmaRecortada(pad) {
  const canvas = pad.getCanvas();
  const area = areaDibujada(canvas) || { x: 0, y: 0, ancho: canvas.width, alto: canvas.height };
  const margen = Math.round(Math.max(area.ancho, area.alto) * 0.04) + 8;
  const ancho = area.ancho + margen * 2;
  const alto = area.alto + margen * 2;
  const escala = Math.min(1, MAX_LADO_FIRMA / Math.max(ancho, alto));
  const salida = document.createElement('canvas');
  salida.width = Math.max(1, Math.round(ancho * escala));
  salida.height = Math.max(1, Math.round(alto * escala));
  const context = salida.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    canvas,
    area.x, area.y, area.ancho, area.alto,
    margen * escala, margen * escala, area.ancho * escala, area.alto * escala,
  );
  return salida.toDataURL('image/png');
}

const esTactil = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Firma a pantalla completa, para que el cliente firme con espacio. En un
 * teléfono pide pantalla completa y horizontal (si el navegador lo permite).
 * Escape la cierra sin cerrar la ficha de atrás.
 */
function FirmaAmpliada({ label, onCancel, onListo }) {
  const padRef = useRef(null);
  const areaRef = useRef(null);
  const dialogRef = useRef(null);
  const tituloId = useId();
  const [vacia, setVacia] = useState(true);
  const [vertical, setVertical] = useState(() => window.innerHeight > window.innerWidth);

  // El lienzo ocupa toda el área; al girar o cambiar el tamaño se conserva lo firmado.
  useLayoutEffect(() => {
    const area = areaRef.current;
    const ajustar = () => {
      const pad = padRef.current;
      if (!pad || !area) return;
      const canvas = pad.getCanvas();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const { width, height } = area.getBoundingClientRect();
      if (canvas.width === Math.round(width * ratio) && canvas.height === Math.round(height * ratio)) return;
      const trazos = pad.toData();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext('2d').scale(ratio, ratio);
      pad.clear();
      if (trazos.length) pad.fromData(trazos);
      setVertical(window.innerHeight > window.innerWidth);
    };
    ajustar();
    const observer = new ResizeObserver(ajustar);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // En un teléfono: pantalla completa y horizontal; al salir, se deshace.
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.focus({ preventScroll: true });
    let pantallaCompleta = false;
    if (esTactil() && dialog?.requestFullscreen) {
      dialog.requestFullscreen({ navigationUI: 'hide' })
        .then(() => {
          pantallaCompleta = true;
          return window.screen?.orientation?.lock?.('landscape');
        })
        .catch(() => {});
    }
    return () => {
      try {
        window.screen?.orientation?.unlock?.();
      } catch {
        // Sin bloqueo de orientación: nada que deshacer.
      }
      if (pantallaCompleta && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // Escape y Tab se quedan aquí: la ficha de atrás no se cierra ni recibe el foco.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      event.stopPropagation();
      const items = [...(dialogRef.current?.querySelectorAll(ENFOCABLES) || [])];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);

  const limpiar = () => {
    padRef.current?.clear();
    setVacia(true);
  };

  const listo = () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    onListo(firmaRecortada(pad));
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      tabIndex={-1}
      className="fixed inset-0 z-[80] flex flex-col gap-3 bg-surface p-3 outline-none sm:gap-4 sm:p-5"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id={tituloId} className="text-[15px] font-semibold text-fg">{label}</h2>
          <p className="text-[12.5px] text-fg-muted">Firme dentro del recuadro blanco con el dedo, un lápiz o el mouse.</p>
        </div>
        {vertical && esTactil() && (
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg-muted" role="note">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Gire el teléfono para tener más espacio.
          </p>
        )}
      </div>

      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-white">
        <SignatureCanvas
          ref={padRef}
          penColor="black"
          minWidth={1}
          maxWidth={3.2}
          clearOnResize={false}
          canvasProps={{ className: 'block h-full w-full touch-none', 'aria-label': `${label}, pantalla completa` }}
          onBegin={() => setVacia(false)}
          onEnd={() => setVacia(padRef.current?.isEmpty() ?? true)}
        />
        {/* Línea de firma: orienta dónde firmar, no queda en la imagen. */}
        <div className="pointer-events-none absolute inset-x-[8%] bottom-[22%] border-b border-neutral-300" aria-hidden="true" />
        {vacia && (
          <p className="pointer-events-none absolute inset-x-0 bottom-[12%] text-center text-sm text-neutral-400">Firme aquí</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={limpiar}
          disabled={vacia}
          className="flex h-11 items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-semibold text-fg transition-colors hover:bg-fg/[0.05] disabled:opacity-50"
        >
          <Eraser className="h-4 w-4" aria-hidden="true" /> Limpiar
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Cancelar
          </button>
          <button
            type="button"
            onClick={listo}
            disabled={vacia}
            className="flex h-11 min-w-[112px] items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden="true" /> Listo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Firma en pantalla (táctil o con mouse). Devuelve la firma como PNG en data
 * URL con `onEnd`, o null al limpiarla. El recuadro es blanco en ambos temas:
 * la firma es trazo negro y así se ve igual en el PDF. «Ampliar» abre la
 * firma a pantalla completa; lo firmado allí reemplaza al recuadro.
 */
export function SignatureField({ label, onEnd, error }) {
  const sigPad = useRef(null);
  const containerRef = useRef(null);
  const ampliarRef = useRef(null);
  const labelId = useId();
  const [ampliando, setAmpliando] = useState(false);
  // Firma hecha a pantalla completa; mientras exista, el recuadro la muestra.
  const [ampliada, setAmpliada] = useState(null);

  const clear = () => {
    sigPad.current?.clear();
    setAmpliada(null);
    onEnd?.(null);
  };

  const handleEnd = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      onEnd?.(sigPad.current.toDataURL('image/png'));
    } else {
      onEnd?.(null);
    }
  };

  const cerrarAmpliada = useCallback(() => {
    setAmpliando(false);
    requestAnimationFrame(() => ampliarRef.current?.focus({ preventScroll: true }));
  }, []);

  const usarAmpliada = (dataUrl) => {
    sigPad.current?.clear();
    setAmpliada(dataUrl);
    onEnd?.(dataUrl);
    cerrarAmpliada();
  };

  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current && sigPad.current) {
        const canvas = sigPad.current.getCanvas();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = containerRef.current.offsetWidth;
        if (canvas.width !== width * ratio) {
          canvas.width = width * ratio;
          canvas.height = ALTO_RECUADRO * ratio;
          canvas.getContext('2d').scale(ratio, ratio);
        }
      }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div className="mb-4 w-full">
      <p id={labelId} className="field-label">
        {label} <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
      </p>
      <div
        ref={containerRef}
        role="group"
        aria-labelledby={labelId}
        className={cn(
          'relative h-[200px] overflow-hidden rounded-2xl border-2 border-dashed bg-white',
          error ? 'border-danger' : 'border-line-strong'
        )}
      >
        <SignatureCanvas
          ref={sigPad}
          penColor="black"
          canvasProps={{ className: 'block h-full w-full', 'aria-label': label }}
          onEnd={handleEnd}
        />
        {ampliada && (
          <div className="absolute inset-0 flex items-center justify-center bg-white p-3">
            <img src={ampliada} alt={`${label}, firmada a pantalla completa`} className="max-h-full max-w-full object-contain" />
          </div>
        )}
        <div className="absolute right-2 top-2 flex gap-1.5">
          <button
            ref={ampliarRef}
            type="button"
            onClick={() => setAmpliando(true)}
            aria-label={`Ampliar: ${label} a pantalla completa`}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 text-xs font-semibold text-neutral-700 shadow-xs hover:bg-neutral-100"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Ampliar
          </button>
          <button
            type="button"
            onClick={clear}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 text-xs font-semibold text-neutral-700 shadow-xs hover:bg-neutral-100"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" /> Limpiar
          </button>
        </div>
        {!error && !ampliada && <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-neutral-400">Firme aquí</p>}
      </div>
      {error && <p className="field-error">{error.message}</p>}
      {ampliando && <FirmaAmpliada label={label} onCancel={cerrarAmpliada} onListo={usarAmpliada} />}
    </div>
  );
}
