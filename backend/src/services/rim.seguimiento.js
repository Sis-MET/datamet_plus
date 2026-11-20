/**
 * Ejecución (6.2) y entrega (6.3) de un RIM: reglas y armado de la ficha.
 *
 * El RIM emitido no se modifica (NB/ISO/IEC 17025, 7.5.2). Cada etapa se
 * registra en su tabla (`form_rim_ejecucion`, `form_rim_entregas`, script 016
 * de ServiceMET) como una fila nueva que apunta a la vigente; la vigente es la
 * última de la cadena. Aquí no se consulta la base: estas funciones deciden
 * qué tipo de fila corresponde, validan las fechas y arman el historial.
 */

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/**
 * Campos de la ejecución, en el orden del formulario: columna y largo máximo
 * en SQL Server (`fecha`: columna date).
 */
const CAMPOS_EJECUCION = [
  { campo: 'recepcionSt', columna: 'recepcion_st', etiqueta: 'Recibió en S.T.', max: 150 },
  { campo: 'fechaIngreso', columna: 'fecha_ingreso', etiqueta: 'La fecha de ingreso a S.T.', fecha: true },
  { campo: 'tecnicoAsignado', columna: 'tecnico_asignado', etiqueta: 'Técnico asignado', max: 150 },
  { campo: 'fechaInicio', columna: 'fecha_inicio', etiqueta: 'La fecha de inicio', fecha: true },
  { campo: 'fechaInforme', columna: 'fecha_informe', etiqueta: 'La fecha de informe', fecha: true },
  { campo: 'fechaConclusion', columna: 'fecha_conclusion', etiqueta: 'La fecha de conclusión', fecha: true },
  { campo: 'nroCotizacion', columna: 'nro_cotizacion', etiqueta: 'N.º de cotización', max: 60 },
  { campo: 'nroInforme', columna: 'nro_informe', etiqueta: 'N.º de informe', max: 60 },
  { campo: 'nroFactura', columna: 'nro_factura', etiqueta: 'N.º de factura', max: 60 },
];

/**
 * Datos de la entrega que pueden corregirse (las firmas no). El estado del
 * equipo al salir es del script 019 de ServiceMET: las entregas anteriores no
 * lo tienen.
 */
const CAMPOS_ENTREGA = [
  { campo: 'recibeNombre', columna: 'recibe_nombre', etiqueta: 'Recibió (cliente)', max: 150 },
  { campo: 'entregaPor', columna: 'entrega_por', etiqueta: 'Entregó (Métrica)', max: 150 },
  { campo: 'fechaEntrega', columna: 'fecha_entrega', etiqueta: 'La fecha de entrega', fecha: true },
  { campo: 'lugarEntrega', columna: 'lugar_entrega', etiqueta: 'Lugar de entrega', max: 255 },
  { campo: 'estadoSalida', columna: 'estado_salida', etiqueta: 'Estado del equipo al salir', max: 30 },
  { campo: 'observaciones', columna: 'observaciones', etiqueta: 'Observaciones', max: 1000 },
];

const TIPOS_EJECUCION = { registro: 'Registro', avance: 'Avance', correccion: 'Corrección' };
const TIPOS_ENTREGA = { registro: 'Registro', correccion: 'Corrección', anulacion: 'Anulación' };

const ETIQUETAS_ETAPA = {
  recibido: 'Recibido',
  en_ejecucion: 'En ejecución',
  concluido: 'Concluido',
  entregado: 'Entregado',
};

/** Fecha «2026-10-19» del calendario de La Paz (UTC−4 todo el año). */
const hoyLaPaz = (now = new Date()) => new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

const valor = (value) => (value === undefined || value === '' ? null : value);

const datosDe = (campos, objeto) => Object.fromEntries(campos.map(({ campo }) => [campo, valor(objeto?.[campo])]));

/** Datos de una fila de SQL Server (columnas) con los nombres de la API. */
const datosDeFila = (campos, row) => Object.fromEntries(campos.map(({ campo, columna }) => [campo, valor(row?.[columna])]));

const tieneDatos = (datos) => Boolean(datos) && Object.values(datos).some(value => value !== null);

/** Campos que cambian de una versión a otra: [{ campo, antes, despues }]. */
const cambiosEntre = (campos, antes, despues) => campos
  .filter(({ campo }) => valor(antes?.[campo]) !== valor(despues?.[campo]))
  .map(({ campo }) => ({ campo, antes: valor(antes?.[campo]), despues: valor(despues?.[campo]) }));

/**
 * Tipo de la versión nueva de la ejecución según lo que cambia respecto de
 * la vigente: registro (la primera), avance (solo completa campos vacíos) o
 * corrección (cambia o borra un dato ya registrado). null si no cambia nada.
 */
const tipoEjecucion = (vigente, nueva) => {
  const cambios = cambiosEntre(CAMPOS_EJECUCION, vigente, nueva);
  if (!cambios.length) return { tipo: null, cambios };
  if (!vigente) return { tipo: 'registro', cambios };
  return { tipo: cambios.some(cambio => cambio.antes !== null) ? 'correccion' : 'avance', cambios };
};

const formatoFecha = (fecha) => fecha.split('-').reverse().join('/');

/**
 * Fechas coherentes con el RIM: ninguna futura ni anterior a la emisión
 * (fecha de La Paz); el inicio no antes del ingreso; el informe y la
 * conclusión no antes del inicio. Devuelve el primer problema o null.
 */
const problemaFechasEjecucion = (datos, { emitido, hoy }) => {
  for (const { campo, etiqueta, fecha } of CAMPOS_EJECUCION) {
    if (!fecha || !datos[campo]) continue;
    if (datos[campo] > hoy) return `${etiqueta} no puede ser futura.`;
    if (emitido && datos[campo] < emitido) {
      return `${etiqueta} no puede ser anterior a la emisión del RIM (${formatoFecha(emitido)}).`;
    }
  }
  const { fechaIngreso, fechaInicio, fechaInforme, fechaConclusion } = datos;
  if (fechaIngreso && fechaInicio && fechaInicio < fechaIngreso) {
    return 'La fecha de inicio no puede ser anterior al ingreso a S.T.';
  }
  if (fechaInicio && fechaInforme && fechaInforme < fechaInicio) {
    return 'La fecha de informe no puede ser anterior a la fecha de inicio.';
  }
  if (fechaInicio && fechaConclusion && fechaConclusion < fechaInicio) {
    return 'La fecha de conclusión no puede ser anterior a la fecha de inicio.';
  }
  return null;
};

const problemaFechaEntrega = (fechaEntrega, { emitido, hoy }) => {
  if (fechaEntrega > hoy) return 'La fecha de entrega no puede ser futura.';
  if (emitido && fechaEntrega < emitido) {
    return `La fecha de entrega no puede ser anterior a la emisión del RIM (${formatoFecha(emitido)}).`;
  }
  return null;
};

/** La fila vigente de una cadena: la única que ninguna otra reemplaza. */
const vigenteDe = (rows) => {
  const reemplazadas = new Set(rows.map(row => row.anterior_id).filter(id => id !== null && id !== undefined));
  return rows.find(row => !reemplazadas.has(row.id)) || null;
};

/** Quién registró una fila y cuándo (hora del servidor, La Paz). */
const registroDe = (row) => ({
  registradoEn: row.fecha_reg_texto ? `${row.fecha_reg_texto}-04:00` : null,
  usuario: row.usuario,
  usuarioNombre: row.usuario_nombre || null,
});

/**
 * Decide la fila de ejecución que se agrega. Lanza 400 (sin cambios, sin
 * motivo, fechas), 403 (corrección sin permiso) o 409 (la vigente cambió).
 */
const planEjecucion = ({ filas, nueva, emitido, hoy, puedeCorregir }) => {
  const vigenteRow = vigenteDe(filas);
  if ((vigenteRow?.id ?? null) !== nueva.anteriorId) {
    throw httpError(409, 'Otro usuario actualizó la ejecución mientras la editabas. Recarga la ficha y vuelve a intentarlo.');
  }
  const vigente = vigenteRow ? datosDeFila(CAMPOS_EJECUCION, vigenteRow) : null;
  const datos = datosDe(CAMPOS_EJECUCION, nueva);
  const { tipo, cambios } = tipoEjecucion(vigente, datos);
  if (!tipo) throw httpError(400, vigente ? 'No hay cambios para guardar.' : 'Completa al menos un dato de la ejecución.');
  if (tipo === 'correccion') {
    if (!puedeCorregir) {
      throw httpError(403, 'Solo los jefes de área y los niveles 2 y 3 pueden corregir un dato ya registrado. Puedes completar los campos vacíos.');
    }
    if (!nueva.motivo || nueva.motivo.length < 10) {
      throw httpError(400, 'Escribe el motivo de la corrección (al menos 10 caracteres).');
    }
  }
  const problema = problemaFechasEjecucion(datos, { emitido, hoy });
  if (problema) throw httpError(400, problema);
  return {
    tipo,
    anteriorId: vigenteRow?.id ?? null,
    motivo: tipo === 'correccion' ? nueva.motivo : null,
    datos,
    cambios,
  };
};

/**
 * Decide la fila de entrega que se agrega: registro (la primera, o después de
 * anular la anterior), corrección o anulación de la vigente.
 */
const planEntrega = ({ filas, entrada, emitido, hoy, puedeCorregir }) => {
  const ultima = filas.length ? vigenteDe(filas) : null;
  if ((ultima?.id ?? null) !== entrada.anteriorId) {
    throw httpError(409, 'Otro usuario actualizó la entrega mientras la editabas. Recarga la ficha y vuelve a intentarlo.');
  }
  const hayVigente = Boolean(ultima) && ultima.tipo !== 'anulacion';

  if (entrada.accion === 'registro') {
    if (hayVigente) throw httpError(409, 'La entrega ya está registrada. Para cambiar un dato, corrígela.');
  } else {
    if (!hayVigente) throw httpError(409, 'No hay una entrega vigente para corregir o anular.');
    if (!puedeCorregir) {
      throw httpError(403, 'Solo los jefes de área y los niveles 2 y 3 pueden corregir o anular una entrega.');
    }
  }

  if (entrada.accion === 'anulacion') {
    return { tipo: 'anulacion', anteriorId: ultima.id, motivo: entrada.motivo, datos: null, cambios: [] };
  }

  const datos = datosDe(CAMPOS_ENTREGA, entrada);
  const problema = problemaFechaEntrega(datos.fechaEntrega, { emitido, hoy });
  if (problema) throw httpError(400, problema);

  if (entrada.accion === 'correccion') {
    const cambios = cambiosEntre(CAMPOS_ENTREGA, datosDeFila(CAMPOS_ENTREGA, ultima), datos);
    if (!cambios.length) throw httpError(400, 'No hay cambios para guardar.');
    return { tipo: 'correccion', anteriorId: ultima.id, motivo: entrada.motivo, datos, cambios };
  }
  return {
    tipo: 'registro',
    anteriorId: ultima?.id ?? null,
    motivo: null,
    datos,
    cambios: [],
    firmas: { cliente: entrada.firmaCliente, representante: entrada.firmaRepresentante },
  };
};

/** Ejecución vigente e historial (del más reciente al más antiguo). */
const mapEjecucion = (filas) => {
  const ordenadas = [...filas].sort((a, b) => a.id - b.id);
  const historial = ordenadas.map((row, index) => {
    const anterior = index > 0 ? datosDeFila(CAMPOS_EJECUCION, ordenadas[index - 1]) : null;
    return {
      id: row.id,
      tipo: row.tipo,
      tipoLabel: TIPOS_EJECUCION[row.tipo] || row.tipo,
      motivo: row.motivo || null,
      ...registroDe(row),
      cambios: cambiosEntre(CAMPOS_EJECUCION, anterior, datosDeFila(CAMPOS_EJECUCION, row)),
    };
  }).reverse();
  const vigenteRow = vigenteDe(ordenadas);
  return {
    vigente: vigenteRow ? {
      id: vigenteRow.id,
      tipo: vigenteRow.tipo,
      datos: datosDeFila(CAMPOS_EJECUCION, vigenteRow),
      ...registroDe(vigenteRow),
    } : null,
    historial,
  };
};

const dataUrlPng = (bytes) => (bytes ? `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` : null);

/**
 * Entrega vigente (null si no hay o si la última fue anulada), id de la última
 * fila (la que reemplaza la próxima) e historial.
 */
const mapEntrega = (filas) => {
  const ordenadas = [...filas].sort((a, b) => a.id - b.id);
  const historial = ordenadas.map((row, index) => {
    const previa = index > 0 ? ordenadas[index - 1] : null;
    return {
      id: row.id,
      tipo: row.tipo,
      tipoLabel: TIPOS_ENTREGA[row.tipo] || row.tipo,
      motivo: row.motivo || null,
      ...registroDe(row),
      datos: row.tipo === 'anulacion' ? null : datosDeFila(CAMPOS_ENTREGA, row),
      cambios: row.tipo === 'correccion'
        ? cambiosEntre(CAMPOS_ENTREGA, datosDeFila(CAMPOS_ENTREGA, previa), datosDeFila(CAMPOS_ENTREGA, row))
        : [],
    };
  }).reverse();
  const ultima = vigenteDe(ordenadas);
  const vigente = ultima && ultima.tipo !== 'anulacion' ? {
    id: ultima.id,
    tipo: ultima.tipo,
    datos: datosDeFila(CAMPOS_ENTREGA, ultima),
    firmas: { cliente: dataUrlPng(ultima.firma_cliente), representante: dataUrlPng(ultima.firma_representante) },
    ...registroDe(ultima),
  } : null;
  return { vigente, ultimaId: ultima?.id ?? null, historial };
};

/** Etapa alcanzada: entregado, concluido, en ejecución o recibido. */
const etapaDe = ({ ejecucion, entrega }) => {
  if (entrega?.vigente) return 'entregado';
  if (ejecucion?.vigente?.datos?.fechaConclusion) return 'concluido';
  if (tieneDatos(ejecucion?.vigente?.datos)) return 'en_ejecucion';
  return 'recibido';
};

/**
 * Seguimiento completo para la ficha. Registran y completan todos los
 * usuarios con sesión; corrigen y anulan los jefes de área y los niveles 2
 * y 3. En un RIM anulado no se registra nada nuevo.
 */
const mapSeguimiento = ({ ejecucion: filasEjecucion, entregas: filasEntrega }, { anulado, puedeCorregir }) => {
  const ejecucion = mapEjecucion(filasEjecucion);
  const entrega = mapEntrega(filasEntrega);
  const etapa = etapaDe({ ejecucion, entrega });
  const datos = ejecucion.vigente?.datos;
  const hayVacios = !datos || Object.values(datos).some(value => value === null);
  const abierto = !anulado;
  return {
    disponible: true,
    mensaje: null,
    etapa,
    etapaLabel: ETIQUETAS_ETAPA[etapa],
    ejecucion,
    entrega,
    acciones: {
      registrarEjecucion: abierto && !ejecucion.vigente,
      completarEjecucion: abierto && Boolean(ejecucion.vigente) && (hayVacios || puedeCorregir),
      corregirEjecucion: abierto && Boolean(ejecucion.vigente) && puedeCorregir,
      registrarEntrega: abierto && !entrega.vigente,
      corregirEntrega: abierto && Boolean(entrega.vigente) && puedeCorregir,
      anularEntrega: abierto && Boolean(entrega.vigente) && puedeCorregir,
    },
  };
};

/** Ficha sin seguimiento: falta el script 016 o el permiso. */
const seguimientoNoDisponible = (mensaje) => ({
  disponible: false,
  mensaje,
  etapa: null,
  etapaLabel: null,
  ejecucion: { vigente: null, historial: [] },
  entrega: { vigente: null, ultimaId: null, historial: [] },
  acciones: {
    registrarEjecucion: false,
    completarEjecucion: false,
    corregirEjecucion: false,
    registrarEntrega: false,
    corregirEntrega: false,
    anularEntrega: false,
  },
});

module.exports = {
  CAMPOS_ENTREGA,
  CAMPOS_EJECUCION,
  ETIQUETAS_ETAPA,
  cambiosEntre,
  etapaDe,
  hoyLaPaz,
  mapEjecucion,
  mapEntrega,
  mapSeguimiento,
  planEjecucion,
  planEntrega,
  problemaFechaEntrega,
  problemaFechasEjecucion,
  seguimientoNoDisponible,
  tipoEjecucion,
  vigenteDe,
};
