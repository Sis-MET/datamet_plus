/**
 * Prepara una foto del formulario web para registrarla con el RIM: la reduce
 * a [maxLado] píxeles en su lado mayor y la guarda como JPEG, para que el
 * registro no pese varios megabytes por foto.
 */
export async function fotoParaRegistro(file, { maxLado = 1600, calidad = 0.82 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const imagen = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo leer la foto ${file.name}.`));
      img.src = url;
    });
    const escala = Math.min(1, maxLado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const context = canvas.getContext('2d');
    // Fondo blanco: un PNG con transparencia no queda negro en JPEG.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    return { nombre: file.name, contenido: canvas.toDataURL('image/jpeg', calidad) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
