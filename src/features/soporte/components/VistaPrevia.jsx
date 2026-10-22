import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InformeDocumento } from './documento/InformeDocumento';

/** Ancho de una hoja A4 en píxeles CSS (210 mm a 96 ppp). */
const ANCHO_HOJA = (210 / 25.4) * 96;

/** Vista previa a escala del informe, con las mismas hojas que se imprimen. */
export function VistaPrevia({ plantilla, numero, valores, fotos, borrador, pie, notas, className }) {
  const contenedorRef = useRef(null);
  const [escala, setEscala] = useState(0.6);

  useLayoutEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return undefined;
    const medir = () => {
      const ancho = contenedor.clientWidth - 32;
      setEscala(Math.max(0.3, Math.min(1.25, ancho / ANCHO_HOJA)));
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(contenedor);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={contenedorRef} className={`st-vista ${className || ''}`}>
      <div style={{ zoom: escala }}>
        <InformeDocumento plantilla={plantilla} numero={numero} valores={valores} fotos={fotos} borrador={borrador} pie={pie} notas={notas} />
      </div>
    </div>
  );
}

/**
 * Imprime el informe (o lo guarda como PDF desde el diálogo del navegador):
 * monta las hojas fuera de la pantalla, espera las fuentes y las fotos, pone
 * el nombre del archivo en el título de la página y abre la impresión.
 */
export function Impresion({ plantilla, numero, valores, fotos, borrador, pie, notas, titulo, onTerminar }) {
  const raizRef = useRef(null);
  const [raiz] = useState(() => {
    const nodo = document.createElement('div');
    nodo.id = 'st-impresion';
    return nodo;
  });

  useEffect(() => {
    document.body.appendChild(raiz);
    return () => raiz.remove();
  }, [raiz]);

  useEffect(() => {
    let activo = true;
    const tituloAnterior = document.title;
    const terminar = () => {
      document.body.classList.remove('st-imprimiendo');
      document.title = tituloAnterior;
      window.removeEventListener('afterprint', terminar);
      if (activo) onTerminar();
    };
    const imprimir = async () => {
      await document.fonts?.ready;
      // Dos cuadros: la paginación se calcula al montar.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const imagenes = [...(raizRef.current?.querySelectorAll('img') || [])];
      await Promise.all(imagenes.map(img => (img.decode ? img.decode().catch(() => {}) : null)));
      if (!activo) return;
      document.title = titulo;
      document.body.classList.add('st-imprimiendo');
      window.addEventListener('afterprint', terminar);
      window.print();
    };
    imprimir();
    return () => {
      activo = false;
    };
  // Se imprime una vez al montar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div ref={raizRef}>
      <InformeDocumento plantilla={plantilla} numero={numero} valores={valores} fotos={fotos} borrador={borrador} pie={pie} notas={notas} />
    </div>,
    raiz,
  );
}
