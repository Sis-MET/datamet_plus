/**
 * Tiempos de servicio del personal (KPI de Soporte técnico y de Calibración).
 *
 * Cada servicio llega del servidor con su hora de inicio y su hora final
 * («HH:MM», tal como las registró el técnico en ServiceMET). Aquí se mide la
 * duración, se separan los servicios cuyas horas no permiten medirla y se
 * arman los indicadores por técnico, por grupo (tipo de servicio o rango de
 * capacidad) y por mes. Todo es puro: la misma entrada da el mismo resultado.
 */

/** Más de 12 h entre el inicio y el fin no es un servicio: es un registro que quedó abierto. */
export const MAX_MINUTOS = 12 * 60;

/** Con menos servicios medidos, la comparación con el área no dice nada. */
export const MIN_SERVICIOS_INDICE = 5;

/** Por qué un servicio no se puede medir. */
export const PROBLEMAS = {
  SIN_HORAS: 'Falta la hora de inicio o la final',
  FIN_ANTES: 'La hora final no es posterior a la de inicio',
  MAS_DE_12H: 'Pasan más de 12 horas entre el inicio y el fin',
};

export const SIN_TECNICO = 'Sin identificar';

const pad = n => String(n).padStart(2, '0');

const aMinutos = (hora) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hora ?? ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** Duración en minutos, o el problema que impide medirla. */
export function medir({ inicio, fin } = {}) {
  const desde = aMinutos(inicio);
  const hasta = aMinutos(fin);
  if (desde === null || hasta === null) return { minutos: null, problema: 'SIN_HORAS' };
  const minutos = hasta - desde;
  if (minutos <= 0) return { minutos: null, problema: 'FIN_ANTES' };
  if (minutos > MAX_MINUTOS) return { minutos: null, problema: 'MAS_DE_12H' };
  return { minutos, problema: null };
}

// ─── Estadística ───────────────────────────────────────────────────────────

const ordenados = valores => [...valores].sort((a, b) => a - b);

export const suma = valores => valores.reduce((total, valor) => total + valor, 0);

export const promedio = valores => (valores.length ? suma(valores) / valores.length : null);

/** Percentil con interpolación lineal (como PERCENTIL.INC de Excel); p entre 0 y 1. */
export function percentil(valores, p) {
  if (!valores.length) return null;
  const lista = ordenados(valores);
  const posicion = (lista.length - 1) * p;
  const abajo = Math.floor(posicion);
  const arriba = Math.ceil(posicion);
  return lista[abajo] + (lista[arriba] - lista[abajo]) * (posicion - abajo);
}

export const mediana = valores => percentil(valores, 0.5);

// ─── Indicadores ───────────────────────────────────────────────────────────

const tecnicoDe = servicio => servicio.tecnico || SIN_TECNICO;

/** Una visita: la misma orden (OTST o SECA), el mismo día y el mismo técnico. */
const visitaDe = servicio => `${servicio.orden || servicio.codigo}|${servicio.fecha}|${tecnicoDe(servicio)}`;

const minutosDe = servicios => servicios.filter(s => s.minutos !== null).map(s => s.minutos);

/** Servicios con su duración medida (o su problema). */
export const medirServicios = (servicios = []) => servicios.map(servicio => ({ ...servicio, ...medir(servicio) }));

/** Mediana del área por grupo: la referencia para comparar a cada técnico. */
export function referencias(medidos) {
  const porGrupo = new Map();
  for (const servicio of medidos) {
    if (servicio.minutos === null) continue;
    porGrupo.set(servicio.grupo, [...(porGrupo.get(servicio.grupo) || []), servicio.minutos]);
  }
  return new Map([...porGrupo].map(([grupo, valores]) => [grupo, mediana(valores)]));
}

/**
 * Cuánto tarda alguien frente al área haciendo los mismos tipos de servicio:
 * sus minutos sobre los que habría usado con la mediana del área en cada uno.
 * 1 = como el área; 1,2 = 20 % más. null con pocos servicios medidos.
 */
export function indiceFrenteAlArea(medidos, referencia) {
  const validos = medidos.filter(s => s.minutos !== null && referencia.get(s.grupo) > 0);
  if (validos.length < MIN_SERVICIOS_INDICE) return null;
  return suma(validos.map(s => s.minutos)) / suma(validos.map(s => referencia.get(s.grupo)));
}

/**
 * Una jornada: un día en que el técnico registró algún servicio medido. Las
 * horas por jornada son la media de horas de servicio de esos días (no
 * incluyen viajes ni esperas entre equipos).
 */
const jornadaDe = servicio => `${tecnicoDe(servicio)}|${servicio.fecha}`;

/** Resumen de un conjunto de servicios medidos. */
export function resumir(medidos) {
  const minutos = minutosDe(medidos);
  const visitas = new Set(medidos.map(visitaDe)).size;
  const jornadas = new Set(medidos.filter(s => s.minutos !== null).map(jornadaDe)).size;
  return {
    jornadas,
    porJornada: jornadas ? suma(minutos) / jornadas : null,
    // Días con algún servicio, medido o no (lo que se muestra junto al nombre).
    dias: new Set(medidos.map(jornadaDe)).size,
    servicios: medidos.length,
    medidos: minutos.length,
    porRevisar: medidos.length - minutos.length,
    cobertura: medidos.length ? minutos.length / medidos.length : null,
    minutos: suma(minutos),
    promedio: promedio(minutos),
    mediana: mediana(minutos),
    p90: percentil(minutos, 0.9),
    minimo: minutos.length ? Math.min(...minutos) : null,
    maximo: minutos.length ? Math.max(...minutos) : null,
    visitas,
    equiposPorVisita: visitas ? medidos.length / visitas : null,
    tecnicos: new Set(medidos.map(tecnicoDe)).size,
  };
}

const agrupar = (lista, clave) => {
  const grupos = new Map();
  for (const item of lista) {
    const valor = clave(item);
    grupos.set(valor, [...(grupos.get(valor) || []), item]);
  }
  return grupos;
};

/**
 * En qué se le fueron las horas: los minutos medidos de cada grupo y su parte
 * del total, en el orden de `grupos` (así cada grupo conserva su color).
 */
export function mezclaDe(medidos, grupos = []) {
  const total = suma(minutosDe(medidos));
  const conDatos = agrupar(medidos.filter(s => s.minutos !== null), s => s.grupo);
  const orden = [...grupos.map(g => g.id), ...[...conDatos.keys()].filter(id => !grupos.some(g => g.id === id))];
  return orden.filter(id => conDatos.has(id)).map((id) => {
    const minutos = suma(conDatos.get(id).map(s => s.minutos));
    return { id, servicios: conDatos.get(id).length, minutos, parte: total ? minutos / total : 0 };
  });
}

/** Orden de las tarjetas del personal. */
export const ORDENES_PERSONAL = [
  { value: 'horas', label: 'Horas' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'jornada', label: 'Por jornada' },
  { value: 'nombre', label: 'Nombre' },
];

const ORDENAR = {
  horas: (a, b) => b.minutos - a.minutos || b.servicios - a.servicios,
  servicios: (a, b) => b.servicios - a.servicios || b.minutos - a.minutos,
  jornada: (a, b) => (b.porJornada ?? -1) - (a.porJornada ?? -1),
  nombre: () => 0,
};

/** El personal en el orden pedido; «Sin identificar» siempre al final. Las filas no se copian. */
export const ordenarPersonal = (filas, orden = 'horas') => [...filas]
  .sort((a, b) => (!a.identificado) - (!b.identificado)
    || (ORDENAR[orden] || ORDENAR.horas)(a, b)
    || a.tecnico.localeCompare(b.tecnico, 'es'));

/**
 * Una fila por técnico con su resumen, su comparación con el área, sus horas
 * por mes y en qué tipos de servicio las usó. «Sin identificar» va al final.
 */
export function porTecnico(medidos, referencia, { grupos = [], desde, hasta, orden = 'horas' } = {}) {
  return ordenarPersonal([...agrupar(medidos, tecnicoDe)]
    .map(([tecnico, servicios]) => ({
      tecnico,
      identificado: tecnico !== SIN_TECNICO,
      ...resumir(servicios),
      indice: indiceFrenteAlArea(servicios, referencia),
      meses: porMes(servicios, desde, hasta),
      mezcla: mezclaDe(servicios, grupos),
    })), orden);
}

/** Con menos servicios medidos en el período anterior, la variación del área no dice nada. */
export const MIN_SERVICIOS_COMPARAR = 10;

/** Parte del período anterior que debe tener historia en DataMET para compararlo. */
export const COBERTURA_COMPARAR = 0.9;

const diasEntreFechas = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

/**
 * ¿Se compara con el período anterior? Solo si DataMET ya tenía servicios en
 * casi todo ese período (si no, se compararía con meses vacíos y saldría, por
 * ejemplo, +2 000 %) y si en él hay suficientes servicios medidos.
 * `motivo`: SIN_HISTORIA o POCOS_DATOS cuando no se compara.
 */
export function comparacion({ primerServicio, anterior, resumenAnterior, minimo = MIN_SERVICIOS_COMPARAR }) {
  if (!anterior) return { comparar: false, motivo: null };
  const largo = diasEntreFechas(anterior.desde, anterior.hasta) + 1;
  const cubierto = primerServicio ? Math.min(largo, diasEntreFechas(primerServicio, anterior.hasta) + 1) : 0;
  if (cubierto / largo < COBERTURA_COMPARAR) return { comparar: false, motivo: 'SIN_HISTORIA' };
  if (!resumenAnterior || resumenAnterior.medidos < minimo) return { comparar: false, motivo: 'POCOS_DATOS' };
  return { comparar: true, motivo: null };
}

/** Cuánto cambió un valor frente al período anterior (0,12 = 12 % más); null si no hay con qué comparar. */
export const variacion = (actual, anterior) => (actual === null || actual === undefined || !anterior ? null : (actual - anterior) / anterior);

/** Una fila por grupo con servicios, en el orden de `grupos` (los desconocidos al final). */
export function porGrupo(medidos, grupos = []) {
  const conDatos = agrupar(medidos, s => s.grupo);
  const orden = [...grupos.map(g => g.id), ...[...conDatos.keys()].filter(id => !grupos.some(g => g.id === id))];
  return orden
    .filter(id => conDatos.has(id))
    .map(id => ({ id, nombre: grupos.find(g => g.id === id)?.nombre || id, ...resumir(conDatos.get(id)) }));
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Los meses del período, también los que no tienen servicios. */
export function porMes(medidos, desde, hasta) {
  if (!desde || !hasta || desde > hasta) return [];
  const delMes = agrupar(medidos, s => String(s.fecha || '').slice(0, 7));
  const variosAnios = desde.slice(0, 4) !== hasta.slice(0, 4);
  const meses = [];
  let anio = Number(desde.slice(0, 4));
  let mes = Number(desde.slice(5, 7));
  const fin = hasta.slice(0, 7);
  for (let guarda = 0; guarda < 120; guarda += 1) {
    const clave = `${anio}-${pad(mes)}`;
    if (clave > fin) break;
    meses.push({
      clave,
      etiqueta: variosAnios ? `${MESES[mes - 1]} ${String(anio).slice(2)}` : MESES[mes - 1],
      nombre: `${MESES_LARGOS[mes - 1]} de ${anio}`,
      ...resumir(delMes.get(clave) || []),
    });
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return meses;
}

/** Técnicos con servicios, en orden alfabético y «Sin identificar» al final. */
export const tecnicosDe = (servicios = []) => [...new Set(servicios.map(tecnicoDe))]
  .sort((a, b) => (a === SIN_TECNICO) - (b === SIN_TECNICO) || a.localeCompare(b, 'es'));

/** Clave del departamento de un servicio ya ubicado (ubicacion.js). */
export const SIN_DEPARTAMENTO = 'SIN_DEPARTAMENTO';
const departamentoDe = servicio => servicio.departamento || SIN_DEPARTAMENTO;

/**
 * Una fila por departamento, en el orden de `departamentos` (todos, aunque no
 * tengan servicios: el mapa los pinta igual). Los servicios sin departamento
 * van al final, solo si los hay. `conUbicacion` cuenta los que traen GPS.
 */
export function porDepartamento(medidos, departamentos = []) {
  const conDatos = agrupar(medidos, departamentoDe);
  const filas = departamentos.map(({ id, nombre }) => {
    const lista = conDatos.get(id) || [];
    return { id, nombre, ...resumir(lista), conUbicacion: lista.filter(s => s.punto).length };
  });
  const sinDepartamento = conDatos.get(SIN_DEPARTAMENTO);
  if (sinDepartamento?.length) {
    filas.push({ id: SIN_DEPARTAMENTO, nombre: 'Sin departamento', ...resumir(sinDepartamento), conUbicacion: 0 });
  }
  return filas;
}

/**
 * Todo lo que muestra el panel. `tecnico`, `departamento` y `grupo` filtran
 * lo que se ve; la referencia de cada grupo sale siempre del área entera en
 * el período. Los grupos no se filtran por grupo ni el mapa por departamento:
 * así se puede elegir otro desde ahí.
 */
export function analizar(servicios = [], {
  grupos = [], grupo = '', tecnico = '', departamento = '', departamentos = [], desde, hasta, orden,
} = {}) {
  const todos = medirServicios(servicios);
  const referencia = referencias(todos);
  const delTecnico = tecnico ? todos.filter(s => tecnicoDe(s) === tecnico) : todos;
  const delDepartamento = departamento ? delTecnico.filter(s => departamentoDe(s) === departamento) : delTecnico;
  const vista = grupo ? delDepartamento.filter(s => s.grupo === grupo) : delDepartamento;
  const delMapa = grupo ? delTecnico.filter(s => s.grupo === grupo) : delTecnico;
  return {
    servicios: vista,
    resumen: resumir(vista),
    porTecnico: porTecnico(vista, referencia, { grupos, desde, hasta, orden }),
    // Todos los grupos (sin el filtro de grupo), para elegir uno desde ahí.
    porGrupo: porGrupo(delDepartamento, grupos),
    mezcla: mezclaDe(vista, grupos),
    porMes: porMes(vista, desde, hasta),
    // Todos los departamentos (sin el filtro de departamento), para el mapa.
    porDepartamento: porDepartamento(delMapa, departamentos),
    serviciosMapa: delMapa,
    tecnicos: tecnicosDe(todos),
    referencia,
  };
}

// ─── Períodos ──────────────────────────────────────────────────────────────

/** Atajos de período: se recalculan con la fecha de hoy. */
export const PERIODOS = [
  { value: 'mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'trimestre', label: 'Últimos 3 meses' },
  { value: 'anio', label: 'Este año' },
  { value: 'doce', label: 'Últimos 12 meses' },
  { value: 'anio-anterior', label: 'Año anterior' },
];

/**
 * Además de los atajos, el período puede ser un mes elegido ('mes-elegido'),
 * varios meses seguidos ('meses') o un rango de fechas libre ('otro').
 */
export const TIPOS_ELEGIDOS = ['mes-elegido', 'meses', 'otro'];

export const esAtajo = tipo => PERIODOS.some(p => p.value === tipo);

/** Fecha local de hoy como AAAA-MM-DD. */
export const hoyLocal = (fecha = new Date()) => `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;

const primerDia = (anio, mes) => {
  const fecha = new Date(anio, mes - 1, 1);
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-01`;
};
const ultimoDia = (anio, mes) => {
  const fecha = new Date(anio, mes, 0);
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
};

/** Desde y hasta de un período (`hoy` en AAAA-MM-DD). `otro` lo elige el usuario. */
export function rangoPeriodo(periodo, hoy) {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  switch (periodo) {
    case 'mes': return { desde: primerDia(anio, mes), hasta: hoy };
    case 'mes-anterior': return { desde: primerDia(anio, mes - 1), hasta: ultimoDia(anio, mes - 1) };
    case 'trimestre': return { desde: primerDia(anio, mes - 2), hasta: hoy };
    case 'doce': return { desde: primerDia(anio, mes - 11), hasta: hoy };
    case 'anio-anterior': return { desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31` };
    case 'anio':
    default: return { desde: `${anio}-01-01`, hasta: hoy };
  }
}

const minimo = (a, b) => (a < b ? a : b);

/** Un mes completo (`clave` AAAA-MM); el mes en curso, hasta hoy. */
export function rangoMes(clave, hoy) {
  const anio = Number(clave.slice(0, 4));
  const mes = Number(clave.slice(5, 7));
  return { desde: primerDia(anio, mes), hasta: minimo(ultimoDia(anio, mes), hoy) };
}

/** Varios meses seguidos, de `desde` a `hasta` (AAAA-MM, en cualquier orden); el mes en curso, hasta hoy. */
export function rangoMeses(desde, hasta, hoy) {
  const [primero, ultimo] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  return { desde: rangoMes(primero, hoy).desde, hasta: rangoMes(ultimo, hoy).hasta };
}

/** Meses entre dos fechas AAAA-MM-DD, contando ambos (ene a mar = 3). */
const mesesEntre = (desde, hasta) => (Number(hasta.slice(0, 4)) - Number(desde.slice(0, 4))) * 12
  + Number(hasta.slice(5, 7)) - Number(desde.slice(5, 7)) + 1;

/** ¿La fecha es el último día de su mes? */
const esFinDeMes = iso => ultimoDia(Number(iso.slice(0, 4)), Number(iso.slice(5, 7))) === iso;

/**
 * Desde y hasta de una selección: { tipo, desde, hasta }. Los atajos se
 * recalculan con `hoy`; lo elegido conserva sus fechas.
 */
export const rangoDeSeleccion = (seleccion, hoy) => (esAtajo(seleccion.tipo)
  ? rangoPeriodo(seleccion.tipo, hoy)
  : { desde: seleccion.desde, hasta: seleccion.hasta });

const fechaLarga = (iso, conAnio = true) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${dia} ${MESES[mes - 1]}${conAnio ? ` ${anio}` : ''}`;
};

/** «3 oct – 15 nov 2026» (el año una vez si es el mismo). */
export function textoRango(desde, hasta) {
  if (!desde || !hasta) return '';
  if (desde === hasta) return fechaLarga(desde);
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
  return `${fechaLarga(desde, !mismoAnio)} – ${fechaLarga(hasta)}`;
}

const mayuscula = texto => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Nombre corto de la selección para el botón: «Este año», «Octubre de 2026», «Ago – oct 2026», «3 oct – 15 nov 2026». */
export function etiquetaSeleccion(seleccion, hoy) {
  const atajo = PERIODOS.find(p => p.value === seleccion.tipo);
  if (atajo) return atajo.label;
  const { desde, hasta } = rangoDeSeleccion(seleccion, hoy);
  if (seleccion.tipo === 'mes-elegido') return mayuscula(`${MESES_LARGOS[Number(desde.slice(5, 7)) - 1]} de ${desde.slice(0, 4)}`);
  if (seleccion.tipo === 'meses') {
    const mesDesde = MESES[Number(desde.slice(5, 7)) - 1];
    const mesHasta = MESES[Number(hasta.slice(5, 7)) - 1];
    return desde.slice(0, 4) === hasta.slice(0, 4)
      ? mayuscula(`${mesDesde} – ${mesHasta} ${hasta.slice(0, 4)}`)
      : mayuscula(`${mesDesde} ${desde.slice(0, 4)} – ${mesHasta} ${hasta.slice(0, 4)}`);
  }
  return textoRango(desde, hasta);
}

const sumarDias = (iso, dias) => {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};
const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

/** El mismo día en otro mes, sin pasarse de su último día (31 → 30 o 28). */
const mismoDia = (anio, mes, dia) => {
  const ultimo = ultimoDia(anio, mes);
  return Number(ultimo.slice(8, 10)) < dia ? ultimo : `${ultimo.slice(0, 8)}${pad(dia)}`;
};

/**
 * Con qué se compara el período: lo que va del año o del mes, con el mismo
 * tramo del año o del mes anterior; un mes o un año completo, con el
 * anterior; lo demás, con uno igual de largo justo antes.
 */
export function periodoAnterior(periodo, { desde, hasta }) {
  const anio = Number(desde.slice(0, 4));
  const mes = Number(desde.slice(5, 7));
  const previo = new Date(anio, mes - 2, 1);
  const anioPrevio = previo.getFullYear();
  const mesPrevio = previo.getMonth() + 1;
  switch (periodo) {
    case 'anio':
      return { desde: `${anio - 1}-01-01`, hasta: mismoDia(anio - 1, Number(hasta.slice(5, 7)), Number(hasta.slice(8, 10))), etiqueta: `vs. mismo período de ${anio - 1}` };
    case 'anio-anterior':
      return { desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31`, etiqueta: `vs. ${anio - 1}` };
    case 'mes':
      return { desde: primerDia(anioPrevio, mesPrevio), hasta: mismoDia(anioPrevio, mesPrevio, Number(hasta.slice(8, 10))), etiqueta: `vs. mismos días de ${MESES_LARGOS[mesPrevio - 1]}` };
    case 'mes-anterior':
      return { desde: primerDia(anioPrevio, mesPrevio), hasta: ultimoDia(anioPrevio, mesPrevio), etiqueta: `vs. ${MESES_LARGOS[mesPrevio - 1]}` };
    // Un mes elegido: completo, con el mes anterior; el mes en curso, con los mismos días del anterior.
    case 'mes-elegido':
      return periodoAnterior(esFinDeMes(hasta) ? 'mes-anterior' : 'mes', { desde, hasta });
    // Varios meses completos, con los mismos meses justo antes.
    case 'meses': {
      if (!esFinDeMes(hasta)) return periodoAnterior('otro', { desde, hasta });
      const cantidad = mesesEntre(desde, hasta);
      return {
        desde: primerDia(anio, mes - cantidad),
        hasta: ultimoDia(anio, mes - 1),
        etiqueta: cantidad === 1 ? `vs. ${MESES_LARGOS[mesPrevio - 1]}` : `vs. los ${cantidad} meses anteriores`,
      };
    }
    default: {
      const largo = diasEntre(desde, hasta) + 1;
      return { desde: sumarDias(desde, -largo), hasta: sumarDias(desde, -1), etiqueta: `vs. los ${largo} días anteriores` };
    }
  }
}

// ─── Formato ───────────────────────────────────────────────────────────────

/** 45 → «45 min»; 95 → «1 h 35 min». */
export function formatoDuracion(minutos) {
  if (minutos === null || minutos === undefined || Number.isNaN(minutos)) return '—';
  const total = Math.round(minutos);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${pad(total % 60)} min`;
}

/** Minutos como horas con un decimal: 12318 → «205,3 h». */
export const formatoHoras = minutos => `${(minutos / 60).toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;

/** Índice frente al área como diferencia: 1,12 → «+12 %»; 0,92 → «−8 %». */
export function formatoDiferencia(indice) {
  if (indice === null || indice === undefined) return '—';
  const porcentaje = Math.round((indice - 1) * 100);
  if (porcentaje === 0) return '±0 %';
  return `${porcentaje > 0 ? '+' : '−'}${Math.abs(porcentaje)} %`;
}

export const formatoPorcentaje = valor => (valor === null || valor === undefined ? '—' : `${Math.round(valor * 100)} %`);

/** Variación como texto sin signo («12 %»); la flecha y el color dicen hacia dónde. */
export const formatoVariacion = valor => (valor === null || valor === undefined ? '—' : `${Math.abs(Math.round(valor * 100))} %`);

/** Iniciales para el avatar: «Jorge De La Rocha» → «JD». */
export const iniciales = nombre => String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export const formatoDecimal = valor => (valor === null || valor === undefined ? '—'
  : valor.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/** Qué grafica la tendencia por mes: una sola serie a la vez (nunca dos escalas en un eje). */
export const METRICAS_MES = {
  servicios: {
    label: 'Servicios',
    valor: mes => mes.servicios,
    texto: valor => (valor === 1 ? '1 servicio' : `${valor} servicios`),
    eje: valor => String(valor),
  },
  horas: {
    label: 'Horas',
    valor: mes => mes.minutos / 60,
    texto: valor => formatoHoras(valor * 60),
    eje: valor => `${valor.toLocaleString('es-BO')} h`,
  },
  promedio: {
    label: 'Media por servicio',
    valor: mes => mes.promedio,
    texto: valor => formatoDuracion(valor),
    eje: valor => `${valor} min`,
  },
};

// ─── Exportación ───────────────────────────────────────────────────────────

/** Un campo de texto para CSV: entre comillas y sin fórmulas (Excel ejecuta «=…»). */
const campoCsv = (valor) => {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  // Un número (una coordenada negativa) no es una fórmula: va tal cual.
  if (typeof valor !== 'number' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/**
 * Los servicios como CSV para Excel (separado por «;», con BOM para las
 * tildes). `columnas` nombra la orden y el grupo de cada área.
 */
export function aCsv(medidos, {
  orden = 'Orden', grupo = 'Grupo', nombreGrupo = id => id, nombreDepartamento = id => id,
} = {}) {
  const encabezado = [
    'Fecha', orden, grupo, 'Técnico', 'Cliente', 'Planta', 'Departamento', 'Código Métrica', 'Equipo', 'Inicio', 'Fin', 'Minutos',
    'Latitud', 'Longitud', 'Observación',
  ];
  const filas = medidos.map(s => [
    s.fecha, s.orden, nombreGrupo(s.grupo), tecnicoDe(s), s.cliente, s.planta,
    s.departamento ? nombreDepartamento(s.departamento) : '', s.codMetrica, s.equipo,
    s.inicio, s.fin, s.minutos ?? '', s.ubicacion?.lat ?? '', s.ubicacion?.lng ?? '', s.problema ? PROBLEMAS[s.problema] : '',
  ].map(campoCsv).join(';'));
  return `\uFEFF${[encabezado.map(campoCsv).join(';'), ...filas].join('\r\n')}\r\n`;
}
