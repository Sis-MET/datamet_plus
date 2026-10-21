import { CLASES_VALORACION, claseValoracion } from '../../domain/valoraciones';

/**
 * Símbolos de valoración del informe, con los colores de las plantillas
 * Excel: ✓ verde (bueno), ⚠ ámbar (regular), ✗ rojo (malo) y ⊘ gris (no
 * aplica). Son SVG para que salgan nítidos en el PDF.
 */
const DIBUJOS = {
  bueno: (
    <path d="M3.5 12.8 9.2 18.6 20.8 5.4" fill="none" stroke="#00B050" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  ),
  regular: (
    <>
      <path d="M12 2.8 22.4 20.9H1.6Z" fill="none" stroke="#FFC000" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M12 9v5.6" stroke="#FFC000" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="12" cy="17.7" r="1.5" fill="#FFC000" />
    </>
  ),
  malo: (
    <>
      <path d="M5.2 5.2 18.8 18.8" stroke="#FF0000" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M18.8 5.2 5.2 18.8" stroke="#FF0000" strokeWidth="3.6" strokeLinecap="round" />
    </>
  ),
  noaplica: (
    <>
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="#8C8C8C" strokeWidth="2.2" />
      <path d="M6 18 18 6" stroke="#8C8C8C" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
};

export function Simbolo({ clase, size = '13pt', className }) {
  if (!DIBUJOS[clase]) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={CLASES_VALORACION[clase].label}
      className={className}
      style={{ display: 'inline-block', flex: 'none' }}
    >
      {DIBUJOS[clase]}
    </svg>
  );
}

/** Valor de una casilla: su símbolo si es una valoración, si no el texto o «-». */
export function Valoracion({ valor, size }) {
  const clase = claseValoracion(valor);
  if (clase) return <Simbolo clase={clase} size={size} />;
  if (valor === null || valor === undefined || String(valor).trim() === '') return '-';
  return String(valor);
}
