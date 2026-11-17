/**
 * Dónde se hizo cada servicio, para el mapa de los tiempos de servicio.
 *
 * Desde ServiceMET 6.3.5 cada servicio trae la ubicación aproximada del
 * teléfono (latitud y longitud). Con ella se ubica el punto en el mapa y su
 * departamento; sin ella (lo subido antes) vale el departamento de la planta.
 * Todo es puro: la misma entrada da el mismo resultado.
 */
import { ALTO, ANCHO, DEPARTAMENTOS, PROYECCION } from './boliviaGeo';

export { ALTO, ANCHO };

export const SIN_DEPARTAMENTO = 'SIN_DEPARTAMENTO';

/** Departamentos en orden alfabético: { id, nombre }. */
export const LISTA_DEPARTAMENTOS = DEPARTAMENTOS.map(({ clave, nombre }) => ({ id: clave, nombre }));

const NOMBRES = new Map(LISTA_DEPARTAMENTOS.map(d => [d.id, d.nombre]));

export const nombreDepartamento = id => (id === SIN_DEPARTAMENTO ? 'Sin departamento' : NOMBRES.get(id) || id);

// ─── Proyección ────────────────────────────────────────────────────────────

/** Latitud y longitud en las unidades del mapa ([x, y]); null si no son coordenadas válidas. */
export function proyectar(lat, lng) {
  if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') return null;
  const latitud = Number(lat);
  const longitud = Number(lng);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  if (Math.abs(latitud) > 90 || Math.abs(longitud) > 180 || (latitud === 0 && longitud === 0)) return null;
  return [
    (longitud - PROYECCION.minLon) * PROYECCION.cos * PROYECCION.k,
    (PROYECCION.maxLat - latitud) * PROYECCION.k,
  ];
}

const cajaDe = (anillos) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const anillo of anillos) {
    for (let i = 0; i < anillo.length; i += 2) {
      minX = Math.min(minX, anillo[i]);
      maxX = Math.max(maxX, anillo[i]);
      minY = Math.min(minY, anillo[i + 1]);
      maxY = Math.max(maxY, anillo[i + 1]);
    }
  }
  return [minX, minY, maxX, maxY];
};

/** ¿El punto está dentro del anillo? (regla par-impar). */
const dentroDeAnillo = (x, y, anillo) => {
  let dentro = false;
  for (let i = 0, j = anillo.length - 2; i < anillo.length; j = i, i += 2) {
    const xi = anillo[i];
    const yi = anillo[i + 1];
    const xj = anillo[j];
    const yj = anillo[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};

/** Dentro de un departamento: par-impar sobre todos sus anillos (así los huecos quedan fuera). */
const dentroDe = (x, y, anillos) => anillos.reduce((dentro, anillo) => (dentroDeAnillo(x, y, anillo) ? !dentro : dentro), false);

/** Distancia de un punto al borde más cercano del anillo. */
const distanciaAlBorde = (x, y, anillo) => {
  let minima = Infinity;
  for (let i = 0, j = anillo.length - 2; i < anillo.length; j = i, i += 2) {
    const ax = anillo[j];
    const ay = anillo[j + 1];
    const dx = anillo[i] - ax;
    const dy = anillo[i + 1] - ay;
    const largo = dx * dx + dy * dy;
    const t = largo ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / largo)) : 0;
    minima = Math.min(minima, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return minima;
};

const areaDe = (anillo) => {
  let area = 0;
  for (let i = 0, j = anillo.length - 2; i < anillo.length; j = i, i += 2) area += (anillo[j] + anillo[i]) * (anillo[j + 1] - anillo[i + 1]);
  return Math.abs(area / 2);
};

/**
 * Dónde escribir el nombre: el punto del anillo mayor más alejado de sus
 * bordes (un centro visual que cae siempre dentro, aun en formas curvas).
 */
const centroVisual = (anillos) => {
  const mayor = anillos.reduce((a, b) => (areaDe(b) > areaDe(a) ? b : a));
  const [minX, minY, maxX, maxY] = cajaDe([mayor]);
  let mejor = [(minX + maxX) / 2, (minY + maxY) / 2];
  let mejorDistancia = -1;
  const pasos = 28;
  for (let i = 1; i < pasos; i += 1) {
    for (let j = 1; j < pasos; j += 1) {
      const x = minX + ((maxX - minX) * i) / pasos;
      const y = minY + ((maxY - minY) * j) / pasos;
      if (!dentroDeAnillo(x, y, mayor)) continue;
      const distancia = distanciaAlBorde(x, y, mayor);
      if (distancia > mejorDistancia) {
        mejorDistancia = distancia;
        mejor = [x, y];
      }
    }
  }
  return mejor;
};

const rutaDe = anillos => anillos.map((anillo) => {
  let ruta = `M${anillo[0]} ${anillo[1]}`;
  for (let i = 2; i < anillo.length; i += 2) ruta += `L${anillo[i]} ${anillo[i + 1]}`;
  return `${ruta}Z`;
}).join('');

let geometria = null;

/**
 * Geometría para dibujar: por departamento su ruta SVG, su caja
 * [minX, minY, maxX, maxY] y dónde va su nombre. Se calcula una vez.
 */
export function geometriaDepartamentos() {
  if (!geometria) {
    geometria = DEPARTAMENTOS.map(({ clave, nombre, anillos }) => ({
      id: clave,
      nombre,
      anillos,
      caja: cajaDe(anillos),
      ruta: rutaDe(anillos),
      etiqueta: centroVisual(anillos),
    }));
  }
  return geometria;
}

/** Unidades del mapa a [latitud, longitud] (lo inverso de `proyectar`). */
export const desproyectar = (x, y) => [
  PROYECCION.maxLat - y / PROYECCION.k,
  x / (PROYECCION.cos * PROYECCION.k) + PROYECCION.minLon,
];

let poligonos = null;

/** Contorno de cada departamento en latitud y longitud, para el mapa con calles: { id, nombre, anillos: [[[lat, lng], …]] }. */
export function poligonosDepartamentos() {
  if (!poligonos) {
    poligonos = geometriaDepartamentos().map(({ id, nombre, anillos }) => ({
      id,
      nombre,
      anillos: anillos.map((anillo) => {
        const puntos = [];
        for (let i = 0; i < anillo.length; i += 2) puntos.push(desproyectar(anillo[i], anillo[i + 1]));
        return puntos;
      }),
    }));
  }
  return poligonos;
}

/** Departamento que contiene el punto del mapa, o null si cae fuera de Bolivia. */
export function departamentoEnPunto(x, y) {
  for (const departamento of geometriaDepartamentos()) {
    const [minX, minY, maxX, maxY] = departamento.caja;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    if (dentroDe(x, y, departamento.anillos)) return departamento.id;
  }
  return null;
}

// ─── Departamento escrito en la planta ─────────────────────────────────────

const plano = texto => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z]/g, '');

const CLAVES = new Map(LISTA_DEPARTAMENTOS.map(d => [plano(d.id), d.id]));

/** Abreviaturas y capitales que aparecen en lugar del departamento. */
const ALIAS = new Map(Object.entries({
  LP: 'LA PAZ', LPZ: 'LA PAZ', ELALTO: 'LA PAZ',
  SC: 'SANTA CRUZ', SCZ: 'SANTA CRUZ', SANTACRUZDELASIERRA: 'SANTA CRUZ',
  CB: 'COCHABAMBA', CBBA: 'COCHABAMBA',
  PT: 'POTOSI', PTS: 'POTOSI', PTI: 'POTOSI',
  OR: 'ORURO', ORU: 'ORURO',
  TJ: 'TARIJA', TJA: 'TARIJA',
  CH: 'CHUQUISACA', CHQ: 'CHUQUISACA', SUCRE: 'CHUQUISACA',
  BN: 'BENI', ELBENI: 'BENI', TRINIDAD: 'BENI',
  PA: 'PANDO', COBIJA: 'PANDO',
}));

/**
 * Departamento escrito como sea («SANTA CRUZ», «Potosí», «POTOS�», «SCZ»,
 * «El Alto») como su clave («SANTA CRUZ», «POTOSI»…); null si no se reconoce.
 */
export function normalizarDepartamento(texto) {
  const valor = plano(texto);
  if (!valor) return null;
  if (CLAVES.has(valor)) return CLAVES.get(valor);
  if (ALIAS.has(valor)) return ALIAS.get(valor);
  // Texto con caracteres dañados o de más («POTOS», «DPTO LA PAZ»).
  if (valor.length >= 4) {
    for (const [clave, id] of CLAVES) {
      if (valor.includes(clave) || clave.startsWith(valor)) return id;
    }
  }
  return null;
}

// ─── Servicios ─────────────────────────────────────────────────────────────

/**
 * El servicio con su lugar: `punto` ([x, y] en el mapa, si la ubicación cae
 * en Bolivia), `departamento` (clave o SIN_DEPARTAMENTO) y `origenUbicacion`
 * ('gps' si el departamento salió de la ubicación, 'planta' si de la planta).
 */
export function ubicarServicio(servicio) {
  const coordenadas = servicio.ubicacion ? proyectar(servicio.ubicacion.lat, servicio.ubicacion.lng) : null;
  const porGps = coordenadas ? departamentoEnPunto(coordenadas[0], coordenadas[1]) : null;
  if (porGps) return { ...servicio, punto: coordenadas, departamento: porGps, origenUbicacion: 'gps' };
  const porPlanta = normalizarDepartamento(servicio.departamentoPlanta);
  return {
    ...servicio,
    punto: null,
    departamento: porPlanta || SIN_DEPARTAMENTO,
    origenUbicacion: porPlanta ? 'planta' : null,
  };
}

export const ubicarServicios = (servicios = []) => servicios.map(ubicarServicio);

/**
 * Puntos del mapa juntos cuando caen cerca (`radio` en unidades del mapa):
 * cada grupo con su centro, sus servicios y el grupo de servicio que más se repite.
 */
export function agruparPuntos(servicios = [], radio = 12) {
  // Cada punto se suma al primer grupo cuyo centro está a menos de `radio`;
  // si no hay ninguno, abre uno nuevo. El centro se mueve con cada punto.
  const grupos = [];
  for (const servicio of servicios) {
    if (!servicio.punto) continue;
    const [x, y] = servicio.punto;
    const cercano = grupos.find(g => Math.hypot(g.x - x, g.y - y) <= radio);
    if (cercano) {
      cercano.servicios.push(servicio);
      const n = cercano.servicios.length;
      cercano.x += (x - cercano.x) / n;
      cercano.y += (y - cercano.y) / n;
    } else {
      grupos.push({ x, y, servicios: [servicio] });
    }
  }
  return grupos.map((grupo) => {
    const cuenta = new Map();
    for (const s of grupo.servicios) cuenta.set(s.grupo, (cuenta.get(s.grupo) || 0) + 1);
    const dominante = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // Cada servicio está en un solo grupo: el primero lo identifica.
    return { clave: String(grupo.servicios[0].codigo), x: grupo.x, y: grupo.y, servicios: grupo.servicios, grupo: dominante };
  }).sort((a, b) => b.servicios.length - a.servicios.length);
}
