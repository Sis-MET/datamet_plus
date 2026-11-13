import { useCallback, useMemo, useState } from 'react';
import { aTexto } from '../../domain/registro';

const tiene = (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto || {}, clave);
/** Texto comparable: sin espacios a los lados y con punto decimal. */
const comparable = (texto) => String(texto ?? '').trim().replace(',', '.');

/**
 * Correcciones del registro mientras se editan en la página, como en el
 * editor de Soporte: lo guardado (ServiceMET + correcciones) más lo que se
 * escribió y aún no se guarda. Cada campo sabe si difiere de ServiceMET y si
 * tiene un cambio pendiente.
 */
export function useRegistroEditor(data) {
  const [pendientes, setPendientes] = useState({});
  // undefined: sin cambio; null: quitar la clase; { valor, origen }: nueva.
  const [clase, setClase] = useState(undefined);
  // Tolerancias del cliente por rango como texto mientras se escriben; undefined: sin cambio.
  const [tolerancias, setTolerancias] = useState(undefined);

  const fuente = useMemo(() => data?.fuente || {}, [data]);
  const guardadas = useMemo(() => data?.datos?.columnas || {}, [data]);

  /** Valor guardado de una columna (corrección o ServiceMET), como texto. */
  const guardado = useCallback((columna) => aTexto(tiene(guardadas, columna) ? guardadas[columna] : fuente[columna]), [fuente, guardadas]);

  const valor = useCallback((columna) => (tiene(pendientes, columna) ? pendientes[columna] : guardado(columna)), [guardado, pendientes]);

  const estado = useCallback((columna) => {
    const actual = valor(columna);
    const original = aTexto(fuente[columna]);
    return {
      valor: actual,
      original,
      distinto: comparable(actual) !== comparable(original),
      pendiente: tiene(pendientes, columna),
    };
  }, [fuente, pendientes, valor]);

  const cambiar = useCallback((columna, texto) => {
    setPendientes((actuales) => {
      const siguiente = { ...actuales };
      if (comparable(texto) === comparable(guardado(columna))) delete siguiente[columna];
      else siguiente[columna] = texto;
      return siguiente;
    });
  }, [guardado]);

  const restaurar = useCallback((columna) => cambiar(columna, aTexto(fuente[columna])), [cambiar, fuente]);

  const claseGuardada = data?.datos?.clase || null;
  const claseActual = clase === undefined ? claseGuardada : clase;
  const cambiarClase = useCallback((nueva) => {
    const igual = (a, b) => (a?.valor || null) === (b?.valor || null) && (a?.origen || null) === (b?.origen || null);
    setClase(igual(nueva, claseGuardada) ? undefined : nueva);
  }, [claseGuardada]);

  // en: 'MASA' (la unidad de la balanza) o 'D' (divisiones: 1 d en todo el rango).
  const toleranciasGuardadas = useMemo(() => (data?.datos?.tolerancias || []).map(t => ({
    hasta: t.hasta == null ? '' : String(t.hasta).replace('.', ','), tolerancia: String(t.tolerancia).replace('.', ','), en: t.en === 'D' ? 'D' : 'MASA',
  })), [data]);
  const toleranciasActuales = tolerancias === undefined ? toleranciasGuardadas : tolerancias;
  const cambiarTolerancias = useCallback((filas) => {
    const normal = lista => JSON.stringify(lista.map(f => [comparable(f.hasta), comparable(f.tolerancia), f.en === 'D' ? 'D' : 'MASA']));
    setTolerancias(normal(filas) === normal(toleranciasGuardadas) ? undefined : filas);
  }, [toleranciasGuardadas]);

  const cantidad = Object.keys(pendientes).length + (clase === undefined ? 0 : 1) + (tolerancias === undefined ? 0 : 1);

  /** Lo que se manda al guardar (y a la vista previa en vivo). */
  const cambios = useMemo(() => {
    const columnas = Object.fromEntries(Object.entries(pendientes).map(([columna, texto]) => [columna, String(texto ?? '').trim() === '' ? null : String(texto).trim()]));
    // Solo las filas que se leen: «hasta» vacío = en adelante; las incompletas no se mandan.
    const numero = texto => (comparable(texto) === '' ? null : Number(comparable(texto)));
    const filas = tolerancias === undefined ? undefined : tolerancias
      .map(f => ({ hasta: numero(f.hasta), tolerancia: numero(f.tolerancia), ...(f.en === 'D' ? { en: 'D' } : {}) }))
      .filter(f => f.tolerancia > 0 && (f.hasta == null || f.hasta > 0));
    return {
      columnas,
      ...(clase === undefined ? {} : { clase: clase && clase.valor ? clase : null }),
      ...(filas === undefined ? {} : { tolerancias: filas }),
    };
  }, [clase, pendientes, tolerancias]);

  const descartar = useCallback(() => {
    setPendientes({});
    setClase(undefined);
    setTolerancias(undefined);
  }, []);

  return {
    valor, estado, cambiar, restaurar, cantidad, cambios, descartar,
    clase: claseActual, claseGuardada, cambiarClase, clasePendiente: clase !== undefined,
    tolerancias: toleranciasActuales, cambiarTolerancias, toleranciasPendientes: tolerancias !== undefined,
  };
}
