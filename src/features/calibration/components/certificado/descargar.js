import { toast } from 'sonner';
import { calibrationApi } from '../../api/calibration';

/** Descarga un Blob con su nombre. */
export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Abre en otra pestaña el PDF firmado archivado de una emisión. */
export async function abrirFirmado(codigo, emision) {
  try {
    const blob = await calibrationApi.pdfCertificado(codigo, emision);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (error) {
    toast.error(error.message || 'No se pudo abrir el PDF firmado.');
  }
}
