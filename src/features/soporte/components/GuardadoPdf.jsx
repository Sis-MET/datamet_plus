import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { InformeDocumento } from './documento/InformeDocumento';
import { pdfDeImagenes } from '../domain/pdf';

/**
 * Píxeles por píxel CSS al pasar cada hoja a imagen: 3 da unos 290 ppp, nítido
 * al imprimir. La calidad JPEG mantiene el archivo en 0,3–1 MB por hoja.
 */
const ESCALA = 3;
const CALIDAD = 0.9;

const esperarCuadros = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const jpegDe = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No se pudo convertir la hoja en imagen.'))), 'image/jpeg', CALIDAD);
});

/** Pasa cada hoja del informe a JPEG, en orden. */
async function capturarHojas(raiz) {
  const { getFontEmbedCSS, toCanvas } = await import('html-to-image');
  const hojas = [...raiz.querySelectorAll('.st-doc:not(.st-medidor) .st-pagina')];
  if (hojas.length === 0) throw new Error('El informe no tiene hojas para guardar.');
  // Las fuentes se leen una vez y se reusan en cada hoja.
  const fontEmbedCSS = await getFontEmbedCSS(hojas[0]);
  const paginas = [];
  for (const hoja of hojas) {
    const canvas = await toCanvas(hoja, { pixelRatio: ESCALA, backgroundColor: '#ffffff', fontEmbedCSS });
    const blob = await jpegDe(canvas);
    paginas.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), ancho: canvas.width, alto: canvas.height });
  }
  return paginas;
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Guarda el informe como PDF: monta las hojas fuera de la pantalla (las
 * mismas de la vista previa), espera fuentes y fotos, las pasa a imagen y
 * escribe el archivo en la carpeta elegida o lo descarga.
 */
export function GuardadoPdf({ plantilla, numero, valores, fotos, borrador, pie, titulo, destino, onTerminar }) {
  const raizRef = useRef(null);
  const [raiz] = useState(() => {
    const nodo = document.createElement('div');
    nodo.id = 'st-guardado';
    return nodo;
  });

  useEffect(() => {
    document.body.appendChild(raiz);
    return () => raiz.remove();
  }, [raiz]);

  useEffect(() => {
    let activo = true;
    const guardar = async () => {
      const aviso = toast.loading('Preparando el PDF…');
      try {
        await document.fonts?.ready;
        // Dos cuadros: la paginación se calcula al montar.
        await esperarCuadros();
        const imagenes = [...(raizRef.current?.querySelectorAll('img') || [])];
        await Promise.all(imagenes.map(img => (img.decode ? img.decode().catch(() => {}) : null)));
        // Desmontado antes de empezar (p. ej., el doble montaje de desarrollo).
        if (!activo) {
          toast.dismiss(aviso);
          return;
        }
        const paginas = await capturarHojas(raizRef.current);
        const archivo = `${titulo}.pdf`;
        const pdf = new Blob([pdfDeImagenes(paginas, { titulo, autor: 'Métrica Ltda.' })], { type: 'application/pdf' });
        if (destino) {
          const escritura = await destino.createWritable();
          await escritura.write(pdf);
          await escritura.close();
          toast.success(`Se guardó ${destino.name}.`, { id: aviso });
        } else {
          descargar(pdf, archivo);
          toast.success(`Se descargó ${archivo}.`, {
            id: aviso,
            description: window.isSecureContext
              ? undefined
              : 'Se guarda en Descargas. Para elegir la carpeta cada vez, active en el navegador «Preguntar dónde guardar cada archivo antes de descargarlo».',
            duration: 9000,
          });
        }
      } catch (error) {
        toast.error(`No se pudo guardar el PDF: ${error.message}`, { id: aviso });
      } finally {
        if (activo) onTerminar();
      }
    };
    guardar();
    return () => {
      activo = false;
    };
  // Se guarda una vez al montar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div ref={raizRef}>
      <InformeDocumento plantilla={plantilla} numero={numero} valores={valores} fotos={fotos} borrador={borrador} pie={pie} />
    </div>,
    raiz,
  );
}
