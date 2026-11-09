import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pdfDeImagenes } from '../../../soporte/domain/pdf';
import { rasterizarHojas } from '../../../soporte/components/rasterizar';
import { CertificadoDocumento } from './CertificadoDocumento';
import { CertificadoProfesional } from './CertificadoProfesional';

// Cada modelo de certificado: su componente y las clases de sus hojas.
const MODELOS_CERTIFICADO = {
  actual: { Documento: CertificadoDocumento, documento: '.cc-doc', medidor: 'cc-medidor', pagina: 'cc-pagina' },
  sugerido: { Documento: CertificadoProfesional, documento: '.cp-doc', medidor: 'cp-medidor', pagina: 'cp-pagina' },
};

/** 3 píxeles por píxel CSS: unos 290 ppp, nítido al imprimir. */
const ESCALA = 3;
const CALIDAD = 0.92;

const esperarCuadros = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/** Espera a que el documento esté paginado (hasta unos 5 s). */
const esperarPaginado = async (raiz, documento) => {
  for (let i = 0; i < 300; i += 1) {
    if (raiz?.querySelector(`${documento}[data-paginado="si"]`)) return;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  throw new Error('No se pudo repartir el certificado en hojas.');
};

const jpegDe = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No se pudo convertir la hoja en imagen.'))), 'image/jpeg', CALIDAD);
});

/**
 * Arma el PDF del certificado: monta las mismas hojas de la vista previa
 * fuera de la pantalla, espera fuentes e imágenes, pasa cada hoja a imagen y
 * entrega el archivo a `onListo` (o el error a `onError`).
 */
export function PdfCertificado({ contenido, borrador, pie, titulo, marca = '', modelo = 'actual', onListo, onError }) {
  const tipo = MODELOS_CERTIFICADO[modelo] || MODELOS_CERTIFICADO.actual;
  const { Documento } = tipo;
  const raizRef = useRef(null);
  const [raiz] = useState(() => {
    const nodo = document.createElement('div');
    nodo.id = 'cc-guardado';
    return nodo;
  });

  useEffect(() => {
    document.body.appendChild(raiz);
    return () => raiz.remove();
  }, [raiz]);

  useEffect(() => {
    let activo = true;
    const generar = async () => {
      try {
        await document.fonts?.ready;
        await esperarCuadros();
        const imagenes = [...(raizRef.current?.querySelectorAll('img') || [])];
        await Promise.all(imagenes.map(img => (img.decode ? img.decode().catch(() => {}) : null)));
        await esperarPaginado(raizRef.current, tipo.documento);
        await esperarCuadros();
        if (!activo) return;
        const hojas = [...raizRef.current.querySelectorAll(`${tipo.documento}:not(.${tipo.medidor}) .${tipo.pagina}`)];
        if (!hojas.length) throw new Error('El certificado no tiene hojas.');
        const paginas = [];
        for (const canvas of await rasterizarHojas(hojas, { escala: ESCALA, documento: tipo.documento })) {
          const blob = await jpegDe(canvas);
          paginas.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), ancho: canvas.width, alto: canvas.height });
        }
        if (!activo) return;
        onListo(new Blob([pdfDeImagenes(paginas, { titulo, autor: 'Métrica Ltda.', palabrasClave: marca })], { type: 'application/pdf' }));
      } catch (error) {
        if (activo) onError(error);
      }
    };
    generar();
    return () => { activo = false; };
  // Se genera una vez al montar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div ref={raizRef}>
      <Documento contenido={contenido} borrador={borrador} pie={pie} />
    </div>,
    raiz,
  );
}
