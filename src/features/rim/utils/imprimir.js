const MARCO_ID = 'rim-impresion-pdf';

/** Marco de la impresión anterior: se quita al imprimir otro PDF, no antes, porque el diálogo puede seguir leyéndolo. */
let anterior = null;

function quitarAnterior() {
  if (!anterior) return;
  anterior.marco.remove();
  URL.revokeObjectURL(anterior.url);
  anterior = null;
}

/**
 * Abre el diálogo de impresión del navegador con un PDF, sin salir de la
 * página: lo carga en un marco oculto y lo imprime desde ahí. Si el navegador
 * no deja imprimir el marco, abre el PDF en otra pestaña para imprimirlo allí.
 */
export function imprimirPdf(blob) {
  quitarAnterior();
  const url = URL.createObjectURL(blob);
  const marco = document.createElement('iframe');
  marco.id = MARCO_ID;
  marco.title = 'PDF para imprimir';
  marco.setAttribute('aria-hidden', 'true');
  marco.tabIndex = -1;
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  anterior = { marco, url };

  return new Promise((resolve) => {
    // Si el navegador descarga los PDF en vez de mostrarlos, el marco puede no
    // avisar que cargó: no se deja el botón esperando para siempre.
    const espera = setTimeout(() => resolve('sin-respuesta'), 15_000);
    const enOtraPestana = () => {
      clearTimeout(espera);
      window.open(url, '_blank', 'noopener');
      resolve('pestana');
    };
    marco.onload = () => {
      clearTimeout(espera);
      try {
        marco.contentWindow.focus();
        marco.contentWindow.print();
        resolve('dialogo');
      } catch {
        enOtraPestana();
      }
    };
    marco.onerror = enOtraPestana;
    marco.src = url;
    document.body.appendChild(marco);
  });
}
