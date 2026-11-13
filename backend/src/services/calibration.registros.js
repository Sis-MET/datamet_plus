/**
 * Registros de calibración de balanzas (fase 4, migración 018).
 *
 * Un registro por servicio de ServiceMET. La fila original no se toca
 * (NB/ISO/IEC 17025, 7.5): las correcciones van por columna en `datos`, con la
 * clase del instrumento y su origen; la fila corregida pasa por el mismo
 * adaptador (calibration.fuente.js) y el mismo motor. Cada guardado queda en
 * el historial con su valor anterior y nuevo (7.5.2).
 *
 * BORRADOR → EN_REVISION → APROBADO, u OBSERVADO (vuelve al borrador al
 * editarlo). Revisa el jefe de Calibración o un aprobador que él designó
 * (migración 019), nunca quien lo envió.
 */
const { createHash } = require('node:crypto');
const { getPool, sql } = require('../config/db');
const { actorName, clean, httpError, withTransaction } = require('./calibration.db');
const { PROTEGIDAS, coercer, iguales, leerDatos, mapColumna, normalizarFuente } = require('./soporte.columnas');
const { personaCalibracion } = require('./calibration.aprobadores');
const { cargarContexto, filaVigente } = require('./calibration.servicios');
const { modeloDeFila } = require('./calibration.fuente');
const { calcularModelo } = require('./calibration.calculo');
const { MG_POR } = require('./calibracion/motor/cargas');

const TABLA_FUENTE = 'DATA_SERVICIOS_DATOS_CALIBRACION';
const EDITABLES_EN = new Set(['BORRADOR', 'OBSERVADO']);
const CLASES = ['I', 'II', 'III', 'IIII'];
const ORIGENES_CLASE = {
  PLACA: 'Placa',
  APROBACION: 'Aprobación de modelo',
  CLIENTE: 'Pedida por el cliente',
  // Sin placa ni aprobación: la que sugiere la OIML R76 (Tabla 3) con e y n = Max/e, confirmada por el ingeniero.
  DEDUCIDA: 'Deducida de Max/e (OIML R76)',
};
const MAX_TOLERANCIAS = 5;

// Columnas que tampoco se corrigen aquí: identidad del servicio y del cliente
// (vienen de DATA_CLIENTES) y estados de ServiceMET. En calibración «hora» y
// «hora_fin» son las de las condiciones ambientales: sí se corrigen.
const PROTEGIDAS_CALIBRACION = new Set([
  ...[...PROTEGIDAS].filter(columna => !['hora_inicio', 'hora_fin'].includes(columna)),
  'seca', 'cliente', 'razon_social', 'planta', 'dep_planta', 'dir_planta', 'estado_balanza',
  'estado_servicio_bal', 'directorio_zip', 'rango',
]);

// ServiceMET guarda como enteras mediciones que pueden tener decimales.
const MEDICIONES_EN_ENTERO = new Set(['carga', 'repetibilidad1', 'repetibilidad2', 'repetibilidad3']);

const esEditable = (columna, meta) => Boolean(meta)
  && !PROTEGIDAS_CALIBRACION.has(columna)
  && !columna.endsWith('_foto')
  && !['fechahora', 'otro'].includes(meta.tipo);

// ─── Columnas ──────────────────────────────────────────────────────────────

let cacheColumnas = null;

/** Columnas de la tabla de ServiceMET con su tipo; se leen una vez por proceso. */
const columnasCalibracion = async () => {
  if (cacheColumnas) return cacheColumnas;
  const result = await getPool().request()
    .input('tabla', sql.NVarChar(128), TABLA_FUENTE)
    .query(`SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @tabla ORDER BY ORDINAL_POSITION`);
  cacheColumnas = new Map(result.recordset.map((row) => {
    const meta = mapColumna(row);
    return [row.COLUMN_NAME, MEDICIONES_EN_ENTERO.has(row.COLUMN_NAME) ? { ...meta, tipo: 'decimal' } : meta];
  }));
  return cacheColumnas;
};

// ─── Reglas puras ──────────────────────────────────────────────────────────

const ordenar = (valor) => {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.keys(valor).sort().map(k => [k, ordenar(valor[k])]));
  return valor;
};

/** Huella de lo enviado a revisión: la fila de ServiceMET y las correcciones. */
const huellaDe = ({ fuente, datos }) => createHash('sha256').update(JSON.stringify(ordenar({ fuente, datos }))).digest('hex');

/**
 * ¿La huella guardada corresponde a estos datos? También con la forma que
 * tenían los datos antes de agregar campos nuevos (USP ⟨41⟩, tolerancias por
 * rango) si siguen vacíos: un registro enviado antes no cambió por eso.
 */
const coincideHuella = ({ fuente, datos }, huella) => {
  if (!huella) return false;
  const { usp, tolerancias, ...antes } = datos;
  const formas = [datos];
  if (!usp) formas.push({ ...antes, tolerancias });
  if (!usp && !(tolerancias || []).length) formas.push(antes);
  return formas.some(forma => huellaDe({ fuente, datos: forma }) === huella);
};

const esComposicion = ([n, claves]) => /^\d{1,2}$/.test(n) && Array.isArray(claves) && claves.length > 0
  && claves.every(c => typeof c === 'string');

/** Datos del registro con su forma: { columnas, clase, composiciones }. */
const datosDe = (json) => {
  const datos = leerDatos(json);
  return {
    columnas: datos.columnas && typeof datos.columnas === 'object' ? datos.columnas : {},
    clase: datos.clase && CLASES.includes(datos.clase.valor) ? datos.clase : null,
    // Cargas armadas a mano: n.º de punto → claves de las piezas («juego|nominal en mg|marca»).
    composiciones: datos.composiciones && typeof datos.composiciones === 'object'
      ? Object.fromEntries(Object.entries(datos.composiciones).filter(esComposicion))
      : {},
    // Anexo de información adicional (incertidumbre en uso, pesada mínima), a pedido del cliente.
    anexo: datos.anexo === true,
    // Evaluación USP ⟨41⟩ dentro del anexo (clientes farmacéuticos).
    usp: datos.usp === true,
    // Tolerancia absoluta del cliente por rango de carga (dato del cliente): [{ hasta, tolerancia }].
    tolerancias: Array.isArray(datos.tolerancias)
      ? datos.tolerancias.filter(t => t && Number(t.tolerancia) > 0 && (t.hasta == null || Number(t.hasta) > 0))
      : [],
  };
};

const textoTolerancias = (tramos, unidad) => (tramos.length
  ? tramos.map(t => `${t.hasta == null ? 'en adelante' : `hasta ${numeroComa(t.hasta)} ${unidad}`}: ± ${numeroComa(t.tolerancia)} ${t.en === 'D' ? 'd' : unidad}`).join('; ')
  : null);

/**
 * Tolerancias del cliente por rango: sin cambio si no llegan; null o [] las
 * quita. Ordenadas por «hasta»; solo la última puede no tenerlo (en adelante).
 * Cada una en la unidad de la balanza o, con en: 'D', en divisiones (1 d).
 */
const planTolerancias = (actuales, entrantes, unidad) => {
  if (entrantes === undefined) return { tolerancias: actuales, cambio: null };
  const lista = (entrantes || []).map(t => ({
    hasta: t.hasta == null ? null : Number(t.hasta),
    tolerancia: Number(t.tolerancia),
    ...(t.en === 'D' ? { en: 'D' } : {}),
  }));
  if (lista.length > MAX_TOLERANCIAS) throw httpError(400, `Admite hasta ${MAX_TOLERANCIAS} rangos de tolerancia.`);
  if (lista.some(t => !(t.tolerancia > 0) || (t.hasta != null && !(t.hasta > 0)))) {
    throw httpError(400, 'Cada rango necesita su tolerancia (mayor que cero) y, salvo el último, su límite «hasta».');
  }
  const ordenadas = [...lista].sort((a, b) => (a.hasta ?? Infinity) - (b.hasta ?? Infinity));
  if (ordenadas.slice(0, -1).some(t => t.hasta == null)) throw httpError(400, 'Solo el último rango puede quedar sin límite («en adelante»).');
  if (ordenadas.some((t, i) => i > 0 && t.hasta != null && t.hasta === ordenadas[i - 1].hasta)) throw httpError(400, 'Dos rangos tienen el mismo límite «hasta».');
  const antes = textoTolerancias(actuales || [], unidad);
  const despues = textoTolerancias(ordenadas, unidad);
  if (antes === despues) return { tolerancias: actuales, cambio: null };
  return { tolerancias: ordenadas, cambio: { campo: 'tolerancias', antes, despues } };
};

/**
 * Si el cliente pidió el emp NB 23001, la clase tiene que estar en el
 * registro (de la placa, la aprobación, el cliente o confirmada la sugerida):
 * sin ella no se envía ni se aprueba. null si está bien.
 */
const faltaClase = (modelo, datos, calculo) => {
  if (modelo.criterio.empNB23001 !== true || datos.clase) return null;
  const sugerida = calculo?.clase?.sugerida?.valor;
  return `Confirma la clase del instrumento en «Cliente e instrumento»: el cliente pidió el emp NB 23001${sugerida ? ` y se sugiere la clase ${sugerida}` : ''}.`;
};

/** Un pedido sí/no del registro (anexo, USP ⟨41⟩): sin cambio si no llega. */
const planBandera = campo => (actual, entrante) => {
  if (entrante === undefined || Boolean(entrante) === Boolean(actual)) return { [campo]: Boolean(actual), cambio: null };
  return { [campo]: Boolean(entrante), cambio: { campo, antes: actual ? 'Sí' : 'No', despues: entrante ? 'Sí' : 'No' } };
};
/** Pedido del anexo de información adicional. */
const planAnexo = planBandera('anexo');
/** Pedido de la evaluación USP ⟨41⟩ en el anexo. */
const planUsp = planBandera('usp');

const numeroComa = (valor) => String(Number(valor.toPrecision(10))).replace('.', ',');

/** Composición legible para el historial: «E2-005: 2 + 1 + 1* kg». */
const textoComposicion = (claves, unidad) => {
  if (!claves || !claves.length) return null;
  const mgPor = MG_POR[unidad] || 1;
  const juegos = new Map();
  for (const clave of claves) {
    const [juego, nominalMg, marca] = String(clave).split('|');
    if (!juegos.has(juego)) juegos.set(juego, []);
    juegos.get(juego).push(`${numeroComa(Number(nominalMg) / mgPor)}${marca || ''}`);
  }
  return [...juegos].map(([juego, piezas]) => `${juego}: ${piezas.join(' + ')}`).join(' · ') + (MG_POR[unidad] ? ` ${unidad}` : ' mg');
};

/**
 * Composiciones elegidas a mano que llegan sobre las del registro. null o una
 * lista vacía vuelve a la regla automática. Devuelve las nuevas y los cambios.
 */
const planComposiciones = (actuales, entrantes, unidad) => {
  if (!entrantes) return { composiciones: actuales, cambios: [] };
  const nuevas = { ...actuales };
  const cambios = [];
  for (const [n, claves] of Object.entries(entrantes)) {
    if (!/^\d{1,2}$/.test(n) || Number(n) < 1 || Number(n) > 60) throw httpError(400, `El punto ${n} no existe.`);
    const antes = actuales[n] || null;
    const despues = claves && claves.length ? [...claves] : null;
    if (despues && new Set(despues).size !== despues.length) throw httpError(400, `El punto ${n} repite una pieza.`);
    if (despues) nuevas[n] = despues;
    else delete nuevas[n];
    const [textoAntes, textoDespues] = [textoComposicion(antes, unidad), textoComposicion(despues, unidad)];
    if (textoAntes !== textoDespues) cambios.push({ campo: `composicion${n}`, antes: textoAntes || 'Regla automática', despues: textoDespues || 'Regla automática' });
  }
  const orden = Object.keys(nuevas).sort((a, b) => Number(a) - Number(b));
  return { composiciones: Object.fromEntries(orden.map(n => [n, nuevas[n]])), cambios };
};

/**
 * Aplica las correcciones que llegan sobre las del registro. Una columna que
 * vuelve a su valor de ServiceMET deja de estar corregida. Devuelve las
 * columnas nuevas y los cambios reales (antes → después).
 */
const planCorrecciones = ({ fuente, columnas, actuales, entrantes }) => {
  const nuevas = { ...actuales };
  const cambios = [];
  for (const [columna, valor] of Object.entries(entrantes)) {
    const meta = columnas.get(columna);
    if (!esEditable(columna, meta)) throw httpError(400, `La columna «${columna}» no se puede corregir.`);
    const despues = coercer(columna, meta, valor);
    const antes = Object.prototype.hasOwnProperty.call(actuales, columna) ? actuales[columna] : (fuente[columna] ?? null);
    if (iguales(despues, fuente[columna] ?? null)) delete nuevas[columna];
    else nuevas[columna] = despues;
    if (!iguales(antes, despues)) cambios.push({ campo: columna, antes, despues });
  }
  return { columnas: Object.fromEntries(Object.keys(nuevas).sort().map(c => [c, nuevas[c]])), cambios };
};

/** Cambio de la clase del instrumento (valor y origen). */
const planClase = (actual, entrante) => {
  if (entrante === undefined) return { clase: actual, cambio: null };
  const nueva = entrante && entrante.valor ? { valor: entrante.valor, origen: entrante.origen } : null;
  if (nueva && !CLASES.includes(nueva.valor)) throw httpError(400, 'La clase debe ser I, II, III o IIII.');
  if (nueva && !ORIGENES_CLASE[nueva.origen]) throw httpError(400, 'Indica de dónde sale la clase: placa, aprobación de modelo, pedida por el cliente o deducida de Max/e.');
  const texto = c => (c ? `${c.valor} (${ORIGENES_CLASE[c.origen]})` : null);
  if (texto(actual) === texto(nueva)) return { clase: actual, cambio: null };
  return { clase: nueva, cambio: { campo: 'clase', antes: texto(actual), despues: texto(nueva) } };
};

/**
 * Qué puede hacer el usuario con el registro en su estado actual. revisor: el
 * jefe o un aprobador designado; reabrir uno aprobado queda para el jefe, que
 * también autoriza, firma y abre las revisiones del certificado (fase 5).
 */
const permisosDe = ({ usuario, jefe, revisor = jefe, editor }, registro) => {
  const estado = registro?.estado || 'PENDIENTE';
  const editable = !registro || EDITABLES_EN.has(estado);
  const envio = registro?.enviado_por ? clean(registro.enviado_por) : null;
  const mismo = Boolean(envio && usuario && envio.toLowerCase() === usuario.toLowerCase());
  return {
    editar: editor && editable,
    enviar: editor && editable,
    retirar: estado === 'EN_REVISION' && (mismo || revisor),
    revisar: estado === 'EN_REVISION' && revisor && !mismo,
    reabrir: estado === 'APROBADO' && jefe,
    autorizar: estado === 'APROBADO' && jefe,
    anularAutorizacion: estado === 'AUTORIZADO' && jefe,
    subirFirmado: estado === 'AUTORIZADO' && jefe,
    abrirRevision: estado === 'EMITIDO' && jefe,
    motivoRevisar: estado === 'EN_REVISION' && revisor && mismo ? 'Lo enviaste tú: debe revisarlo otra persona.' : null,
  };
};

// ─── Acceso a datos ────────────────────────────────────────────────────────

const leerRegistro = async (createRequest, codigo, { lock = false } = {}) => {
  const result = await createRequest()
    .input('codigo', sql.NVarChar(100), codigo)
    .query(`SELECT id, codigo_registro, datos, estado, huella, version, creado_por,
        CONVERT(varchar(19), creado_en, 126) AS creado_en, actualizado_por,
        CONVERT(varchar(19), actualizado_en, 126) AS actualizado_en, enviado_por,
        CONVERT(varchar(19), enviado_en, 126) AS enviado_en, revisado_por,
        CONVERT(varchar(19), revisado_en, 126) AS revisado_en, observacion, configuracion, revision_motivo
      FROM dbo.CAL_REGISTROS ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE codigo_registro = @codigo`);
  return result.recordset[0] || null;
};

const leerHistorial = async (registroId) => {
  const result = await getPool().request().input('id', sql.Int, registroId).query(`
    SELECT TOP 100 id, accion, detalle, motivo, cambios, usuario, usuario_nombre,
      CONVERT(varchar(19), fecha, 126) AS fecha
    FROM dbo.CAL_REGISTROS_HISTORIAL WHERE registro_id = @id ORDER BY fecha DESC, id DESC`);
  return result.recordset.map(row => ({
    id: row.id,
    accion: row.accion,
    detalle: clean(row.detalle),
    motivo: clean(row.motivo),
    cambios: row.cambios ? JSON.parse(row.cambios) : [],
    usuario: clean(row.usuario_nombre) || clean(row.usuario),
    fecha: `${row.fecha}Z`,
  }));
};

const historial = (createRequest, registroId, accion, { detalle = null, motivo = null, cambios = null } = {}, actor) => createRequest()
  .input('id', sql.Int, registroId)
  .input('accion', sql.VarChar(20), accion)
  .input('detalle', sql.NVarChar(400), detalle ? String(detalle).slice(0, 400) : null)
  .input('motivo', sql.NVarChar(500), motivo)
  .input('cambios', sql.NVarChar(sql.MAX), cambios && cambios.length ? JSON.stringify(cambios) : null)
  .input('usuario', sql.NVarChar(50), actorName(actor))
  .input('nombre', sql.NVarChar(120), [actor?.nombre1, actor?.apellido1].map(clean).filter(Boolean).join(' ') || null)
  .query(`INSERT INTO dbo.CAL_REGISTROS_HISTORIAL (registro_id, accion, detalle, motivo, cambios, usuario, usuario_nombre)
    VALUES (@id, @accion, @detalle, @motivo, @cambios, @usuario, @nombre)`);

const crearRegistro = async (createRequest, codigo, actor) => {
  const result = await createRequest()
    .input('codigo', sql.NVarChar(100), codigo)
    .input('usuario', sql.NVarChar(50), actorName(actor))
    .query(`INSERT INTO dbo.CAL_REGISTROS (codigo_registro, creado_por) OUTPUT INSERTED.id
      VALUES (@codigo, @usuario)`);
  const id = result.recordset[0].id;
  await historial(createRequest, id, 'CREACION', { detalle: 'Registro creado' }, actor);
  return leerRegistro(createRequest, codigo, { lock: true });
};

/** Modelo del servicio con las correcciones del registro aplicadas. */
const modeloCorregido = async (fila, datos) => {
  const contexto = await cargarContexto();
  const { modelo, avisos } = modeloDeFila({ ...fila, ...datos.columnas }, contexto);
  if (datos.clase) modelo.instrumento.clase = { valor: datos.clase.valor, origen: datos.clase.origen };
  modelo.criterio.toleranciasRango = datos.tolerancias || [];
  return { modelo, avisos };
};

const metaRegistro = (registro) => (registro ? {
  id: registro.id,
  estado: registro.estado,
  version: registro.version,
  creadoPor: clean(registro.creado_por),
  creadoEn: registro.creado_en ? `${registro.creado_en}Z` : null,
  actualizadoPor: clean(registro.actualizado_por),
  actualizadoEn: registro.actualizado_en ? `${registro.actualizado_en}Z` : null,
  enviadoPor: clean(registro.enviado_por),
  enviadoEn: registro.enviado_en ? `${registro.enviado_en}Z` : null,
  revisadoPor: clean(registro.revisado_por),
  revisadoEn: registro.revisado_en ? `${registro.revisado_en}Z` : null,
  observacion: clean(registro.observacion),
  configuracion: registro.configuracion,
  revisionMotivo: clean(registro.revision_motivo),
} : null);

// ─── Operaciones ───────────────────────────────────────────────────────────

/** Emisiones del certificado (calibration.emision, que carga este módulo: diferido). */
const emisionesDe = async (registroId) => {
  const { leerEmisiones, publica } = require('./calibration.emision');
  return (await leerEmisiones(() => getPool().request(), registroId)).map(publica);
};

// Desde la aprobación el registro conserva la versión del método con la que se
// calculó; antes, se calcula con la vigente (fase 6).
const CONSERVAN_METODO = new Set(['APROBADO', 'AUTORIZADO', 'EMITIDO']);
const versionDe = registro => (registro && CONSERVAN_METODO.has(registro.estado) && registro.configuracion != null
  ? Number(registro.configuracion) : null);

/** El registro de un servicio: sus correcciones, el modelo corregido, el cálculo y el historial. */
const getRegistro = async (codigo, user) => {
  const [fila, columnas, registro, persona] = await Promise.all([
    filaVigente(codigo), columnasCalibracion(), leerRegistro(() => getPool().request(), codigo), personaCalibracion(user),
  ]);
  const fuente = normalizarFuente(fila, columnas);
  const datos = datosDe(registro?.datos);
  const { modelo, avisos } = await modeloCorregido(fila, datos);
  const calculo = await calcularModelo(modelo, datos, { version: versionDe(registro) });
  const editables = Object.fromEntries([...columnas.entries()].filter(([c, meta]) => esEditable(c, meta)).map(([c, meta]) => [c, meta]));
  const emisiones = registro ? await emisionesDe(registro.id) : [];
  return {
    codigo,
    estado: registro?.estado || 'PENDIENTE',
    registro: metaRegistro(registro),
    cambioDesdeEnvio: Boolean(registro?.huella && ['EN_REVISION'].includes(registro.estado) && !coincideHuella({ fuente, datos }, registro.huella)),
    datos,
    correcciones: [
      ...Object.entries(datos.columnas).map(([columna, valor]) => ({ tipo: 'columna', columna, original: fuente[columna] ?? null, corregido: valor })),
      ...Object.entries(datos.composiciones).map(([n, claves]) => ({
        tipo: 'composicion', n: Number(n), columna: `composicion${n}`, original: 'Regla automática', corregido: textoComposicion(claves, modelo.instrumento.unidad),
      })),
    ],
    fuente: Object.fromEntries(Object.keys(editables).map(c => [c, fuente[c] ?? null])),
    columnas: editables,
    origenesClase: ORIGENES_CLASE,
    modelo,
    avisos,
    calculo,
    versiones: fila.versiones,
    historial: registro ? await leerHistorial(registro.id) : [],
    // Emisiones del certificado (fase 5).
    emisiones,
    // N.º del certificado: el de la última emisión o el que llevará.
    certificado: {
      numero: emisiones.at(-1)?.numero
        || require('./calibration.certificado').numeroDelRegistro({ modelo, creadoEn: registro?.creado_en ? `${registro.creado_en}Z` : null }),
      emision: emisiones.at(-1)?.emision ?? null,
    },
    permisos: permisosDe(persona, registro),
  };
};

/** Guarda correcciones y la clase. Solo en borrador u observado. */
const guardarRegistro = async (codigo, data, user) => {
  const persona = await personaCalibracion(user);
  if (!persona.editor) throw httpError(403, 'Solo el personal de Calibración elabora los registros.');
  const columnas = await columnasCalibracion();
  return withTransaction(async (createRequest) => {
    const fila = await filaVigente(codigo, createRequest);
    let registro = await leerRegistro(createRequest, codigo, { lock: true });
    if (registro && data.version != null && data.version !== registro.version) {
      throw httpError(409, `${clean(registro.actualizado_por) || 'Otra persona'} cambió este registro mientras lo editabas. Vuelve a abrirlo.`);
    }
    if (registro && !EDITABLES_EN.has(registro.estado)) {
      throw httpError(409, registro.estado === 'EN_REVISION'
        ? 'El registro está en revisión: retíralo antes de corregirlo.'
        : 'El registro está aprobado: el jefe de Calibración debe reabrirlo para corregirlo.');
    }
    const fuente = normalizarFuente(fila, columnas);
    const actuales = datosDe(registro?.datos);
    const correcciones = planCorrecciones({ fuente, columnas, actuales: actuales.columnas, entrantes: data.columnas || {} });
    const clase = planClase(actuales.clase, data.clase);
    const unidad = String(correcciones.columnas.unidades ?? fuente.unidades ?? '').trim();
    const composiciones = planComposiciones(actuales.composiciones, data.composiciones, unidad);
    const anexo = planAnexo(actuales.anexo, data.anexo);
    const usp = planUsp(actuales.usp, data.usp);
    const tolerancias = planTolerancias(actuales.tolerancias, data.tolerancias, unidad);
    const cambios = [
      ...correcciones.cambios, ...(clase.cambio ? [clase.cambio] : []), ...composiciones.cambios,
      ...(anexo.cambio ? [anexo.cambio] : []), ...(usp.cambio ? [usp.cambio] : []), ...(tolerancias.cambio ? [tolerancias.cambio] : []),
    ];
    if (!cambios.length) return { codigo, cambios: 0, version: registro?.version ?? null };

    if (!registro) registro = await crearRegistro(createRequest, codigo, user);
    const datos = {
      columnas: correcciones.columnas, clase: clase.clase, composiciones: composiciones.composiciones,
      anexo: anexo.anexo, usp: usp.usp, tolerancias: tolerancias.tolerancias,
    };
    await createRequest()
      .input('id', sql.Int, registro.id)
      .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos))
      .input('usuario', sql.NVarChar(50), actorName(user))
      .query(`UPDATE dbo.CAL_REGISTROS SET datos = @datos, estado = 'BORRADOR', version = version + 1,
          actualizado_por = @usuario, actualizado_en = SYSUTCDATETIME()
        WHERE id = @id`);
    await historial(createRequest, registro.id, 'EDICION', {
      detalle: `${cambios.length} ${cambios.length === 1 ? 'corrección' : 'correcciones'}`,
      motivo: clean(data.motivo),
      cambios,
    }, user);
    return { codigo, cambios: cambios.length, version: registro.version + 1 };
  });
};

/** Envía a revisión: guarda la huella de lo enviado. Exige que se pueda calcular. */
const enviarRegistro = async (codigo, user) => {
  const persona = await personaCalibracion(user);
  if (!persona.editor) throw httpError(403, 'Solo el personal de Calibración envía los registros a revisión.');
  const columnas = await columnasCalibracion();
  return withTransaction(async (createRequest) => {
    const fila = await filaVigente(codigo, createRequest);
    let registro = await leerRegistro(createRequest, codigo, { lock: true });
    if (registro && !EDITABLES_EN.has(registro.estado)) throw httpError(409, 'El registro ya está en revisión o aprobado.');
    const datos = datosDe(registro?.datos);
    const { modelo } = await modeloCorregido(fila, datos);
    const calculo = await calcularModelo(modelo, datos);
    if (!calculo.calculado) {
      const motivo = calculo.avisos.find(a => a.nivel === 'error')?.mensaje || 'No hay puntos calculados.';
      throw httpError(409, `No se puede enviar a revisión: ${motivo}`);
    }
    const sinClase = faltaClase(modelo, datos, calculo);
    if (sinClase) throw httpError(409, `No se puede enviar a revisión. ${sinClase}`);
    if (!registro) registro = await crearRegistro(createRequest, codigo, user);
    const huella = huellaDe({ fuente: normalizarFuente(fila, columnas), datos });
    await createRequest()
      .input('id', sql.Int, registro.id)
      .input('huella', sql.VarChar(64), huella)
      .input('usuario', sql.NVarChar(50), actorName(user))
      .query(`UPDATE dbo.CAL_REGISTROS SET estado = 'EN_REVISION', huella = @huella, enviado_por = @usuario,
          enviado_en = SYSUTCDATETIME(), revisado_por = NULL, revisado_en = NULL, observacion = NULL, version = version + 1
        WHERE id = @id`);
    await historial(createRequest, registro.id, 'ENVIO', {
      detalle: calculo.provisional ? 'Enviado con cálculo provisional' : 'Enviado a revisión',
    }, user);
    return { codigo, estado: 'EN_REVISION' };
  });
};

/** Retira de revisión: lo puede hacer quien lo envió o quien revisa. */
const retirarRegistro = async (codigo, user) => {
  const persona = await personaCalibracion(user);
  return withTransaction(async (createRequest) => {
    const registro = await leerRegistro(createRequest, codigo, { lock: true });
    if (!registro || !permisosDe(persona, registro).retirar) {
      throw httpError(registro?.estado === 'EN_REVISION' ? 403 : 409, registro?.estado === 'EN_REVISION'
        ? 'Solo quien lo envió o quien revisa pueden retirarlo.'
        : 'El registro no está en revisión.');
    }
    await createRequest().input('id', sql.Int, registro.id)
      .query("UPDATE dbo.CAL_REGISTROS SET estado = 'BORRADOR', version = version + 1 WHERE id = @id");
    await historial(createRequest, registro.id, 'RETIRO', { detalle: 'Retirado de revisión' }, user);
    return { codigo, estado: 'BORRADOR' };
  });
};

/**
 * Revisión del jefe de Calibración o de un aprobador designado: aprobar (exige que los datos no hayan
 * cambiado desde el envío y un cálculo completo, no provisional; guarda el
 * resultado) u observar (con la observación).
 */
const revisarRegistro = async (codigo, { decision, observacion }, user) => {
  const persona = await personaCalibracion(user);
  const columnas = await columnasCalibracion();
  return withTransaction(async (createRequest) => {
    const fila = await filaVigente(codigo, createRequest);
    const registro = await leerRegistro(createRequest, codigo, { lock: true });
    if (!registro || registro.estado !== 'EN_REVISION') throw httpError(409, 'El registro no está en revisión.');
    const permisos = permisosDe(persona, registro);
    if (!persona.revisor) throw httpError(403, 'Solo el jefe de Calibración o un aprobador que él designó revisan los registros.');
    if (!permisos.revisar) throw httpError(403, permisos.motivoRevisar || 'No puedes revisar este registro.');
    const datos = datosDe(registro.datos);
    if (!coincideHuella({ fuente: normalizarFuente(fila, columnas), datos }, registro.huella)) {
      throw httpError(409, 'Los datos cambiaron desde el envío (en ServiceMET o en las correcciones). Retíralo y vuelve a enviarlo.');
    }

    if (decision === 'OBSERVAR') {
      await createRequest()
        .input('id', sql.Int, registro.id)
        .input('usuario', sql.NVarChar(50), actorName(user))
        .input('obs', sql.NVarChar(500), observacion)
        .query(`UPDATE dbo.CAL_REGISTROS SET estado = 'OBSERVADO', revisado_por = @usuario, revisado_en = SYSUTCDATETIME(),
            observacion = @obs, version = version + 1 WHERE id = @id`);
      await historial(createRequest, registro.id, 'OBSERVACION', { detalle: 'Observado', motivo: observacion }, user);
      return { codigo, estado: 'OBSERVADO' };
    }

    const { modelo } = await modeloCorregido(fila, datos);
    const calculo = await calcularModelo(modelo, datos);
    if (!calculo.calculado) throw httpError(409, 'No se puede aprobar: el registro no se puede calcular.');
    const sinClase = faltaClase(modelo, datos, calculo);
    if (sinClase) throw httpError(409, `No se puede aprobar. ${sinClase}`);
    if (calculo.provisional) {
      const razon = calculo.avisos.find(a => ['PESAS_SIN_VALORES', 'PESAS_SIN_VERIFICAR', 'PIEZAS_SUPUESTAS', 'THB_SIN_VALORES'].includes(a.codigo));
      throw httpError(409, `No se puede aprobar un cálculo provisional: ${razon?.mensaje || 'faltan datos verificados de los patrones.'}`);
    }
    await createRequest()
      .input('id', sql.Int, registro.id)
      .input('usuario', sql.NVarChar(50), actorName(user))
      .input('obs', sql.NVarChar(500), observacion || null)
      .input('config', sql.Int, calculo.configuracion)
      .input('resultado', sql.NVarChar(sql.MAX), JSON.stringify(calculo))
      .query(`UPDATE dbo.CAL_REGISTROS SET estado = 'APROBADO', revisado_por = @usuario, revisado_en = SYSUTCDATETIME(),
          observacion = @obs, configuracion = @config, resultado = @resultado, version = version + 1 WHERE id = @id`);
    await historial(createRequest, registro.id, 'APROBACION', { detalle: 'Aprobado', motivo: observacion || null }, user);
    return { codigo, estado: 'APROBADO' };
  });
};

/** El jefe reabre un registro aprobado (antes de emitir el certificado), con motivo. */
const reabrirRegistro = async (codigo, { motivo }, user) => {
  const persona = await personaCalibracion(user);
  if (!persona.jefe) throw httpError(403, 'Solo el jefe de Calibración reabre un registro aprobado.');
  return withTransaction(async (createRequest) => {
    const registro = await leerRegistro(createRequest, codigo, { lock: true });
    if (!registro || registro.estado !== 'APROBADO') throw httpError(409, 'El registro no está aprobado.');
    await createRequest().input('id', sql.Int, registro.id)
      .query("UPDATE dbo.CAL_REGISTROS SET estado = 'BORRADOR', version = version + 1 WHERE id = @id");
    await historial(createRequest, registro.id, 'REAPERTURA', { detalle: 'Reabierto', motivo }, user);
    return { codigo, estado: 'BORRADOR' };
  });
};

module.exports = {
  // Para la emisión del certificado (calibration.emision.js).
  calcularModelo,
  columnasCalibracion,
  datosDe,
  filaVigente,
  historial,
  leerRegistro,
  modeloCorregido,
  normalizarFuente,
  CLASES,
  ORIGENES_CLASE,
  enviarRegistro,
  esEditable,
  getRegistro,
  guardarRegistro,
  huellaDe,
  coincideHuella,
  permisosDe,
  planAnexo,
  planUsp,
  planTolerancias,
  faltaClase,
  planComposiciones,
  textoComposicion,
  planClase,
  planCorrecciones,
  reabrirRegistro,
  retirarRegistro,
  revisarRegistro,
  versionDe,
};
