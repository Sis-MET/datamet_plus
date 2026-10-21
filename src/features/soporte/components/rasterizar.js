/**
 * Pasa cada hoja del informe a imagen para «Guardar PDF».
 *
 * La hoja va dentro de una imagen SVG (foreignObject) con las reglas CSS de
 * la página, no con medidas copiadas: el navegador vuelve a acomodar la hoja
 * dentro de la imagen, como al imprimir, y el texto se mide con la misma
 * fuente con la que se dibuja. Copiar los anchos y altos de la pantalla (lo
 * que hace html-to-image) partía líneas y montaba textos cuando el navegador
 * dibujaba la fuente un poco más ancha en la imagen que en la pantalla.
 */

const XHTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';

/**
 * Propiedades de texto que .st-doc hereda de la página (body). Se copian al
 * contenedor de la imagen con su valor calculado; lo que .st-doc define
 * (fuente, tamaño, interlineado) lo ponen sus propias reglas, así el
 * interlineado sigue siendo proporcional al tamaño de cada texto.
 */
const HEREDADAS = [
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'font-kerning',
  'font-feature-settings', 'font-variant-ligatures', 'font-variant-numeric', 'letter-spacing',
  'word-spacing', 'text-rendering', '-webkit-font-smoothing', 'font-synthesis',
];

/** Reglas CSS de la página (las hojas de otro origen no se pueden leer y no hacen falta). */
export function cssDeLaPagina(hojas = document.styleSheets) {
  const partes = [];
  for (const hoja of hojas) {
    let reglas;
    try {
      reglas = hoja.cssRules;
    } catch {
      continue;
    }
    for (const regla of reglas) partes.push(regla.cssText);
  }
  return partes.join('\n');
}

const leerComoDataUrl = (blob) => new Promise((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(lector.result);
  lector.onerror = () => reject(lector.error);
  lector.readAsDataURL(blob);
});

/** Una imagen SVG no carga archivos externos: el logotipo va como data URL. */
async function incrustarImagenes(copia, cache) {
  for (const img of copia.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    const url = new URL(src, document.baseURI).href;
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then(respuesta => {
        if (!respuesta.ok) throw new Error(`No se pudo leer la imagen ${src}.`);
        return respuesta.blob();
      }).then(leerComoDataUrl));
    }
    img.setAttribute('src', await cache.get(url));
  }
}

const estiloEnLinea = (estilos, propiedades) => propiedades
  .map(propiedad => [propiedad, estilos.getPropertyValue(propiedad)])
  .filter(([, valor]) => valor)
  .map(([propiedad, valor]) => `${propiedad}:${valor}`)
  .join(';');

async function cargarImagen(url) {
  const imagen = new Image();
  imagen.src = url;
  await imagen.decode();
  return imagen;
}

/**
 * Dibuja cada hoja en un canvas, `escala` píxeles por píxel CSS.
 * @param {HTMLElement[]} hojas Las `.st-pagina` montadas (fuera de la pantalla).
 * @returns {Promise<HTMLCanvasElement[]>}
 */
export async function rasterizarHojas(hojas, { escala = 3 } = {}) {
  const css = cssDeLaPagina();
  const cache = new Map();
  const lienzos = [];
  for (const hoja of hojas) {
    // 210 × 297 mm en px CSS, con decimales (fuera de la pantalla no hay zoom).
    const { width: ancho, height: alto } = hoja.getBoundingClientRect();
    const doc = hoja.closest('.st-doc');
    const exterior = doc?.parentElement || document.body;

    // Lo que hereda de la página, y dentro el .st-doc con sus reglas, como en pantalla.
    const contenedor = document.createElementNS(XHTML, 'div');
    contenedor.setAttribute(
      'style',
      `${estiloEnLinea(getComputedStyle(exterior), HEREDADAS)};margin:0;padding:0;width:${ancho}px;height:${alto}px;background:#fff`,
    );
    const estilo = document.createElementNS(XHTML, 'style');
    estilo.textContent = css;
    const informe = document.createElementNS(XHTML, 'div');
    informe.setAttribute('class', doc?.getAttribute('class') || 'st-doc');
    const copia = hoja.cloneNode(true);
    await incrustarImagenes(copia, cache);
    informe.append(copia);
    contenedor.append(estilo, informe);

    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(ancho));
    svg.setAttribute('height', String(alto));
    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
    const objeto = document.createElementNS(SVG, 'foreignObject');
    objeto.setAttribute('x', '0');
    objeto.setAttribute('y', '0');
    objeto.setAttribute('width', '100%');
    objeto.setAttribute('height', '100%');
    objeto.append(contenedor);
    svg.append(objeto);

    const texto = new XMLSerializer().serializeToString(svg);
    const imagen = await cargarImagen(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`);

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(ancho * escala);
    lienzo.height = Math.round(alto * escala);
    const contexto = lienzo.getContext('2d');
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    lienzos.push(lienzo);
  }
  return lienzos;
}
