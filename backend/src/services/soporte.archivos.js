const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const MAX_PDF_BYTES = 30 * 1024 * 1024;
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const hash = value => createHash('sha256').update(value).digest('hex');
const reservado = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const segmentoValido = value => typeof value === 'string' && value.length > 0 && value.length <= 220
  && !/[<>:"/\\|?*]/.test(value) && [...value].every(c => c.charCodeAt(0) >= 32) && !/[. ]$/.test(value)
  && value !== '.' && value !== '..' && !reservado.test(value);

function carpetaRelativa(value = '') {
  if (typeof value !== 'string' || value.length > 1200 || (value && !value.split('/').every(segmentoValido))) {
    throw error(400, 'La carpeta seleccionada no es válida. Selecciónela nuevamente.');
  }
  return value;
}

function nombrePdf(value) {
  if (!segmentoValido(value) || value.length <= 4 || !/\.pdf$/i.test(value)) throw error(400, 'Escriba un nombre de archivo válido terminado en .pdf.');
  return value;
}

function validarPdf(value) {
  if (!Buffer.isBuffer(value) || value.length < 15 || value.length > MAX_PDF_BYTES
    || value.subarray(0, 5).toString() !== '%PDF-' || !value.subarray(-1024).includes(Buffer.from('%%EOF'))) {
    throw error(400, 'El documento debe ser un PDF válido de hasta 30 MB.');
  }
}

const dentro = (raiz, destino) => {
  const relativo = path.relative(raiz, destino);
  return relativo === '' || (!relativo.startsWith(`..${path.sep}`) && relativo !== '..' && !path.isAbsolute(relativo));
};

function crearArchivo(ubicacion) {
  const traducir = cause => {
    if (cause.statusCode) return cause;
    if (['ENOENT', 'ENOTDIR'].includes(cause.code)) return error(404, 'La carpeta o el PDF ya no están disponibles en el servidor.');
    if (['EACCES', 'EPERM'].includes(cause.code)) return error(503, 'DataMET+ no tiene acceso a la carpeta seleccionada. Solicite revisar sus permisos.');
    if (cause.code === 'ENOSPC') return error(503, 'El servidor no tiene espacio disponible para guardar el PDF.');
    return error(503, 'No se pudo acceder al archivo de Soporte. Compruebe la disponibilidad de la carpeta en el servidor.');
  };
  const raiz = async () => {
    if (!ubicacion || !path.isAbsolute(ubicacion)) throw error(503, 'El archivo de Soporte no está configurado en el servidor.');
    try {
      const real = await fs.realpath(ubicacion);
      if (!(await fs.stat(real)).isDirectory()) throw error(503, 'La carpeta del archivo de Soporte no está disponible.');
      return real;
    } catch (cause) { throw cause.statusCode ? cause : error(503, 'La carpeta del archivo de Soporte no está disponible en el servidor.'); }
  };
  const resolver = async (carpeta = '') => {
    carpetaRelativa(carpeta);
    const base = await raiz();
    let actual = base;
    try {
      for (const parte of carpeta ? carpeta.split('/') : []) {
        actual = path.join(actual, parte);
        const stat = await fs.lstat(actual);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw error(400, 'Seleccione una carpeta del archivo de Soporte. Los accesos directos no están disponibles.');
        actual = await fs.realpath(actual);
        if (!dentro(base, actual)) throw error(403, 'La carpeta está fuera del archivo de Soporte.');
      }
      return { base, carpeta: actual, raizHuella: hash(process.platform === 'win32' ? base.toLowerCase() : base) };
    } catch (cause) { throw traducir(cause); }
  };
  const leer = async (carpeta, nombre) => {
    nombrePdf(nombre);
    const destino = await resolver(carpeta);
    const archivo = path.join(destino.carpeta, nombre);
    try {
      const stat = await fs.lstat(archivo);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_PDF_BYTES) throw error(409, 'El archivo guardado ya no corresponde a un PDF disponible.');
      const real = await fs.realpath(archivo);
      if (!dentro(destino.base, real)) throw error(403, 'El archivo está fuera del archivo de Soporte.');
      const contenido = await fs.readFile(real);
      if (contenido.length > MAX_PDF_BYTES) throw error(409, 'El archivo guardado supera el tamaño permitido.');
      return { ...destino, contenido, huella: hash(contenido) };
    } catch (cause) { throw traducir(cause); }
  };
  return {
    configurado: Boolean(ubicacion),
    resolver,
    async listar(carpeta = '') {
      const destino = await resolver(carpeta);
      try {
        const entradas = await fs.readdir(destino.carpeta, { withFileTypes: true });
        const carpetas = entradas.filter(e => e.isDirectory() && !e.isSymbolicLink() && segmentoValido(e.name))
          .map(e => ({ nombre: e.name, ruta: carpeta ? `${carpeta}/${e.name}` : e.name }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' }));
        return { nombreRaiz: path.basename(destino.base), carpeta, carpetas };
      } catch (cause) { throw traducir(cause); }
    },
    leer,
    async guardar(carpeta, nombre, contenido) {
      nombrePdf(nombre);
      validarPdf(contenido);
      const destino = await resolver(carpeta);
      const archivo = path.join(destino.carpeta, nombre);
      let handle;
      try {
        handle = await fs.open(archivo, 'wx');
      } catch (cause) {
        if (cause.code !== 'EEXIST') throw traducir(cause);
        const existente = await leer(carpeta, nombre);
        if (existente.huella !== hash(contenido)) throw error(409, 'Ya existe un archivo con ese nombre. Cambie el nombre para conservar ambos documentos.');
        return { ...destino, huella: existente.huella };
      }
      try {
        await handle.writeFile(contenido);
        await handle.sync();
      } catch (cause) {
        await handle.close();
        await fs.unlink(archivo).catch(() => {});
        throw traducir(cause);
      }
      await handle.close();
      return { ...destino, huella: hash(contenido) };
    },
  };
}

module.exports = { crearArchivo, carpetaRelativa, nombrePdf, validarPdf, hash, MAX_PDF_BYTES };
