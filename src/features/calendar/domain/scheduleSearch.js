/**
 * Buscador del cronograma (Ctrl + K). Busca en las tareas ya cargadas y en
 * las personas y vehículos; el servidor busca en todas las fechas
 * (/calendar/cronograma/buscar) y aquí se juntan ambos resultados.
 * Todo es puro: la misma entrada da el mismo resultado.
 */

const MARCAS = /\p{M}/gu;

/** Texto para comparar: sin tildes, en minúsculas y con espacios simples. */
export const normalizarBusqueda = valor => String(valor ?? '')
  .normalize('NFD')
  .replace(MARCAS, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

/** Palabras de la búsqueda (sin repetir, hasta cinco). Todas deben aparecer. */
export const palabrasBusqueda = q => [...new Set(normalizarBusqueda(q).split(' ').filter(Boolean))].slice(0, 5);

/** Una búsqueda empieza a buscar desde 2 caracteres, como el servidor. */
export const MIN_CARACTERES = 2;

export const esBusquedaValida = q => normalizarBusqueda(q).length >= MIN_CARACTERES;

const coincide = (texto, palabras) => palabras.every(palabra => texto.includes(palabra));

/** Días entre una tarea y hoy (sin signo): lo más cercano a hoy va primero. */
const distanciaAHoy = (fecha, hoy) => {
  const dia = new Date(fecha);
  dia.setHours(12, 0, 0, 0);
  const base = new Date(hoy);
  base.setHours(12, 0, 0, 0);
  return Math.abs(Math.round((dia - base) / 86400000));
};

/** Orden de los resultados: más cerca de hoy primero; a igual distancia, la más reciente. */
export const ordenarPorCercania = (tareas, hoy = new Date()) => [...tareas].sort((a, b) => (
  distanciaAHoy(a.fecha, hoy) - distanciaAHoy(b.fecha, hoy)
  || new Date(b.fecha) - new Date(a.fecha)
  || String(a.horaInicio || '').localeCompare(String(b.horaInicio || ''))
));

/** Texto de una tarea donde se busca: lo que muestra la ficha y quién la tiene. */
const textoDeTarea = (tarea, nombreRecurso) => normalizarBusqueda([
  tarea.tipoTarea, tarea.cotizacion, tarea.descripcion, tarea.cliente, tarea.planta, nombreRecurso, tarea.createdBy,
].filter(Boolean).join(' '));

/**
 * Tareas cargadas que coinciden con la búsqueda. `nombreDe(id)` da el nombre
 * de la persona o vehículo de la fila para buscar también por él.
 */
export function buscarTareas(tareas = [], q, { nombreDe = () => '', hoy = new Date(), limite = 40 } = {}) {
  const palabras = palabrasBusqueda(q);
  if (!esBusquedaValida(q) || palabras.length === 0) return [];
  const encontradas = tareas.filter(tarea => coincide(textoDeTarea(tarea, nombreDe(tarea.Tecnico)), palabras));
  return ordenarPorCercania(encontradas, hoy).slice(0, limite);
}

/** Personas y vehículos que coinciden por nombre, cargo o área. */
export function buscarRecursos(recursos = [], q, limite = 6) {
  const palabras = palabrasBusqueda(q);
  if (!esBusquedaValida(q) || palabras.length === 0) return [];
  return recursos
    .filter(recurso => coincide(normalizarBusqueda([recurso.nombre, recurso.cargo, recurso.area].join(' ').replace(/_/g, ' ')), palabras))
    .slice(0, limite);
}

/**
 * Junta las tareas cargadas con las que trajo el servidor, sin repetir la
 * misma fila (vale la cargada: es la que se edita en la grilla).
 */
export function combinarTareas(locales = [], remotas = [], { hoy = new Date(), limite = 40 } = {}) {
  const vistas = new Set(locales.map(tarea => String(tarea.rowId)));
  const nuevas = remotas.filter(tarea => !vistas.has(String(tarea.rowId)));
  return ordenarPorCercania([...locales, ...nuevas], hoy).slice(0, limite);
}

/**
 * Partes de `texto` para resaltar las palabras buscadas: [{ texto, marca }].
 * Compara sin tildes ni mayúsculas pero devuelve el texto original.
 */
export function resaltar(texto, q) {
  const original = String(texto ?? '');
  const palabras = palabrasBusqueda(q);
  if (!original || palabras.length === 0) return [{ texto: original, marca: false }];
  const caracteres = [...original.normalize('NFC')];
  const base = caracteres.map(c => c.normalize('NFD').replace(MARCAS, '').toLowerCase());
  // Si algún carácter no tiene una sola letra base, no se puede alinear: sin resaltar.
  if (base.some(c => c.length !== 1)) return [{ texto: original, marca: false }];
  const plano = base.join('');
  const marcado = new Array(caracteres.length).fill(false);
  for (const palabra of palabras) {
    let desde = plano.indexOf(palabra);
    while (desde !== -1) {
      for (let i = desde; i < desde + palabra.length; i += 1) marcado[i] = true;
      desde = plano.indexOf(palabra, desde + palabra.length);
    }
  }
  const partes = [];
  caracteres.forEach((c, i) => {
    const ultima = partes[partes.length - 1];
    if (ultima && ultima.marca === marcado[i]) ultima.texto += c;
    else partes.push({ texto: c, marca: marcado[i] });
  });
  return partes;
}
