/**
 * Plantillas de los 8 informes de Soporte técnico.
 *
 * Cada plantilla es la lista de bloques del informe en el orden de la
 * plantilla Excel del área (IMPR, IMPA, IMCR, IDIG, INST, AJML, IREL), con
 * sus mismas etiquetas, y las columnas de DATA_SERVICIOS_DATOS_* que llenan
 * cada casilla. Verificaciones internas (VFI) no tenía plantilla Excel: sigue
 * el mismo diseño con los campos de ServiceMET.
 *
 * Los mismos bloques arman el formulario de edición (ver seccionesEditor).
 */
import { OPCIONES_AJUSTE, OPCIONES_RECOMENDACION } from './valoraciones';

// ─── Campos ────────────────────────────────────────────────────────────────

const campo = (nombre, label, tipo = 'texto', extra = {}) => ({ campo: nombre, label, tipo, ...extra });

const CLIENTE = {
  tipo: 'datos',
  id: 'cliente',
  titulo: 'Datos del Cliente:',
  filas: [
    [campo('cliente', 'Cliente:'), campo('dir_planta', 'Dirección:')],
    [campo('otst', 'OTST:', 'texto', { soloLectura: true }), campo('fecha_servicio', 'Fecha:', 'fecha')],
    [campo('dep_planta', 'Ciudad:'), campo('planta', 'Planta:')],
  ],
};

const INSTRUMENTO = {
  tipo: 'datos',
  id: 'instrumento',
  titulo: 'Detalles del Instrumento:',
  filas: [
    [campo('tipo_equipo', 'Instrumento'), campo('ubicacion', 'Ubicación:')],
    [campo('marca', 'Marca:'), campo('cod_int', 'Código Interno:')],
    [campo('modelo', 'Modelo:'), campo('cod_metrica', 'Código Métrica:', 'texto', { soloLectura: true })],
    [campo('serie', 'Serie:'), campo('num_celdas', 'N° de Celdas:', 'entero')],
  ],
};

const rangos = (filas = 3) => ({ tipo: 'rangos', id: 'rangos', titulo: 'Rangos e Intervalo:', filas });

const LEYENDA = { tipo: 'leyenda', id: 'leyenda' };

const texto = (id, titulo, nombre, extra = {}) => ({ tipo: 'texto', id, titulo, campo: nombre, ...extra });

const observaciones = (nombre = 'comentario_general') => texto('observaciones', 'Observaciones y/o Recomendaciones:', nombre);

const adicionales = (campos = [
  campo('fecha_prox_servicio', 'Fecha próximo servicio sugerido:', 'fecha'),
  campo('recomendacion', 'Tipo de servicio sugerido:', 'recomendacion'),
]) => ({ tipo: 'adicionales', id: 'adicionales', titulo: 'Datos adicionales:', campos });

const conclusion = (fisico, operacional, metrologico, extras = []) => ({
  tipo: 'conclusion',
  id: 'conclusion',
  titulo: 'Conclusión:',
  campos: [
    campo(fisico, 'Físico:', 'estado'),
    campo(operacional, 'Operacional:', 'estado'),
    campo(metrologico, 'Metrológico:', 'estado'),
  ],
  // Segunda fila (solo se imprime si tiene datos).
  extras,
});

const tecnico = (etiqueta = 'Técnico Especialista:') => ({
  tipo: 'tecnico', id: 'tecnico', etiqueta, campo: 'personal',
});

/** Fila de una tabla «Parámetro | Estado Inicial | Ajuste». */
const item = (label, base, extra = {}) => ({
  label,
  estado: `${base}_estado`,
  ajuste: `${base}_solucion`,
  ...extra,
});

const checklist = (id, titulo, items, extra = {}) => ({
  tipo: 'checklist',
  id,
  titulo,
  columnas: ['Parámetro:', 'Estado Inicial', 'Ajuste:'],
  items,
  ...extra,
});

// ─── Pruebas metrológicas ──────────────────────────────────────────────────

/**
 * Columnas de un bloque de pruebas. `filas` es lo que muestra la plantilla;
 * si el servicio trae más puntos, el informe los agrega hasta `max`.
 */
const pruebasEstandar = (momento, { filasExc = 5, filasLin = 6, estabilidad } = {}) => ({
  plataforma: { tipo: `tipo_plataforma_${momento}`, puntos: `puntos_ind_${momento}` },
  exc: {
    carga: `carga_exc_${momento}`,
    posicion: i => `posicion_${momento}_${i}`,
    indicacion: i => `indicacion_${momento}_${i}`,
    filas: filasExc,
    max: 12,
  },
  rep: {
    carga: `repetibilidad1_${momento}`,
    indicacion: i => `indicacion1_${momento}_${i}`,
    filas: 5,
    max: 10,
  },
  lin: {
    carga: i => `lin_${momento}_${i}`,
    indicacion: i => `ind_${momento}_${i}`,
    filas: filasLin,
    max: 12,
  },
  retorno: `retorno_cero_${momento}_valoracion`,
  estabilidad: estabilidad || `estabilizacion_${momento}`,
});

const pruebasIbm = (momento) => ({
  plataforma: { tipo: `excentricidad_${momento}_tipo_plataforma`, puntos: null },
  exc: {
    carga: `excentricidad_${momento}_carga`,
    posicion: i => `excentricidad_${momento}_pos${i}_numero`,
    indicacion: i => `excentricidad_${momento}_pos${i}_indicacion`,
    filas: 5,
    max: 6,
  },
  rep: {
    carga: `repetibilidad_${momento}_carga1_valor`,
    indicacion: i => `repetibilidad_${momento}_carga1_prueba${i}_indicacion`,
    filas: 5,
    max: 10,
  },
  lin: {
    carga: i => `linealidad_${momento}_punto${i}_lt`,
    indicacion: i => `linealidad_${momento}_punto${i}_indicacion`,
    filas: 6,
    max: 12,
  },
  retorno: `retorno_cero_${momento}_valoracion`,
  estabilidad: `estabilizacion_${momento}`,
});

const PRUEBAS_RVD = {
  plataforma: { tipo: 'tipo_plataforma', puntos: 'puntos_ind' },
  exc: { carga: 'carga', posicion: i => `posicion${i}`, indicacion: i => `indicacion${i}`, filas: 5, max: 6 },
  rep: { carga: 'repetibilidad1', indicacion: i => `indicacion1_${i}`, filas: 5, max: 10 },
  lin: { carga: i => `lin${i}`, indicacion: i => `ind${i}`, filas: 6, max: 12 },
  retorno: 'retorno_cero',
  // La plantilla IREL lleva «carga_retorno_cero» en la casilla de estabilidad.
  estabilidad: 'carga_retorno_cero',
};

const pruebas = (id, titulo, esquema, extra = {}) => ({
  tipo: 'pruebas', id, titulo, esquema, division: 'd', ...extra,
});

// ─── Textos fijos ──────────────────────────────────────────────────────────

const ALCANCE_REGULAR = {
  tipo: 'alcance',
  id: 'alcance',
  titulo: 'Alcance del Servicio:',
  lineas: [
    'Pruebas Iniciales: Verificación de estabilidad, retorno a cero, repetibilidad, excentricidad y linealidad.',
    'Inspección Visual: Evaluación del estado físico de la plataforma, indicador, caja sumadora (si aplica) y cableado general.',
    'Inspección Operativa: Comprobación del funcionamiento general y del software de pesaje (si aplica).',
    'Revisión de Conexiones: Corrección o resoldado de cables, conectores y adaptadores. Evaluación del suministro eléctrico y puesta a tierra.',
    'Ajuste Mecánico: Revisión y ajuste de limitadores y topes de sobrecarga.',
    'Diagnóstico Funcional: Detección de posibles fallas operativas (sin incluir reparaciones o reemplazos).',
    'Limpieza y Lubricación: Limpieza interna y externa, lubricación de componentes y nivelación final.',
    'Ajuste Metrológico: Corrección de parámetros de linealidad y span para garantizar precisión.',
    'Pruebas Finales: Repetición de pruebas cualitativas para validar el correcto desempeño.',
  ],
  nota: 'Nota: Las tareas pueden variar según las condiciones de instalación y tipo de instrumento.',
};

const ALCANCE_AVANZADO = {
  tipo: 'alcance',
  id: 'alcance',
  titulo: 'Alcance del Servicio:',
  compacto: true,
  lineas: [
    'Inspección Visual: Revisión del estado físico de la plataforma, terminal de pesaje, caja sumadora (si aplica) y cableado, incluyendo conectores, adaptadores y puntos de unión.',
    'Inspección Operativa: Verificación del funcionamiento general del sistema de pesaje. Comprobación del software de pesaje (si aplica).',
    'Revisión y Corrección de Conexiones: Resoldado de cables, conectores, clavijas y adaptadores de voltaje (si aplica).',
    'Ajuste y verificación de prensacables, así como evaluación del suministro eléctrico (tensión, continuidad y puesta a tierra).',
    'Ajuste de Componentes Mecánicos: Verificación y ajuste de limitadores longitudinales y transversales.',
    'Limpieza y lubricación de limitadores longitudinales y transversales.',
    'Elevación de la estructura para el desmontaje de celdas de carga; inspección de celdas, conectores y componentes mecánicos.',
    'Limpieza y lubricación de celdas de carga, limpieza de conectores (si aplica), limpieza y lubricación de receptores de carga, e inspección general de accesorios.',
    'Ajuste de nivelación mediante laineado de celdas y ajuste de conteos de celda (si aplica).',
    'Limpieza e inspección de cajas sumadoras o de Unión (si aplica).',
    'Inspección Funcional: Detección y diagnóstico de posibles fallas operativas (no incluye reparación ni reemplazo de componentes).',
    'Ajustes Metrológicos: Corrección de parámetros de excentricidad para garantizar la precisión del sistema.',
    'Pruebas Cualitativas Finales: Ejecución de pruebas de estabilidad, retorno a cero, repetibilidad y excentricidad para validar el correcto funcionamiento tras el mantenimiento y garantizar la verificación con IBMETRO.',
    'Acompañamiento: Asistencia durante el proceso de verificación con el personal de IBMETRO.',
  ],
  nota: 'Nota: Las tareas pueden variar según las condiciones de instalación y tipo de instrumento.',
};

// ─── Opciones de la instalación (ServiceMET) ──────────────────────────────

const OPCIONES_INSTALACION = {
  entorno: ['Seco', 'Polvoso', 'Muy polvoso', 'Húmedo parcial', 'Húmedo constante'],
  superficie_apoyo: ['Bueno', 'Malo', 'Aceptable', 'No aplica'],
  tension_red: ['Estable', 'Inestable', 'Con picos', 'Fuera de rango'],
  sistema_tierra: ['Correcto', 'Deficiente', 'Inexistente', 'No verificado'],
  comunicacion_pc: ['Correcta', 'Intermitente', 'Sin conexión', 'No aplica'],
  movilizacion: ['Ninguna', 'Dentro el área', 'Fuera del área', 'Fuera del sector'],
  vibracion_externa: ['Nula', 'Leve', 'Moderada', 'Alta'],
  flujo_pesadas: ['1 a 10 por día', '10 a 50 por día', '50 a 100 por día', 'Más de 100 por día'],
};

const itemInstalacion = (label, base) => ({
  label,
  estado: `${base}_valor`,
  ajuste: `${base}_comentario`,
  // La plantilla INST imprime «No aplica» en el ajuste si no hay comentario.
  ajustePorDefecto: 'No aplica',
  tipoEstado: 'opciones',
  opcionesEstado: OPCIONES_INSTALACION[base],
  tipoAjuste: 'texto',
});

// ─── Plantillas ────────────────────────────────────────────────────────────

const ENTORNO_REGULAR = checklist('entorno', 'Entorno de Trabajo:', [
  item('Vibración:', 'vibracion'),
  item('Humedad:', 'humedad'),
  item('Limpieza Perímetro:', 'polvo'),
  item('Superficie de apoyo:', 'mesada'),
  item('Temperatura:', 'temperatura'),
  item('Limpieza de fosa:', 'limpieza_fosa'),
  item('Estado del Drenaje:', 'estado_drenaje'),
  item('Iluminación:', 'iluminacion'),
]);

const MPR = {
  titulo: 'Mantenimiento Preventivo Regular',
  prefijo: 'IMPR',
  bloques: [
    CLIENTE,
    INSTRUMENTO,
    rangos(3),
    ALCANCE_REGULAR,
    LEYENDA,
    pruebas('pruebas-inicial', 'Pruebas Metrológicas Iniciales:', pruebasEstandar('inicial'), { nuevaPagina: true }),
    ENTORNO_REGULAR,
    checklist('terminal', 'Terminal de Pesaje:', [
      item('Carcasa terminal de peso:', 'carcasa'),
      item('Bracket/Soporte:', 'bracket'),
      item('Teclado físico:', 'teclado_fisico'),
      item('Teclado operativo:', 'teclado_operativo'),
      item('Display físico:', 'display_fisico'),
      item('Display operativo:', 'display_operativo'),
      item('Fuente de poder:', 'fuente_poder'),
      item('Conector de celda:', 'conector_celda'),
      item('Batería operacional:', 'bateria_operacional'),
      item('Batería de memoria:', 'bateria_memoria'),
    ]),
    checklist('estado-general', 'Estado General del Instrumento:', [
      item('Limpieza e inspección general:', 'limpieza_general'),
      item('Inspección al Receptor de carga:', 'limpieza_receptor'),
      item('Evidencia de golpes al terminal:', 'golpes_terminal'),
      item('Golpes al receptor de carga:', 'golpes_receptor'),
      item('Nivelación:', 'nivelacion'),
      item('Inicialización y encendido:', 'encendido'),
    ]),
    checklist('plataforma', 'Plataforma y Caja Sumadora:', [
      item('Limitadores de movimiento:', 'limitador_movimiento'),
      item('Tapa de la caja sumadora:', 'tapa_caja'),
      item('Suspensión (Patas):', 'suspension'),
      item('Humedad interna:', 'humedad_interna'),
      item('Limitadores de sobrecarga:', 'limitador_carga'),
      item('Estado prensacables:', 'estado_prensacables'),
      item('Estado General de la celda de carga:', 'celda_carga'),
      item('Estado de borneas:', 'estado_borneas'),
    ]),
    pruebas('pruebas-final', 'Pruebas Metrológicas Finales:', pruebasEstandar('final')),
    observaciones(),
    // ServiceMET registra la conclusión del técnico desde 2026: el bloque
    // sale solo si tiene texto.
    texto('conclusiones', 'Conclusiones:', 'conclusion', { opcional: true }),
    adicionales(),
    conclusion('estado_fisico', 'estado_operacional', 'estado_metrologico', [
      campo('estado_final', 'Estado final:', 'estado'),
      campo('personal_apoyo', 'Personal de apoyo:', 'opciones', { opciones: ['Sí', 'No'] }),
    ]),
    tecnico(),
  ],
};

const PRUEBAS_AVANZADO = pruebasEstandar('final', { filasExc: 6, filasLin: 12 });

const MPA = {
  titulo: 'Mantenimiento Preventivo Avanzado',
  prefijo: 'IMPA',
  bloques: [
    CLIENTE,
    INSTRUMENTO,
    rangos(1),
    ALCANCE_AVANZADO,
    LEYENDA,
    checklist('puente', 'Estado General del Puente de Pesaje', [
      item('Losas de aproximación', 'losas_aproximacion'),
      item('Estado Rieles Laterales', 'estado_rieles'),
      item('Fundaciones', 'fundaciones'),
      item('Corrosión', 'corrosion'),
      item('Puente de pesaje (Grietas)', 'puente_grietas'),
      item('Estado del Drenaje', 'drenaje_libre'),
      item('Tapas Superiores y Pernos', 'tapas_pernos'),
      item('Bomba de Sumidero', 'bomba_sumidero'),
      item('Desgaste y Estrés', 'desgaste_estres'),
      item('Fosa Libre de Humedad', 'fosa_humedad'),
      item('Limpieza Perímetro del puente', 'limpieza_perimetro'),
      item('Limitadores Longitudinales', 'limitadores_long'),
      item('Limpieza por debajo del puente', 'limpieza_puente'),
      item('Limitadores Transversales', 'limitadores_trans'),
    ], { nuevaPagina: true }),
    checklist('cableado', 'Cableado y Conectores', [
      item('Cable Home Run', 'cable_homerun'),
      item('Conector de celda', 'conectores_celdas'),
      item('Cables de Celdas de Carga', 'cables_celdas'),
      item('Conector de Terminación', 'conector_terminacion'),
      item('Conexión Celda de carga y cable', 'conexion_celda_cable'),
      item('Caja de Unión o Sumadora', 'caja_union'),
    ]),
    checklist('celdas', 'Celdas de Carga', [
      item('Limpieza e inspección Bearing Cups', 'bearing_cups'),
      item('Limpieza e inspección Celdas de Carga', 'celdas_carga'),
      item('Lubricación Bearing Cups', 'lubricacion_bearing'),
      item('Lubricación celdas de Carga', 'lubricacion_celdas'),
      item('Limpieza e inspección Conectores', 'limpieza_conectores'),
      item('Limpieza e inspección Superficies de acoplamiento estructura', 'limpieza_estructura'),
    ]),
    checklist('descargas', 'Protección contra Descargas Atmosféricas', [
      item('Sistema de Protección contra Rayos', 'sistema_proteccion_rayos'),
      item('Tensión Adecuada Entre Neutro y Tierra', 'tension_neutro_tierra'),
      item('Conexión de Malla de Tierra', 'conexion_malla_tierra'),
      item('Estado Strike Shield', 'estado_strike_shield'),
    ]),
    checklist('terminal', 'Terminal de Peso', [
      item('Carcasa', 'carcasa'),
      item('Registro Predictivo solo PDX', 'registros_predictivo'),
      item('Voltaje pila de Botón', 'voltaje_pila'),
      item('Alertas de Servicio MT', 'alertas_servicio'),
      item('Estado del Teclado', 'estado_teclado'),
      item('Estado prensacables:', 'estado_prensacables'),
      item('Estado del display', 'estado_display'),
      item('Comunicación con PC', 'comunicacion_pc'),
    ], { nuevaPagina: true }),
    checklist('verificacion', 'Verificación', [
      item('Balanza apta para Verificación Dentro tolerancias NB23001', 'balanza_apta'),
    ]),
    {
      tipo: 'excentricidadAvanzado',
      id: 'excentricidad',
      titulo: 'Pruebas Metrológicas de Excentricidad',
      esquema: PRUEBAS_AVANZADO,
      division: 'e',
      editor: { tipo: 'pruebas', titulo: 'Pruebas metrológicas finales', esquema: PRUEBAS_AVANZADO, division: 'e' },
    },
    { tipo: 'repetibilidadAvanzado', id: 'repetibilidad', titulo: 'Pruebas Metrológicas de Repetibilidad', esquema: PRUEBAS_AVANZADO, division: 'e', editor: null },
    { tipo: 'linealidadAvanzado', id: 'linealidad', titulo: 'Pruebas Metrológicas de Linealidad', esquema: PRUEBAS_AVANZADO, division: 'e', editor: null, nuevaPagina: true },
    { tipo: 'retornoEstabilidad', id: 'retorno', esquema: PRUEBAS_AVANZADO, editor: null },
    observaciones(),
    adicionales(),
    conclusion('fisico', 'operacional', 'metrologico'),
    tecnico(),
  ],
};

const MCR = {
  titulo: 'Mantenimiento Correctivo',
  prefijo: 'IMCR',
  bloques: [
    CLIENTE,
    INSTRUMENTO,
    rangos(3),
    LEYENDA,
    texto('reporte', 'Reporte de Falla', 'reporte'),
    texto('evaluacion', 'Evaluación y Análisis Técnico de Fallas', 'evaluacion'),
    texto('trabajo', 'Trabajo Realizado', 'trabajo_realizado', { nuevaPagina: true }),
    pruebas('pruebas-final', 'Pruebas Metrológicas:', pruebasEstandar('final')),
    observaciones(),
    adicionales(),
    conclusion('fisico', 'operacional', 'metrologico'),
    tecnico(),
  ],
};

const DIG = {
  titulo: 'Diagnóstico',
  prefijo: 'IDIG',
  bloques: [
    CLIENTE,
    INSTRUMENTO,
    rangos(3),
    texto('reporte', 'Reporte de Falla', 'reporte'),
    texto('evaluacion', 'Evaluación y Análisis Técnico de Fallas', 'evaluacion'),
    texto('conclusiones', 'Conclusiones y Recomendaciones', 'comentario_general'),
    tecnico(),
  ],
};

const INT = {
  titulo: 'Informe de Instalación',
  prefijo: 'INST',
  bloques: [
    CLIENTE,
    INSTRUMENTO,
    rangos(3),
    LEYENDA,
    checklist('entorno', 'Entorno de Trabajo:', [
      itemInstalacion('Condición Ambiental', 'entorno'),
      itemInstalacion('Tensión de Red Estable', 'tension_red'),
      itemInstalacion('Superficie de Apoyo', 'superficie_apoyo'),
      itemInstalacion('Sistema de Tierra', 'sistema_tierra'),
      itemInstalacion('Movilización', 'movilizacion'),
      itemInstalacion('Flujo de Pesadas', 'flujo_pesadas'),
      itemInstalacion('Vibración Externa / Flujos de Aire', 'vibracion_externa'),
      itemInstalacion('Comunicación a PC', 'comunicacion_pc'),
    ]),
    pruebas('pruebas-inicial', 'Pruebas Metrológicas:', pruebasEstandar('inicial', {
      estabilidad: 'retorno_cero_inicial_estabilidad',
    }), { nuevaPagina: true }),
    observaciones(),
    adicionales(),
    conclusion('estado_fisico', 'estado_operacional', 'estado_metrologico'),
    tecnico(),
  ],
};

const IBM = {
  titulo: 'Ajuste Metrológico en Linealidad',
  prefijo: 'AJML',
  bloques: [
    CLIENTE,
    INSTRUMENTO,
    rangos(3),
    LEYENDA,
    pruebas('pruebas-inicial', 'Pruebas Metrológicas Iniciales:', pruebasIbm('inicial')),
    pruebas('pruebas-final', 'Pruebas Metrológicas Finales:', pruebasIbm('final'), { nuevaPagina: true }),
    observaciones(),
    adicionales(),
    conclusion('fisico', 'operacional', 'metrologico'),
    tecnico(),
  ],
};

const VFI = {
  titulo: 'Verificaciones Internas',
  prefijo: 'IVFI',
  bloques: [
    CLIENTE,
    INSTRUMENTO,
    rangos(3),
    LEYENDA,
    checklist('puente', 'Estado General del Puente de Pesaje', [
      item('Espaciamiento topes longitudinales', 'espaciamiento_topes_long'),
      item('Espaciamiento topes frontales', 'espaciamiento_topes_front'),
      item('Limpieza del puente de pesaje', 'limpieza_puente'),
      item('Limpieza debajo del puente', 'limpieza_debajo_puente'),
    ]),
    pruebas('pruebas-inicial', 'Pruebas Metrológicas:', pruebasEstandar('inicial'), { nuevaPagina: true }),
    {
      tipo: 'conclusion',
      id: 'evaluacion-pruebas',
      titulo: 'Evaluación de las Pruebas:',
      campos: [
        campo('excentricidad_estado_general', 'Excentricidad:', 'estado'),
        campo('repetibilidad_estado_general', 'Repetibilidad:', 'estado'),
        campo('linealidad_estado_general', 'Linealidad:', 'estado'),
      ],
    },
    observaciones(),
    adicionales(),
    conclusion('fisico', 'operacional', 'metrologico'),
    tecnico(),
  ],
};

const RVD = {
  titulo: 'Relevamiento de Datos',
  prefijo: 'IREL',
  bloques: [
    CLIENTE,
    INSTRUMENTO,
    rangos(3),
    ALCANCE_REGULAR,
    LEYENDA,
    pruebas('pruebas', 'Pruebas Metrológicas:', PRUEBAS_RVD, { nuevaPagina: true }),
    {
      tipo: 'checklist3',
      id: 'entorno',
      titulo: 'Entorno de Trabajo:',
      columnas: [
        [
          campo('carcasa', 'Carcasa:', 'estado'),
          campo('conector_cables', 'Conector y cables:', 'estado'),
          campo('alimentacion', 'Alimentación:', 'estado'),
          campo('pantalla', 'Pantalla:', 'estado'),
          campo('teclado', 'Teclado:', 'estado'),
          campo('bracket_columna', 'Bracket y columna:', 'estado'),
          campo('plato_carga', 'Plato de carga:', 'estado'),
          campo('estructura', 'Estructura:', 'estado'),
        ],
        [
          campo('topes_carga', 'Topes de carga:', 'estado'),
          campo('patas', 'Patas:', 'estado'),
          campo('limpieza', 'Limpieza:', 'estado'),
          campo('bordes_puntas', 'Bordes y puntas:', 'estado'),
          campo('celulas', 'Celulas:', 'estado'),
          campo('cables', 'Cables:', 'estado'),
          campo('cubierta_silicona', 'Cubierta de silicona:', 'estado'),
          campo('entorno', 'Entorno:', 'opciones', { opciones: OPCIONES_INSTALACION.entorno }),
        ],
        [
          campo('nivelacion', 'Nivelación:', 'opciones', { opciones: ['Bueno', 'Regular', 'Malo', 'Irregular', 'No aplica'] }),
          campo('movilizacion', 'Movilización:', 'opciones', { opciones: OPCIONES_INSTALACION.movilizacion }),
          campo('flujo_pesas', 'Flujo de pesadas:', 'opciones', { opciones: OPCIONES_INSTALACION.flujo_pesadas }),
        ],
      ],
    },
    observaciones(),
    adicionales([
      campo('p_min_neto', 'Pesada Mínima:', 'numero', { unidad: true }),
      campo('p_max_bruto', 'Pesada Maxima:', 'numero', { unidad: true }),
      campo('recomendaciones', 'Tipo de servicio sugerido:', 'recomendacion'),
    ]),
    tecnico('Técnico Responsable:'),
  ],
};

export const PLANTILLAS = { MPR, MPA, MCR, DIG, INT, IBM, VFI, RVD };

/** Tipos de servicio en el orden de la lista, con su nombre corto. */
export const TIPOS_SERVICIO = [
  { value: 'MPR', label: 'Mantenimiento preventivo regular', corto: 'Preventivo regular' },
  { value: 'MPA', label: 'Mantenimiento preventivo avanzado', corto: 'Preventivo avanzado' },
  { value: 'MCR', label: 'Mantenimiento correctivo', corto: 'Correctivo' },
  { value: 'DIG', label: 'Diagnóstico', corto: 'Diagnóstico' },
  { value: 'INT', label: 'Instalación', corto: 'Instalación' },
  { value: 'IBM', label: 'Verificación con IBMETRO', corto: 'Verificación IBMETRO' },
  { value: 'VFI', label: 'Verificaciones internas', corto: 'Verificación interna' },
  { value: 'RVD', label: 'Relevamiento de datos', corto: 'Relevamiento' },
];

export const tipoServicio = (tipo) => TIPOS_SERVICIO.find(item => item.value === tipo) || { value: tipo, label: tipo, corto: tipo };

export { OPCIONES_AJUSTE, OPCIONES_RECOMENDACION };

// ─── Formulario de edición ─────────────────────────────────────────────────

/** Último índice (1..max) con datos en una tabla de pruebas; 0 si no hay. */
const ultimaConDatos = (seccion, valores, columnasPresentes) => {
  const nombres = [seccion.indicacion, seccion.carga].filter(fn => typeof fn === 'function');
  let ultima = 0;
  for (let i = 1; i <= seccion.max; i += 1) {
    const existe = !columnasPresentes || nombres.some(fn => columnasPresentes.has(fn(i)));
    if (!existe) break;
    if (nombres.some(fn => {
      const valor = valores[fn(i)];
      return valor !== null && valor !== undefined && valor !== '';
    })) ultima = i;
  }
  return ultima;
};

/**
 * Filas que imprime el informe: solo las que tienen datos (al menos una,
 * con «-»), para no llenar hojas de filas vacías.
 */
export function filasConDatos(seccion, valores, columnasPresentes = null) {
  return Math.max(1, ultimaConDatos(seccion, valores, columnasPresentes));
}

/** Indices 1..n que muestra el formulario: los de la plantilla y los que traen datos. */
export function filasVisibles(seccion, valores, columnasPresentes = null) {
  return Math.max(seccion.filas, ultimaConDatos(seccion, valores, columnasPresentes));
}

const camposDeChecklist = (bloque) => bloque.items.flatMap(it => [
  { campo: it.estado, label: `${it.label.replace(/:$/, '')} · estado`, tipo: it.tipoEstado || 'estado', opciones: it.opcionesEstado },
  { campo: it.ajuste, label: `${it.label.replace(/:$/, '')} · ajuste`, tipo: it.tipoAjuste || 'ajuste' },
]);

const camposDePruebas = (esquema, titulo) => {
  const prefijo = titulo.replace(/:$/, '');
  const lista = [
    { campo: esquema.plataforma?.tipo, label: `${prefijo} · forma de la plataforma`, tipo: 'opciones' },
    { campo: esquema.plataforma?.puntos, label: `${prefijo} · posiciones e indicador`, tipo: 'opciones' },
    { campo: esquema.exc.carga, label: `${prefijo} · carga de excentricidad`, tipo: 'numero' },
    { campo: esquema.rep.carga, label: `${prefijo} · carga de repetibilidad`, tipo: 'numero' },
    { campo: esquema.retorno, label: `${prefijo} · retorno a cero`, tipo: 'estado' },
    { campo: esquema.estabilidad, label: `${prefijo} · estabilidad`, tipo: 'estado' },
  ];
  for (let i = 1; i <= esquema.exc.max; i += 1) {
    lista.push({ campo: esquema.exc.indicacion(i), label: `${prefijo} · excentricidad, posición ${i}`, tipo: 'numero' });
  }
  for (let i = 1; i <= esquema.rep.max; i += 1) {
    lista.push({ campo: esquema.rep.indicacion(i), label: `${prefijo} · repetibilidad, lectura ${i}`, tipo: 'numero' });
  }
  for (let i = 1; i <= esquema.lin.max; i += 1) {
    lista.push({ campo: esquema.lin.carga(i), label: `${prefijo} · linealidad, carga ${i}`, tipo: 'numero' });
    lista.push({ campo: esquema.lin.indicacion(i), label: `${prefijo} · linealidad, indicación ${i}`, tipo: 'numero' });
  }
  return lista.filter(item => item.campo);
};

const CAMPOS_RANGOS = [1, 2, 3].flatMap(i => [
  { campo: `cap_max${i}`, label: `Capacidad máxima (rango ${i})`, tipo: 'numero' },
  { campo: `d${i}`, label: `Resolución d (rango ${i})`, tipo: 'numero' },
  { campo: `e${i}`, label: `Escala de verificación e (rango ${i})`, tipo: 'numero' },
]).concat([{ campo: 'unidades', label: 'Unidades', tipo: 'texto' }]);

/**
 * Secciones del formulario: una por bloque editable del informe, con sus
 * campos. Las pruebas del preventivo avanzado, repartidas en varios bloques
 * del informe, se editan en una sola sección.
 */
export function seccionesEditor(plantilla) {
  const secciones = [];
  for (const bloque of plantilla.bloques) {
    if (bloque.editor === null) continue;
    const editor = bloque.editor || bloque;
    const titulo = (editor.titulo || bloque.titulo || '').replace(/:$/, '');
    switch (editor.tipo) {
      case 'datos':
        secciones.push({ id: bloque.id, tipo: 'campos', titulo, campos: editor.filas.flat() });
        break;
      case 'rangos':
        secciones.push({ id: bloque.id, tipo: 'rangos', titulo, filas: editor.filas, campos: CAMPOS_RANGOS });
        break;
      case 'texto':
        secciones.push({ id: bloque.id, tipo: 'campos', titulo, campos: [{ campo: editor.campo, label: titulo, tipo: 'parrafo' }] });
        break;
      case 'checklist':
        secciones.push({ id: bloque.id, tipo: 'checklist', titulo, items: editor.items, campos: camposDeChecklist(editor) });
        break;
      case 'checklist3':
        secciones.push({ id: bloque.id, tipo: 'campos', titulo, campos: editor.columnas.flat(), compacto: true });
        break;
      case 'pruebas':
        secciones.push({
          id: bloque.id,
          tipo: 'pruebas',
          titulo,
          esquema: editor.esquema,
          division: editor.division || 'd',
          campos: camposDePruebas(editor.esquema, titulo),
        });
        break;
      case 'adicionales':
        secciones.push({ id: bloque.id, tipo: 'campos', titulo, campos: editor.campos });
        break;
      case 'conclusion':
        secciones.push({ id: bloque.id, tipo: 'campos', titulo, campos: [...editor.campos, ...(editor.extras || [])] });
        break;
      case 'tecnico':
        secciones.push({
          id: bloque.id,
          tipo: 'campos',
          titulo: editor.etiqueta.replace(/:$/, ''),
          campos: [{ campo: editor.campo, label: editor.etiqueta.replace(/:$/, ''), tipo: 'tecnico' }],
        });
        break;
      default:
        break;
    }
  }
  return secciones;
}

/** Nombre legible de cada campo, para el historial. */
export function etiquetasCampos(plantilla) {
  const etiquetas = new Map();
  for (const seccion of seccionesEditor(plantilla)) {
    for (const definicion of seccion.campos || []) {
      if (!etiquetas.has(definicion.campo)) {
        etiquetas.set(definicion.campo, definicion.label?.replace(/:$/, '') || definicion.campo);
      }
    }
  }
  return etiquetas;
}
