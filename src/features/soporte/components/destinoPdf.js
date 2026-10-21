/**
 * Dónde guardar el PDF del informe. El navegador deja elegir la carpeta (y
 * la recuerda) solo en un sitio seguro: HTTPS o localhost. Por HTTP con una
 * IP, el PDF se descarga.
 */

const TIPO_PDF = { description: 'Informe PDF', accept: { 'application/pdf': ['.pdf'] } };

export const puedeElegirCarpeta = () => typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

/**
 * Pide dónde guardar el PDF. Se llama al hacer clic (el navegador exige que
 * venga del clic). Devuelve el archivo elegido, null para descargarlo o
 * undefined si el usuario canceló.
 */
export async function pedirDestino(nombre) {
  if (!puedeElegirCarpeta()) return null;
  try {
    // `id` hace que el navegador abra la última carpeta usada para informes.
    return await window.showSaveFilePicker({ id: 'informes-soporte', suggestedName: `${nombre}.pdf`, types: [TIPO_PDF] });
  } catch (error) {
    if (error?.name === 'AbortError') return undefined;
    return null;
  }
}
