import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { safeStorage } from '../utils/storage';
import { conTransicion } from '../utils/viewTransition';

/**
 * Direcciones de la aplicación: /<apartado>/<pestaña>/<detalle…>, por ejemplo
 * /soporte/informes/MPR/ST-001. El navegador recuerda cada paso (botón Atrás)
 * y cualquier dirección se puede compartir o abrir desde un correo.
 */
export const RUTAS_APARTADO = {
  rim: 'rim',
  calendar: 'cronograma',
  departures: 'salidas',
  calibration: 'calibracion',
  soporte: 'soporte',
  ivmet: 'ivmet',
  changes: 'sistema/cambios',
  failures: 'sistema/fallas',
  permisos: 'sistema/permisos',
};

const EVENTO_RUTA = 'datamet:ruta';

// Las bases más largas primero, para que «sistema/cambios» gane a «sistema».
const BASES = Object.entries(RUTAS_APARTADO)
  .map(([vista, base]) => [vista, base.split('/')])
  .sort((a, b) => b[1].length - a[1].length);

const decodificar = (parte) => {
  try {
    return decodeURIComponent(parte);
  } catch {
    return parte;
  }
};

const rutaDelNavegador = () => (typeof window === 'undefined' ? '/' : window.location.pathname);

/** Apartado y resto de la dirección: /soporte/proximos → { vista: 'soporte', resto: ['proximos'] }. */
export function leerRuta(ruta = rutaDelNavegador()) {
  const partes = String(ruta || '/').split('/').filter(Boolean).map(decodificar);
  for (const [vista, base] of BASES) {
    if (base.every((parte, indice) => partes[indice] === parte)) {
      return { vista, resto: partes.slice(base.length) };
    }
  }
  return { vista: null, resto: partes };
}

/** Dirección de un apartado con sus partes: rutaDe('soporte', 'informes') → /soporte/informes. */
export function rutaDe(vista, ...partes) {
  const base = RUTAS_APARTADO[vista] || RUTAS_APARTADO.rim;
  const resto = partes
    .filter(parte => parte !== undefined && parte !== null && parte !== '')
    .map(parte => encodeURIComponent(String(parte)));
  return `/${[base, ...resto].join('/')}`;
}

/**
 * Cambia la dirección. `reemplazar` corrige la actual sin sumar un paso al
 * historial; `transicion` anima el cambio ('pagina' o 'panel'); `alCambiar`
 * corre junto con el cambio (por ejemplo, volver arriba).
 */
export function navegar(ruta, { reemplazar = false, transicion = null, alCambiar = null } = {}) {
  if (typeof window === 'undefined') return;
  const cambiar = () => {
    if (ruta !== window.location.pathname) {
      window.history[reemplazar ? 'replaceState' : 'pushState'](window.history.state, '', ruta);
      window.dispatchEvent(new Event(EVENTO_RUTA));
    }
    alCambiar?.();
  };
  if (transicion && ruta !== window.location.pathname) conTransicion(cambiar, transicion);
  else cambiar();
}

// Un solo par de oyentes para toda la aplicación: así Atrás anima una vez y
// todos los componentes que leen la dirección se actualizan en el mismo paso.
const suscriptores = new Set();
let rutaAnterior = rutaDelNavegador();
let escuchando = false;

const avisarATodos = () => {
  for (const avisar of suscriptores) avisar();
};

function escucharNavegador() {
  if (escuchando || typeof window === 'undefined') return;
  escuchando = true;
  window.addEventListener(EVENTO_RUTA, () => {
    rutaAnterior = rutaDelNavegador();
    avisarATodos();
  });
  // Atrás y Adelante: se anima como página si cambia el apartado y como
  // panel si solo cambia la pestaña.
  window.addEventListener('popstate', () => {
    const mismaVista = leerRuta(rutaAnterior).vista === leerRuta().vista;
    rutaAnterior = rutaDelNavegador();
    conTransicion(avisarATodos, mismaVista ? 'panel' : 'pagina');
  });
}

function suscribir(avisar) {
  escucharNavegador();
  suscriptores.add(avisar);
  return () => suscriptores.delete(avisar);
}

/** Dirección que muestra el navegador en este momento. */
export const rutaActual = () => rutaDelNavegador();

/** Dirección actual; vuelve a renderizar cuando cambia. */
export function useRuta() {
  return useSyncExternalStore(suscribir, rutaDelNavegador, () => '/');
}

const leerGuardada = (clave, pestanas, predeterminada) => {
  const valor = clave ? safeStorage.getItem(clave) : null;
  return pestanas.includes(valor) ? valor : predeterminada;
};

/**
 * Pestaña de un apartado según la dirección (/<apartado>/<pestaña>/…). Si la
 * dirección no la trae (se entró desde la barra lateral), vale la última que
 * se usó y la dirección se completa sin sumar un paso al historial.
 * `detalleGuardado(pestana)` puede devolver más partes para reabrir lo que
 * quedó abierto (un informe, por ejemplo).
 */
export function usePestanaRuta(vista, pestanas, { clave, predeterminada, detalleGuardado } = {}) {
  const ruta = useRuta();
  const { vista: actual, resto } = leerRuta(ruta);
  const enEsteApartado = actual === vista;
  const enRuta = enEsteApartado && pestanas.includes(resto[0]) ? resto[0] : null;
  const pestana = enRuta || leerGuardada(clave, pestanas, predeterminada ?? pestanas[0]);
  const detalle = enRuta ? resto.slice(1) : [];
  const detalleGuardadoRef = useRef(detalleGuardado);
  useEffect(() => {
    detalleGuardadoRef.current = detalleGuardado;
  });

  useEffect(() => {
    if (!enEsteApartado || enRuta) return;
    // Si la dirección ya cambió (por ejemplo, con Atrás), no se toca la nueva.
    if (rutaDelNavegador() !== ruta) return;
    navegar(rutaDe(vista, pestana, ...(detalleGuardadoRef.current?.(pestana) || [])), { reemplazar: true });
  }, [enEsteApartado, enRuta, pestana, ruta, vista]);

  useEffect(() => {
    if (enRuta && clave) safeStorage.setItem(clave, enRuta);
  }, [clave, enRuta]);

  const cambiarPestana = useCallback((nueva) => {
    navegar(rutaDe(vista, nueva), { transicion: 'panel' });
  }, [vista]);

  /** Abre o cierra un detalle dentro de la pestaña actual (`partes` vacío lo cierra). */
  const irADetalle = useCallback((partes, opciones = {}) => {
    navegar(rutaDe(vista, pestana, ...partes), { transicion: 'panel', ...opciones });
  }, [pestana, vista]);

  return { pestana, detalle, enRuta: Boolean(enRuta), cambiarPestana, irADetalle };
}
