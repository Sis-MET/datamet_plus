import React, { useRef, useEffect, useId } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

/**
 * Firma en pantalla (táctil o con mouse). Devuelve la firma como PNG en data
 * URL con `onEnd`, o null al limpiarla. El recuadro es blanco en ambos temas:
 * la firma es trazo negro y así se ve igual en el PDF.
 */
export function SignatureField({ label, onEnd, error }) {
  const sigPad = useRef(null);
  const containerRef = useRef(null);
  const labelId = useId();

  const clear = () => {
    sigPad.current?.clear();
    onEnd?.(null);
  };

  const handleEnd = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      onEnd?.(sigPad.current.toDataURL('image/png'));
    } else {
      onEnd?.(null);
    }
  };

  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current && sigPad.current) {
        const canvas = sigPad.current.getCanvas();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = containerRef.current.offsetWidth;
        if (canvas.width !== width * ratio) {
          canvas.width = width * ratio;
          canvas.height = 200 * ratio;
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
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-2 flex h-8 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 text-xs font-semibold text-neutral-700 shadow-xs hover:bg-neutral-100"
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden="true" /> Limpiar
        </button>
        {!error && <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-neutral-400">Firme aquí</p>}
      </div>
      {error && <p className="field-error">{error.message}</p>}
    </div>
  );
}
