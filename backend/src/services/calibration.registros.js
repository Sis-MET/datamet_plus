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
 * editarlo). Revisa solo el jefe de Calibración y nunca quien lo envió.
 */
const { createHash } = require('node:crypto');
const { getPool, sql } = require('../config/db');
const { actorName, clean, httpError, normalizeArea, withTransaction } = require('./calibration.db');
const { PROTEGIDAS, coercer, iguales, leerDatos, mapColumna, normalizarFuente } = require('./soporte.columnas');
const { tieneAcceso } = require('./access.areas');
const { cargarContexto, filaVigente } = require('./calibration.servicios');
const { modeloDeFila } = require('./calibration.fuente');
const { calcularModelo } = require('./calibration.calculo');

const TABLA_FUENTE = 'DATA_SERVICIOS_DATOS_CALIBRACION';
const EDITABLES_EN = new Set(['BORRADOR', 'OBSERVADO']);
const CLASES = ['I', 'II', 'III', 'IIII'];
const ORIGENES_CLASE = { PLACA: 'Placa', APROBACION: 'Aprobación de modelo', CLIENTE: 'Pedida por el cliente' };

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

/** Datos del registro con su forma: { columnas, clase }. */
const datosDe = (json) => {
  const datos = leerDatos(json);
  return {
    columnas: datos.columnas && typeof datos.columnas === 'object' ? datos.columnas : {},
    clase: datos.clase && CLASES.includes(datos.clase.valor) ? datos.clase : null,
  };
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
  if (nueva && !ORIGENES_CLASE[nueva.origen]) throw httpError(400, 'Indica de dónde sale la clase: placa, aprobación de modelo o pedida por el cliente.');
  const texto = c => (c ? `${c.valor} (${ORIGENES_CLASE[c.origen]})` : null);
  if (texto(actual) === texto(nueva)) return { clase: actual, cambio: null };
  return { clase: nueva, cambio: { campo: 'clase', antes: texto(actual), despues: texto(nueva) } };
};

const esJefeCalibracion = ({ area, cargo } = {}) => normalizeArea(area) === 'calibracion'
  && normalizeArea(cargo).replace(/\s+/g, ' ') === 'jefe de area';

/** Qué puede hacer el usuario con el registro en su estado actual. */
const permisosDe = ({ usuario, jefe, editor }, registro) => {
  const estado = registro?.estado || 'PENDIENTE';
  const editable = !registro || EDITABLES_EN.has(estado);
  const envio = registro?.enviado_por ? clean(registro.enviado_por) : null;
  const mismo = Boolean(envio && usuario && envio.toLowerCase() === usuario.toLowerCase());
  return {
    editar: editor && editable,
    enviar: editor && editable,
    retirar: estado === 'EN_REVISION' && (mismo || jefe),
    revisar: estado === 'EN_REVISION' && jefe && !mismo,
    reabrir: estado === 'APROBADO' && jefe,
    motivoRevisar: estado === 'EN_REVISION' && jefe && mismo ? 'Lo enviaste tú: debe revisarlo otra persona.' : null,
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
        CONVERT(varchar(19), revisado_en, 126) AS revisado_en, observacion, configuracion
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
  return { modelo, avisos };
};

const quien = async (user) => ({
  usuario: actorName(user),
  jefe: esJefeCalibracion(user),
  editor: await tieneAcceso(user, 'calibracion'),
});

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
} : null);

// ─── Operaciones ───────────────────────────────────────────────────────────

/** El registro de un servicio: sus correcciones, el modelo corregido, el cálculo y el historial. */
const getRegistro = async (codigo, user) => {
  const [fila, columnas, registro, persona] = await Promise.all([
    filaVigente(codigo), columnasCalibracion(), leerRegistro(() => getPool().request(), codigo), quien(user),
  ]);
  const fuente = normalizarFuente(fila, columnas);
  const datos = datosDe(registro?.datos);
  const { modelo, avisos } = await modeloCorregido(fila, datos);
  const calculo = await calcularModelo(modelo);
  const editables = Object.fromEntries([...columnas.entries()].filter(([c, meta]) => esEditable(c, meta)).map(([c, meta]) => [c, meta]));
  const huellaActual = huellaDe({ fuente, datos });
  return {
    codigo,
    estado: registro?.estado || 'PENDIENTE',
    registro: metaRegistro(registro),
    cambioDesdeEnvio: Boolean(registro?.huella && ['EN_REVISION'].includes(registro.estado) && registro.huella !== huellaActual),
    datos,
    correcciones: Object.entries(datos.columnas).map(([columna, valor]) => ({ columna, original: fuente[columna] ?? null, corregido: valor })),
    fuente: Object.fromEntries(Object.keys(editables).map(c => [c, fuente[c] ?? null])),
    columnas: editables,
    origenesClase: ORIGENES_CLASE,
    modelo,
    avisos,
    calculo,
    versiones: fila.versiones,
    historial: registro ? await leerHistorial(registro.id) : [],
    permisos: permisosDe(persona, registro),
  };
};

/** Guarda correcciones y la clase. Solo en borrador u observado. */
const guardarRegistro = async (codigo, data, user) => {
  const persona = await quien(user);
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
    const cambios = [...correcciones.cambios, ...(clase.cambio ? [clase.cambio] : [])];
    if (!cambios.length) return { codigo, cambios: 0, version: registro?.version ?? null };

    if (!registro) registro = await crearRegistro(createRequest, codigo, user);
    const datos = { columnas: correcciones.columnas, clase: clase.clase };
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
  const persona = await quien(user);
  if (!persona.editor) throw httpError(403, 'Solo el personal de Calibración envía los registros a revisión.');
  const columnas = await columnasCalibracion();
  return withTransaction(async (createRequest) => {
    const fila = await filaVigente(codigo, createRequest);
    let registro = await leerRegistro(createRequest, codigo, { lock: true });
    if (registro && !EDITABLES_EN.has(registro.estado)) throw httpError(409, 'El registro ya está en revisión o aprobado.');
    const datos = datosDe(registro?.datos);
    const { modelo } = await modeloCorregido(fila, datos);
    const calculo = await calcularModelo(modelo);
    if (!calculo.calculado) {
      const motivo = calculo.avisos.find(a => a.nivel === 'error')?.mensaje || 'No hay puntos calculados.';
      throw httpError(409, `No se puede enviar a revisión: ${motivo}`);
    }
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

/** Retira de revisión: lo puede hacer quien lo envió o el jefe. */
const retirarRegistro = async (codigo, user) => {
  const persona = await quien(user);
  return withTransaction(async (createRequest) => {
    const registro = await leerRegistro(createRequest, codigo, { lock: true });
    if (!registro || !permisosDe(persona, registro).retirar) {
      throw httpError(registro?.estado === 'EN_REVISION' ? 403 : 409, registro?.estado === 'EN_REVISION'
        ? 'Solo quien lo envió o el jefe de Calibración pueden retirarlo.'
        : 'El registro no está en revisión.');
    }
    await createRequest().input('id', sql.Int, registro.id)
      .query("UPDATE dbo.CAL_REGISTROS SET estado = 'BORRADOR', version = version + 1 WHERE id = @id");
    await historial(createRequest, registro.id, 'RETIRO', { detalle: 'Retirado de revisión' }, user);
    return { codigo, estado: 'BORRADOR' };
  });
};

/**
 * Revisión del jefe de Calibración: aprobar (exige que los datos no hayan
 * cambiado desde el envío y un cálculo completo, no provisional; guarda el
 * resultado) u observar (con la observación).
 */
const revisarRegistro = async (codigo, { decision, observacion }, user) => {
  const persona = await quien(user);
  const columnas = await columnasCalibracion();
  return withTransaction(async (createRequest) => {
    const fila = await filaVigente(codigo, createRequest);
    const registro = await leerRegistro(createRequest, codigo, { lock: true });
    if (!registro || registro.estado !== 'EN_REVISION') throw httpError(409, 'El registro no está en revisión.');
    const permisos = permisosDe(persona, registro);
    if (!persona.jefe) throw httpError(403, 'Solo el jefe de Calibración revisa los registros.');
    if (!permisos.revisar) throw httpError(403, permisos.motivoRevisar || 'No puedes revisar este registro.');
    const datos = datosDe(registro.datos);
    if (huellaDe({ fuente: normalizarFuente(fila, columnas), datos }) !== registro.huella) {
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
    const calculo = await calcularModelo(modelo);
    if (!calculo.calculado) throw httpError(409, 'No se puede aprobar: el registro no se puede calcular.');
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
  const persona = await quien(user);
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
  CLASES,
  ORIGENES_CLASE,
  enviarRegistro,
  esEditable,
  getRegistro,
  guardarRegistro,
  huellaDe,
  permisosDe,
  planClase,
  planCorrecciones,
  reabrirRegistro,
  retirarRegistro,
  revisarRegistro,
};
