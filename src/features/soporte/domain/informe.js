/**
 * Reglas del informe en el navegador: qué valor muestra cada campo, qué está
 * corregido respecto del dato de ServiceMET, cambios pendientes, estados y el
 * nombre del PDF.
 */
import { aNumero } from './calculos';

export const ESTADOS_INFORME = {
  PENDIENTE: { label: 'Pendiente', tone: 'neutral', descripcion: 'Con los datos de ServiceMET, sin revisar' },
  BORRADOR: { label: 'Borrador', tone: 'warning', descripcion: 'Revisado o corregido, sin emitir' },
  EMITIDO: { label: 'Emitido', tone: 'success', descripcion: 'Emitido; los cambios piden motivo' },
};

export const ACCIONES_HISTORIAL = {
  EDICION: 'Edición',
  CORRECCION: 'Corrección',
  EMISION: 'Emisión',
  FOTO_AGREGADA: 'Foto agregada',
  FOTO_EDITADA: 'Foto editada',
  FOTO_QUITADA: 'Foto quitada',
  FOTOS_ORDEN: 'Fotos reordenadas',
};

export const MAX_FOTOS = 12;
export const FOTOS_POR_HOJA = 6;

const tiene = (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto || {}, clave);

/** Valores del informe: original de ServiceMET ← corregidos ← sin guardar. */
export function valoresInforme(informe, pendientes = {}) {
  if (!informe) return {};
  return { ...informe.fuente, ...informe.datos, ...pendientes };
}

/** Valor guardado (corregido o, si no, el original). */
export function valorGuardado(informe, campo) {
  return tiene(informe?.datos, campo) ? informe.datos[campo] : (informe?.fuente?.[campo] ?? null);
}

export const estaCorregido = (informe, campo) => tiene(informe?.datos, campo);

const NUMERICOS = new Set(['numero', 'entero']);

/** Dos valores son el mismo dato (números con coma o punto, vacío = null). */
export function mismoValor(a, b, tipo) {
  const vacio = (valor) => valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '');
  if (vacio(a) || vacio(b)) return vacio(a) && vacio(b);
  if (NUMERICOS.has(tipo) || typeof a === 'number' || typeof b === 'number') {
    const x = aNumero(a);
    const y = aNumero(b);
    if (x !== null && y !== null) return x === y;
  }
  return String(a).trim() === String(b).trim();
}

/**
 * Cambios por guardar: solo los que difieren del valor guardado. Los
 * números se envían como número; el texto, recortado.
 */
export function cambiosParaGuardar(informe, pendientes, tipos = {}) {
  const salida = {};
  for (const [campo, valor] of Object.entries(pendientes)) {
    const tipo = tipos[campo];
    if (mismoValor(valor, valorGuardado(informe, campo), tipo)) continue;
    if (valor === null || (typeof valor === 'string' && valor.trim() === '')) {
      salida[campo] = null;
    } else if (NUMERICOS.has(tipo)) {
      salida[campo] = aNumero(valor) ?? String(valor).trim();
    } else {
      salida[campo] = typeof valor === 'string' ? valor.trim() : valor;
    }
  }
  return salida;
}

/** Agrupaciones de la lista; por omisión, por OTST (como se elegía en el Excel). */
export const AGRUPACIONES = ['otst', 'tecnico', 'ninguno'];

/** Filtros de la lista sin aplicar. */
export const filtrosVacios = () => ({ q: '', tipo: '', estado: '', cliente: '', tecnico: '', desde: '', hasta: '' });

/** Texto corto del dato original para mostrarlo bajo un campo corregido. */
export function textoOriginal(valor, tipo) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return 'vacío';
  if (tipo === 'fecha') return formatoFecha(valor);
  return String(valor);
}

/** «2026-08-04» → «04/08/2026». */
export function formatoFecha(valor) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (valor ? String(valor) : '');
}

/** Fecha y hora local corta para la interfaz. */
export function fechaHora(valor) {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const PROHIBIDOS = /[\\/:*?"<>|\r\n]/g;

const parteArchivo = (valor) => {
  const texto = String(valor ?? '').replace(PROHIBIDOS, '_').replace(/\s+/g, ' ').trim().slice(0, 50).trim();
  return !texto || texto === '-' ? 'SinDato' : texto;
};

/**
 * Nombre del PDF como en las macros:
 * IMPR-<informe>-<cliente>-<instrumento>-<capacidad>-<unidad>-<código interno>.
 */
export function nombreArchivo(plantilla, numero, valores) {
  return [
    plantilla.prefijo,
    parteArchivo(numero),
    parteArchivo(valores.cliente),
    parteArchivo(valores.tipo_equipo),
    parteArchivo(valores.cap_max1),
    parteArchivo(valores.unidades),
    parteArchivo(valores.cod_int),
  ].join('-');
}

/** Fotos en hojas de 6, como la hoja FOTOGRAFIAS. */
export function hojasDeFotos(fotos) {
  const hojas = [];
  for (let i = 0; i < fotos.length; i += FOTOS_POR_HOJA) hojas.push(fotos.slice(i, i + FOTOS_POR_HOJA));
  return hojas;
}
