import { useEffect, useState } from 'react';
import { PERMISOS_CHANGED_EVENT, systemApi } from '../api/system';

const SIN_PERMISOS = Object.freeze({ permisos: [], gestionar: false, enPruebas: [] });

/**
 * Los permisos con nombre del usuario de la sesión (Sistema › Gestión de
 * permisos): { permisos: ['tiempos.soporte.ver', …], gestionar, enPruebas },
 * con los apartados en pruebas (['comercial'], solo para Sistemas). null
 * mientras llegan. Se vuelven a pedir al volver a la pestaña y cuando Gestión
 * de permisos guarda un cambio. Si la consulta falla, vale «sin permisos»: el
 * menú solo oculta y el backend decide igual en cada petición.
 *
 * `sesion` identifica la sesión (el usuario); null sin sesión.
 */
export function useMisPermisos(sesion) {
  const [estado, setEstado] = useState({ sesion: null, datos: null });

  useEffect(() => {
    if (!sesion) return undefined;
    let vigente = true;
    const guardar = datos => {
      if (vigente) setEstado({ sesion, datos });
    };
    const cargar = () => systemApi.misPermisos()
      .then(data => guardar({
        permisos: Array.isArray(data?.permisos) ? data.permisos : [],
        gestionar: data?.gestionar === true,
        enPruebas: Array.isArray(data?.enPruebas) ? data.enPruebas : [],
      }))
      .catch(() => {
        if (vigente) setEstado(actual => (actual.sesion === sesion && actual.datos ? actual : { sesion, datos: SIN_PERMISOS }));
      });
    const alVolver = () => {
      if (document.visibilityState === 'visible') cargar();
    };
    cargar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener(PERMISOS_CHANGED_EVENT, cargar);
    return () => {
      vigente = false;
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener(PERMISOS_CHANGED_EVENT, cargar);
    };
  }, [sesion]);

  return sesion && estado.sesion === sesion ? estado.datos : null;
}
