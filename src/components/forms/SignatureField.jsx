import React, { useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '../ui/Button';
import { Eraser } from 'lucide-react';

export function SignatureField({ label, onEnd, error }) {
  const sigPad = useRef(null);
  const containerRef = useRef(null);

  const clear = () => {
    sigPad.current?.clear();
    onEnd?.(null);
  };

  const handleEnd = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
       onEnd?.(sigPad.current.toDataURL());
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
         
         // Only resize if width changed significantly to avoid loops or unnecessary clears
         if (canvas.width !== width * ratio) {
             canvas.width = width * ratio;
             canvas.height = 200 * ratio;
             canvas.getContext("2d").scale(ratio, ratio);
             // Note: This clears the canvas on resize.
         }
       }
    };
    
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  return (
    <div className="w-full mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      <div 
        ref={containerRef}
        className={`border-2 rounded-lg bg-white overflow-hidden relative ${error ? 'border-red-500 bg-red-50' : 'border-gray-600 border-dashed'}`}
        style={{ height: '200px' }}
      >
        <SignatureCanvas
          ref={sigPad}
          penColor="black"
          canvasProps={{
            className: 'w-full h-full block'
          }}
          onEnd={handleEnd}
        />
        <div className="absolute top-2 right-2">
           <Button type="button" variant="secondary" size="sm" onClick={clear} title="Limpiar firma">
             <Eraser className="h-4 w-4" />
           </Button>
        </div>
        {!error && <div className="absolute bottom-2 left-2 text-xs text-gray-400 pointer-events-none">Firmar aquí</div>}
      </div>
       {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
