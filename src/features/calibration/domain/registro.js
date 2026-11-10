// Registro de calibración (fase 4): estados, etiquetas de las columnas de
// ServiceMET y qué columnas corrige cada sección del detalle.
import { SECCIONES, ordenarAvisos, seccionDeAviso } from './servicios';

export const ESTADOS_REGISTRO = {
  PENDIENTE: { label: 'Pendiente', tone: 'muted', descripcion: 'Aún no se elaboró el registro.' },
  BORRADOR: { label: 'Borrador', tone: 'warning', descripcion: 'En elaboración.' },
  EN_REVISION: { label: 'En revisión', tone: 'info', descripcion: 'Espera la revisión del jefe de Calibración o de un aprobador.' },
  OBSERVADO: { label: 'Observado', tone: 'danger', descripcion: 'Quien lo revisó lo devolvió con una observación.' },
  APROBADO: { label: 'Aprobado', tone: 'success', descripcion: 'Revisado y aprobado: falta autorizar el certificado.' },
  AUTORIZADO: { label: 'Autorizado', tone: 'info', descripcion: 'Certificado autorizado: falta subir el PDF firmado.' },
  EMITIDO: { label: 'Emitido', tone: 'success', descripcion: 'Certificado firmado y archivado.' },
};

export const ACCIONES_REGISTRO = {
  CREACION: 'Registro creado',
  EDICION: 'Corrección',
  ENVIO: 'Enviado a revisión',
  RETIRO: 'Retirado de revisión',
  APROBACION: 'Aprobado',
  OBSERVACION: 'Observado',
  REAPERTURA: 'Reabierto',
  AUTORIZACION: 'Certificado autorizado',
  ANULACION: 'Autorización anulada',
  EMISION: 'Certificado emitido',
  REVISION: 'Revisión del certificado',
};

export const ESTADOS_EMISION = {
  AUTORIZADO: { label: 'Autorizada', tone: 'info' },
  EMITIDO: { label: 'Vigente', tone: 'success' },
  REEMPLAZADO: { label: 'Reemplazada', tone: 'muted' },
  ANULADO: { label: 'Anulada', tone: 'danger' },
};

export const CLASES_INSTRUMENTO = ['I', 'II', 'III', 'IIII'];

const FIJAS = {
  personal: 'Técnico', n_reca: 'N.º de RECA', sticker: 'Sticker', fecha_servicio: 'Fecha del servicio',
  tipo_equipo: 'Tipo de instrumento', marca: 'Marca', modelo: 'Modelo', serie: 'Serie', cod_int: 'Código interno',
  ubicacion: 'Ubicación', unidades: 'Unidad', n_celdas: 'Celdas de carga',
  hora: 'Hora (inicio)', ti: 'Temperatura (inicio)', hri: 'Humedad (inicio)', patmi: 'Presión (inicio)',
  hora_fin: 'Hora (fin)', ti_fin: 'Temperatura (fin)', hri_fin: 'Humedad (fin)', patmi_fin: 'Presión (fin)',
  tiempo_estab: 'Estabilización de las pesas', t_ope_balanza: 'Operación de la balanza',
  ajuste: '¿Se ajustó?', tipo: 'Tipo de ajuste', cargas_pesas: 'Pesas del ajuste',
  tipo_plataforma: 'Plataforma', puntos_ind: 'Esquema de excentricidad', carga: 'Carga de excentricidad',
  metodo: 'Método', metodo_carga: 'Método de carga',
  emp: 'emp según NB 23001', indicar: 'Tolerancia del cliente (%)', factor: 'Factor de seguridad',
  regla_aceptacion: 'Regla de decisión', mant_soporte: 'Mantenimiento del soporte', venta_pesas: 'Venta de pesas',
  reemplazo: 'Reemplazo', observaciones: 'Observaciones',
  anexo: 'Anexo de información adicional',
  tolerancias: 'Tolerancias del cliente por rango',
};

/** Nombre legible de una columna de DATA_SERVICIOS_DATOS_CALIBRACION. */
export const etiquetaColumna = (columna) => {
  if (FIJAS[columna]) return FIJAS[columna];
  let m;
  if ((m = columna.match(/^(cap_max|d|e|dec)(\d)$/))) return `Rango ${m[2]}: ${{ cap_max: 'Max', d: 'd', e: 'e', dec: 'decimales' }[m[1]]}`;
  if ((m = columna.match(/^equipo(\d)$/))) return `Patrón ${m[1]}`;
  if ((m = columna.match(/^cantidad(\d)$/))) return `Patrón ${m[1]}: cantidad`;
  if ((m = columna.match(/^precarga(\d)$/))) return `Precarga ${m[1]}: carga`;
  if ((m = columna.match(/^p_indicador(\d)$/))) return `Precarga ${m[1]}: indicación`;
  if ((m = columna.match(/^posicion(\d)$/))) return `Excentricidad ${m[1]}: posición`;
  if ((m = columna.match(/^indicacion(\d)$/))) return `Excentricidad ${m[1]}: indicación`;
  if ((m = columna.match(/^retorno(\d)$/))) return `Excentricidad ${m[1]}: retorno`;
  if ((m = columna.match(/^repetibilidad(\d)$/))) return `Repetibilidad ${m[1]}: carga`;
  if ((m = columna.match(/^indicacion(\d)_(\d+)$/))) return `Repetibilidad ${m[1]}, lectura ${m[2]}`;
  if ((m = columna.match(/^retorno(\d)_(\d+)$/))) return `Repetibilidad ${m[1]}, retorno ${m[2]}`;
  if ((m = columna.match(/^lin(\d+)$/))) return `Error, punto ${m[1]}: carga`;
  if ((m = columna.match(/^ind(\d+)$/))) return `Error, punto ${m[1]}: indicación`;
  if ((m = columna.match(/^retorno_lin(\d+)$/))) return `Error, punto ${m[1]}: retorno`;
  if ((m = columna.match(/^composicion(\d+)$/))) return `Error, punto ${m[1]}: piezas de la carga`;
  if (columna === 'clase') return 'Clase del instrumento';
  return columna;
};

const SI_NO = [['S\u00ed', 'S\u00ed'], ['No', 'No']];

// Columnas que en ServiceMET se eligen de una lista: [texto que guarda ServiceMET, etiqueta].
const OPCIONES_COLUMNA = {
  unidades: [['mg', 'mg'], ['g', 'g'], ['kg', 'kg'], ['t', 't']],
  ajuste: SI_NO,
  tipo: [['Externo', 'Externo'], ['INTERNO', 'Interno'], ['NO APLICA', 'No aplica']],
  tipo_plataforma: [['Rectangular', 'Rectangular'], ['Circular', 'Circular'], ['Cuadrada', 'Cuadrada'], ['Triangular', 'Triangular']],
  metodo: [
    ['Ascenso evaluando ceros', 'Ascenso evaluando ceros'],
    ['Ascenso contin\u00fao por pasos', 'Ascenso continuo por pasos'],
    ['Sin metodo de carga', 'Sin m\u00e9todo'],
  ],
  metodo_carga: [['Sin m\u00e9todo de carga', 'Sin m\u00e9todo de carga'], ['M\u00e9todo 1', 'M\u00e9todo 1'], ['M\u00e9todo 2', 'M\u00e9todo 2']],
  emp: SI_NO,
  regla_aceptacion: [['Ninguna', 'Ninguna'], ['Simple', 'Simple'], ['Conservadora', 'Conservadora']],
  mant_soporte: SI_NO,
  venta_pesas: SI_NO,
  reemplazo: SI_NO,
};

/**
 * Opciones de una columna que en ServiceMET es una lista, o null si es texto
 * libre. Si el valor actual no est\u00e1 entre ellas (una variante antigua, un
 * marcador de la validaci\u00f3n de pesas) se ofrece tal cual, para no perderlo.
 */
export const opcionesDeColumna = (columna, actual) => {
  const lista = OPCIONES_COLUMNA[columna];
  if (!lista) return null;
  const opciones = [{ value: '', label: 'Sin dato' }, ...lista.map(([value, label]) => ({ value, label }))];
  const texto = actual == null ? '' : String(actual);
  if (texto && !lista.some(([value]) => value === texto)) opciones.push({ value: texto, label: `${texto} (como est\u00e1)` });
  return opciones;
};

const rango = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
const conDato = (valores, columnas) => columnas.some(c => valores[c] != null && valores[c] !== '' && valores[c] !== 0);

/**
 * Campos que se corrigen en cada sección del detalle: una lista de columnas
 * sueltas y tablas de filas repetidas. `valores` son los efectivos (ServiceMET
 * con las correcciones) para decidir qué filas mostrar.
 */
export const camposDeSeccion = (seccion, valores = {}) => {
  switch (seccion) {
    case 'servicio':
      return { lista: ['personal', 'n_reca', 'sticker', 'fecha_servicio'], tablas: [] };
    case 'instrumento':
      return {
        lista: ['tipo_equipo', 'marca', 'modelo', 'serie', 'cod_int', 'ubicacion', 'unidades', 'n_celdas'],
        tablas: [{
          titulo: 'Rangos (como los envía ServiceMET: el mayor primero)',
          columnas: ['Max', 'd', 'e', 'Decimales'],
          filas: [1, 2, 3].map(i => ({ etiqueta: `Rango ${i}`, celdas: [`cap_max${i}`, `d${i}`, `e${i}`, `dec${i}`] })),
        }],
        clase: true,
      };
    case 'patrones':
      return {
        lista: [],
        tablas: [{
          titulo: 'Patrones (1 a 5: juegos de pesas; 6 y 7: termohigrómetros)',
          columnas: ['Código', 'Cantidad'],
          filas: rango(1, 7).map(i => ({ etiqueta: `Patrón ${i}`, celdas: [`equipo${i}`, `cantidad${i}`] })),
        }],
      };
    case 'ambiente':
      return {
        lista: ['tiempo_estab', 't_ope_balanza'],
        tablas: [{
          titulo: 'Condiciones ambientales',
          columnas: ['Hora', 't (°C)', 'HR (%)', 'p (hPa)'],
          filas: [
            { etiqueta: 'Inicio', celdas: ['hora', 'ti', 'hri', 'patmi'] },
            { etiqueta: 'Fin', celdas: ['hora_fin', 'ti_fin', 'hri_fin', 'patmi_fin'] },
          ],
        }],
      };
    case 'ajuste':
      return {
        lista: ['ajuste', 'tipo', 'cargas_pesas'],
        tablas: [{
          titulo: 'Precarga (lecturas antes del ajuste)',
          columnas: ['Carga', 'Indicación'],
          filas: rango(1, 6).map(i => ({ etiqueta: `Precarga ${i}`, celdas: [`precarga${i}`, `p_indicador${i}`] })),
        }],
      };
    case 'excentricidad':
      return {
        lista: ['tipo_plataforma', 'puntos_ind', 'carga'],
        tablas: [{
          titulo: 'Posiciones',
          columnas: ['Posición', 'Indicación', 'Retorno'],
          filas: rango(1, 6).map(i => ({ etiqueta: `Posición ${i}`, celdas: [`posicion${i}`, `indicacion${i}`, `retorno${i}`] })),
        }],
      };
    case 'repetibilidad':
      return {
        lista: [],
        tablas: [1, 2, 3].map(k => ({
          titulo: `Repetibilidad ${k}`,
          columnas: ['Indicación', 'Retorno'],
          cabecera: `repetibilidad${k}`,
          filas: rango(1, 10).map(j => ({ etiqueta: `Lectura ${j}`, celdas: [`indicacion${k}_${j}`, `retorno${k}_${j}`] })),
        })),
      };
    case 'errores': {
      // Los puntos con datos y dos vacíos más, para agregar.
      const conDatos = rango(1, 60).filter(n => conDato(valores, [`lin${n}`, `ind${n}`]));
      const ultimo = conDatos.length ? Math.max(...conDatos) : 0;
      const numeros = [...new Set([...conDatos, ...rango(ultimo + 1, Math.min(60, ultimo + 2))])].sort((a, b) => a - b);
      return {
        lista: ['metodo', 'metodo_carga'],
        tablas: [{
          titulo: 'Puntos del ensayo de error',
          columnas: ['Carga', 'Indicación', 'Retorno'],
          filas: numeros.map(n => ({ etiqueta: `Punto ${n}`, celdas: [`lin${n}`, `ind${n}`, `retorno_lin${n}`] })),
        }],
      };
    }
    case 'criterio':
      return { lista: ['emp', 'indicar', 'factor', 'regla_aceptacion', 'mant_soporte', 'venta_pesas', 'reemplazo', 'observaciones'], tablas: [] };
    default:
      return { lista: [], tablas: [] };
  }
};

/** Columnas de una sección (lista, tablas y cabeceras de tabla). */
export const columnasDeSeccion = (campos) => [
  ...campos.lista,
  ...campos.tablas.flatMap(t => [...(t.cabecera ? [t.cabecera] : []), ...t.filas.flatMap(f => f.celdas)]),
];

/** Valor nominal de una pesa con coma decimal, sin ceros de redondeo binario. */
export const textoNominal = (valor) => String(Number(Number(valor).toPrecision(10))).replace('.', ',');

/** Piezas disponibles por juego, de mayor a menor y, en un mismo valor, por su marca. */
export const agruparPiezas = (disponibles) => {
  const grupos = new Map();
  for (const pieza of disponibles || []) {
    if (!grupos.has(pieza.juego)) grupos.set(pieza.juego, []);
    grupos.get(pieza.juego).push(pieza);
  }
  return [...grupos].map(([juego, piezas]) => ({
    juego,
    piezas: [...piezas].sort((a, b) => b.nominal - a.nominal || (a.identificacion || '').localeCompare(b.identificacion || '')),
  }));
};

/** Suma de los valores nominales de las piezas elegidas. */
export const sumaPiezas = (disponibles, claves) => {
  const porClave = new Map((disponibles || []).map(p => [p.clave, p]));
  return claves.reduce((total, clave) => total + (porClave.get(clave)?.nominal || 0), 0);
};

/** Valor como se muestra en un campo de texto (coma decimal). */
export const aTexto = (valor) => (valor == null ? '' : typeof valor === 'number' ? String(valor).replace('.', ',') : String(valor));

/**
 * Columnas que cambiaron entre lo que se muestra y lo que escribió el usuario.
 * Compara números con coma o punto como iguales.
 */
export const columnasCambiadas = (efectivos, escritos) => Object.fromEntries(
  Object.entries(escritos)
    .filter(([columna, texto]) => aTexto(efectivos[columna]).replace(',', '.') !== String(texto ?? '').trim().replace(',', '.'))
    .map(([columna, texto]) => [columna, String(texto ?? '').trim() === '' ? null : String(texto).trim()]),
);

export const ETIQUETAS_SECCION = Object.fromEntries([...SECCIONES.map(s => [s.id, s.label]), ['resultados', 'Resultados']]);

/**
 * Avisos que conviene revisar antes de enviar a revisión: los de los datos
 * (adaptador) y los del cálculo (motor), sin repetir el mismo código ni el
 * mismo mensaje. Las notas solo se cuentan.
 */
export const avisosParaEnvio = (avisos, calculo) => {
  const datos = avisos.map(a => ({ ...a, seccion: seccionDeAviso(a) }));
  const codigos = new Set(datos.map(a => a.codigo));
  const mensajes = new Set(datos.map(a => a.mensaje));
  const delCalculo = (calculo?.avisos || [])
    .filter(a => !codigos.has(a.codigo) && !mensajes.has(a.mensaje))
    .map(a => ({ ...a, seccion: 'resultados' }));
  const todos = ordenarAvisos([...datos, ...delCalculo]);
  return { revisar: todos.filter(a => a.nivel !== 'info'), notas: todos.filter(a => a.nivel === 'info').length };
};
