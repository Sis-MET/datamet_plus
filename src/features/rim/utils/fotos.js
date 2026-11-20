/** Carga una imagen (URL de objeto o data URL) para dibujarla en un canvas. */
function cargarImagen(src, nombre = 'la foto') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo leer ${nombre}.`));
    img.src = src;
  });
}

/** Dibuja la imagen en JPEG con fondo blanco, con su lado mayor en [maxLado] píxeles como máximo. */
function aJpeg(imagen, { maxLado, calidad }) {
  const escala = Math.min(1, maxLado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
  canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
  const context = canvas.getContext('2d');
  // Fondo blanco: un PNG con transparencia no queda negro en JPEG.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', calidad);
}

/**
 * Prepara una foto del formulario web para registrarla con el RIM: la reduce
 * a [maxLado] píxeles en su lado mayor y la guarda como JPEG, para que el
 * registro no pese varios megabytes por foto.
 */
export async function fotoParaRegistro(file, { maxLado = 1600, calidad = 0.82 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const imagen = await cargarImagen(url, `la foto ${file.name}`);
    return { nombre: file.name, contenido: aJpeg(imagen, { maxLado, calidad }) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Foto de un RIM lista para el PDF, que solo admite JPEG y PNG: esas pasan
 * tal cual y las demás (WebP…) se convierten a JPEG. Si el navegador no puede
 * leerla devuelve null, y el PDF muestra «[Imagen adjunta]».
 */
export async function fotoParaPdf(url, { maxLado = 1600, calidad = 0.85 } = {}) {
  if (!url) return null;
  if (/^data:image\/(jpe?g|png);/i.test(url)) return url;
  try {
    return aJpeg(await cargarImagen(url), { maxLado, calidad });
  } catch {
    return null;
  }
}
