/**
 * Próximos servicios de Soporte técnico: nombres, formas y textos de la
 * vista. Las reglas (qué fecha vale y su situación) las calcula el backend
 * en soporte.proximos.reglas.js.
 */
import { formatDate, matchesQuery } from '../../calibration/domain/format';

/** Situación del próximo servicio, con los tonos de calibración (.cal-tone-*). */
export const SITUACIONES = {
  VENCIDO: { label: 'Vencido', plural: 'Vencidos', tone: 'danger' },
  PROXIMO: { label: 'En aviso', plural: 'En aviso', tone: 'warning' },
  COORDINADO: { label: 'Coordinado', plural: 'Coordinados', tone: 'info' },
  PROGRAMADO: { label: 'Programado', plural: 'Programados', tone: 'neutral' },
  REALIZADO: { label: 'Realizado', plural: 'Realizados', tone: 'success' },
  DESCARTADO: { label: 'Descartado', plural: 'Descartados', tone: 'muted' },
};

/** Filtros de situación de la barra, en orden de urgencia. */
export const FILTROS_SITUACION = ['VENCIDO', 'PROXIMO', 'COORDINADO', 'PROGRAMADO', 'REALIZADO', 'DESCARTADO'];

/** Tipos de servicio realizados. */
export const TIPOS = {
  MPR: { label: 'Preventivo regular', forma: 'circle' },
  MPA: { label: 'Preventivo avanzado', forma: 'circle' },
  MCR: { label: 'Correctivo', forma: 'diamond' },
  DIG: { label: 'Diagnóstico', forma: 'diamond' },
  INT: { label: 'Instalación', forma: 'square' },
  IBM: { label: 'Verificación IBMETRO', forma: 'square' },
  VFI: { label: 'Verificación interna', forma: 'square' },
  RVD: { label: 'Relevamiento', forma: 'square' },
};

/** Tipo de servicio sugerido por el técnico (clave del backend). */
export const SUGERIDOS = {
  MPR: { label: 'Preventivo regular', forma: 'circle' },
  MPA: { label: 'Preventivo avanzado', forma: 'circle' },
  MCR: { label: 'Correctivo', forma: 'diamond' },
  DIG: { label: 'Diagnóstico', forma: 'diamond' },
  AJM: { label: 'Ajuste metrológico', forma: 'square' },
  CAL: { label: 'Calibración', forma: 'square' },
  OTRO: { label: 'Otro', forma: null },
};

/** Filtro por tipo sugerido: las claves más «sin tipo». */
export const FILTROS_SUGERIDO = [...Object.keys(SUGERIDOS), 'NINGUNO'];

/** Formas de la leyenda: agrupan los tipos de servicio. */
export const CATEGORIAS = [
  { forma: 'circle', label: 'Preventivo' },
  { forma: 'diamond', label: 'Correctivo o diagnóstico' },
  { forma: 'square', label: 'Verificación, ajuste o instalación' },
];

export const tipoLabel = (tipo) => TIPOS[tipo]?.label || tipo;

/** Nombre del tipo sugerido; el texto libre antiguo se muestra tal cual. */
export function sugeridoLabel(proximo) {
  if (!proximo?.tipoSugerido) return 'Sin tipo sugerido';
  if (proximo.tipoSugerido === 'OTRO') return proximo.recomendacion || SUGERIDOS.OTRO.label;
  return SUGERIDOS[proximo.tipoSugerido]?.label || proximo.tipoSugerido;
}

/**
 * Forma del glifo: el tipo sugerido para un próximo servicio; el tipo del
 * servicio para lo realizado (y cuando no hay tipo sugerido).
 */
export function formaDe(evento) {
  if (evento.clase === 'PROXIMO' || evento.fechaSugerida !== undefined) {
    const forma = SUGERIDOS[evento.tipoSugerido]?.forma;
    if (forma) return forma;
    return TIPOS[evento.origen?.tipo || evento.tipo]?.forma || 'circle';
  }
  return TIPOS[evento.tipo]?.forma || 'circle';
}

export const toneDe = (situacion) => SITUACIONES[situacion]?.tone || 'neutral';

// Seguimiento de los próximos servicios (registrar contacto, coordinar,
// reprogramar, descartar): el backend y ST_PROXIMOS_SEGUIMIENTO siguen
// intactos, pero los botones se ocultan hasta que el área defina su
// procedimiento. Por ahora el apartado solo muestra las fechas y avisa.
// Poner esto en true los vuelve a mostrar tal cual estaban.
export const SEGUIMIENTO_UI = false;

/** Color del texto «cuándo» según la situación. */
export const tonoTexto = (situacion) => {
  if (situacion === 'VENCIDO') return 'text-danger';
  if (situacion === 'PROXIMO') return 'text-warning';
  if (situacion === 'COORDINADO') return 'text-info';
  return 'text-fg-muted';
};

/** Distancia legible a la fecha del próximo servicio. */
export function cuando(proximo) {
  if (!proximo) return '';
  if (proximo.situacion === 'DESCARTADO') return 'Descartado';
  if (proximo.situacion === 'REALIZADO') return `Realizado el ${formatDate(proximo.fecha, 'd MMM yyyy')}`;
  const dias = proximo.diasRestantes;
  if (dias === null || dias === undefined) return '';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias > 1) return `En ${dias} días`;
  const atraso = Math.abs(dias);
  return atraso === 1 ? 'Venció ayer' : `Vencido hace ${atraso} días`;
}

/** Gestiones del seguimiento, como se nombran en la ficha. */
export const ACCIONES = {
  CONTACTO: {
    label: 'Contacto con el cliente',
    boton: 'Registrar contacto',
    nota: '¿Qué se habló con el cliente?',
    ejemplo: 'Llamé al encargado de planta; confirmará la fecha la próxima semana.',
  },
  COORDINACION: {
    label: 'Visita coordinada',
    boton: 'Coordinar visita',
    fecha: 'Fecha acordada',
    nota: 'Con quién y cómo se coordinó',
    ejemplo: 'Coordinado por correo con el jefe de mantenimiento.',
  },
  REPROGRAMACION: {
    label: 'Fecha reprogramada',
    boton: 'Reprogramar',
    fecha: 'Nueva fecha',
    nota: 'Motivo de la reprogramación',
    ejemplo: 'El cliente pidió pasar el preventivo a enero por cierre de gestión.',
  },
  DESCARTE: {
    label: 'Descartado',
    boton: 'Descartar',
    nota: 'Motivo del descarte',
    ejemplo: 'El equipo fue dado de baja por el cliente.',
  },
  REACTIVACION: {
    label: 'Reactivado',
    boton: 'Reactivar',
    nota: 'Motivo de la reactivación',
    ejemplo: 'El cliente volvió a solicitar el servicio.',
  },
};

/** Estado de la sugerencia de cada servicio, en el historial del equipo. */
export const ESTADO_SUGERENCIA = {
  VIGENTE: { label: 'Vigente', tone: 'info' },
  ATENDIDA: { label: 'Atendida', tone: 'success' },
  REEMPLAZADA: { label: 'Reemplazada', tone: 'muted' },
};

export const medidaPesaje = (valor, unidad) => valor === null || valor === undefined ? 'Sin dato'
  : `${Number(valor).toLocaleString('es-BO', { maximumFractionDigits: 9 })}${unidad ? ` ${unidad}` : ''}`;

export const resumenPesaje = equipo => (equipo?.rangos || []).map(r => (
  `R${r.numero}: Máx. ${medidaPesaje(r.capacidad, equipo.unidades)}; d ${medidaPesaje(r.division, equipo.unidades)}`
  + (r.verificacion !== null && r.verificacion !== undefined ? `; e ${medidaPesaje(r.verificacion, equipo.unidades)}` : '')
)).join(' / ');

export const subtituloEquipo = (equipo) => [equipo?.instrumento, equipo?.marca, equipo?.modelo,
  equipo?.capacidadMaxima != null ? `Máx. ${medidaPesaje(equipo.capacidadMaxima, equipo.unidades)}` : null].filter(Boolean).join(' · ');

export const coincideEquipo = (query, equipo) => matchesQuery(
  query,
  equipo.codMetrica,
  equipo.cliente,
  equipo.planta,
  equipo.ciudad,
  equipo.instrumento,
  equipo.marca,
  equipo.modelo,
  equipo.serie,
);

/** Clave del filtro de tipo sugerido de un próximo servicio. */
export const claveFiltroSugerido = (proximo) => proximo?.tipoSugerido || 'NINGUNO';

/**
 * Próximo servicio completo de un equipo de la lista (la lista lo trae sin
 * repetir los datos del equipo).
 */
export const proximoDeEquipo = (equipo) => (equipo?.proximo ? {
  ...equipo.proximo,
  equipoId: equipo.id,
  codMetrica: equipo.codMetrica,
  cliente: equipo.cliente,
  planta: equipo.planta,
  ciudad: equipo.ciudad,
  instrumento: equipo.instrumento,
  marca: equipo.marca,
  modelo: equipo.modelo,
  serie: equipo.serie,
  origen: equipo.proximo.origen || equipo.origen,
} : null);

/**
 * Marca de la línea de tiempo con los datos de su equipo, para las listas,
 * la tarjeta flotante y la ficha.
 */
export function enriquecerEvento(evento, equipo) {
  if (!equipo) return evento;
  return {
    ...evento,
    codMetrica: equipo.codMetrica,
    cliente: equipo.cliente,
    planta: equipo.planta,
    ciudad: equipo.ciudad,
    instrumento: equipo.instrumento,
    marca: equipo.marca,
    modelo: equipo.modelo,
    serie: equipo.serie,
    ubicacion: equipo.ubicacion,
    unidades: equipo.unidades,
    capacidadMaxima: equipo.capacidadMaxima,
    tipoRango: equipo.tipoRango,
    rangos: equipo.rangos || [],
    ...(evento.clase === 'PROXIMO' ? {
      origen: equipo.origen,
      ultimoContacto: equipo.proximo?.ultimoContacto || null,
      recomendacion: equipo.proximo?.recomendacion || null,
      descartada: equipo.proximo?.descartada || false,
    } : {}),
  };
}

// ─── Grupos por cliente ────────────────────────────────────────────────────

const ORDEN_SITUACION = ['VENCIDO', 'PROXIMO', 'COORDINADO', 'PROGRAMADO', 'REALIZADO', 'DESCARTADO'];
const urgencia = (situacion) => {
  const index = ORDEN_SITUACION.indexOf(situacion);
  return index === -1 ? ORDEN_SITUACION.length : index;
};

const unico = (valores) => {
  const distintos = [...new Set(valores.filter(Boolean))];
  return distintos.length === 1 ? distintos[0] : null;
};

/**
 * OTST de referencia: la del servicio realizado o la del servicio anterior
 * que sugirió la fecha. Solo identifica ese servicio; la visita siguiente
 * tendrá su propia OTST.
 */
export const otstDe = (item) => (item.clase === 'SERVICIO' ? item.otst : item.origen?.otst) || null;

/**
 * Agrupa por cliente y planta: los equipos de un mismo lugar se atienden en
 * la misma visita. Los servicios realizados y los próximos van en grupos
 * aparte. Se conserva el orden de llegada: un grupo ocupa el lugar de su
 * primer equipo (en «Requieren atención», el más urgente).
 */
export function agruparPorCliente(items) {
  const grupos = new Map();
  for (const item of items) {
    const clase = item.clase === 'SERVICIO' ? 'SERVICIO' : 'PROXIMO';
    const id = `${clase}|${item.cliente}|${item.planta || ''}`;
    if (!grupos.has(id)) grupos.set(id, { id, clase, cliente: item.cliente, planta: item.planta || null, items: [] });
    grupos.get(id).items.push(item);
  }
  return [...grupos.values()].map((grupo) => {
    const ordenados = [...grupo.items].sort((a, b) => (
      a.fecha.localeCompare(b.fecha) || String(a.codMetrica).localeCompare(String(b.codMetrica), 'es', { numeric: true })
    ));
    // El más urgente define la situación y el «cuándo» del grupo.
    const principal = [...ordenados].sort((a, b) => urgencia(a.situacion) - urgencia(b.situacion) || a.fecha.localeCompare(b.fecha))[0];
    return {
      ...grupo,
      items: ordenados,
      principal,
      situacion: principal.situacion,
      fecha: ordenados[0].fecha,
      fechaFin: ordenados[ordenados.length - 1].fecha,
      ciudad: unico(ordenados.map(item => item.ciudad)),
    };
  });
}

/** Planta del grupo si dice algo más que el nombre del cliente. */
export const plantaVisible = (grupo) => (
  grupo.planta && grupo.planta.trim().toUpperCase() !== String(grupo.cliente).trim().toUpperCase() ? grupo.planta : null
);

/** Rango corto de un grupo («18–19 may», «30 sep – 2 oct»); null si es un solo día. */
export function rangoCorto({ fecha, fechaFin }) {
  if (!fecha || !fechaFin || fecha === fechaFin) return null;
  if (fecha.slice(0, 7) === fechaFin.slice(0, 7)) return `${Number(fecha.slice(8))}–${formatDate(fechaFin, 'd MMM')}`;
  return `${formatDate(fecha, 'd MMM')} – ${formatDate(fechaFin, 'd MMM')}`;
}

/** Qué se sugiere (o qué se hizo) en un grupo: el tipo común o «varios». */
export function detalleGrupo(grupo) {
  if (grupo.clase === 'SERVICIO') {
    return [unico(grupo.items.map(item => tipoLabel(item.tipo))) || 'Varios servicios', unico(grupo.items.map(item => item.tecnico))]
      .filter(Boolean).join(' · ');
  }
  return unico(grupo.items.map(item => sugeridoLabel(item))) || 'Varios tipos sugeridos';
}

/** Texto de una gestión para la bitácora: «Reprogramado al 12 nov 2026». */
export function gestionTitulo(gestion) {
  const accion = ACCIONES[gestion.accion]?.label || gestion.accion;
  if (gestion.accion === 'COORDINACION') return `Visita coordinada para el ${formatDate(gestion.fechaNueva, "d 'de' MMMM yyyy")}`;
  if (gestion.accion === 'REPROGRAMACION') return `Reprogramado al ${formatDate(gestion.fechaNueva, "d 'de' MMMM yyyy")}`;
  return accion;
}
