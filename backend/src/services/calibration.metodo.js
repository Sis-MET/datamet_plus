/**
 * Configuración del método de calibración de balanzas (fase 6, migración 021).
 *
 * Los parámetros, tablas y textos del certificado que el laboratorio ajusta
 * sin tocar las fórmulas. Cada cambio es una versión nueva: se redacta como
 * borrador y la aprueba el jefe de Calibración; quien hizo el último cambio
 * no la aprueba. Rige la versión vigente: los registros que aún no se
 * aprueban se calculan con ella; los aprobados, autorizados y emitidos
 * conservan la versión con la que se aprobaron (CAL_REGISTROS.configuracion).
 * Ninguna versión se borra (8.4): las descartadas y las reemplazadas quedan
 * con su historial.
 *
 * La versión 1 es la configuración inicial del sistema (fase 0): se crea la
 * primera vez que se abre la pantalla y el jefe la aprueba ahí. Las reglas de
 * cálculo (s de repetibilidad, factor de cobertura, redondeo de U, fórmula
 * del aire, excentricidad, banda de guarda, riesgo asociado, decimales del
 * error y de U, formato de k, emp en servicio, clase sugerida, USP ⟨41⟩,
 * aptitud de las pesas patrón) se eligen aquí entre opciones ya programadas y probadas, con sus
 * valores; las fórmulas quedan en el código, validadas con los ejemplos de
 * las guías (7.11.2). Una regla nueva entra a las versiones guardadas antes
 * con el valor que reproduce el cálculo de entonces.
 */
const { z } = require('zod');
const { getPool, sql } = require('../config/db');
const { actorName, clean, httpError, withTransaction } = require('./calibration.db');
const { ultimoAutor } = require('./calibration.history');
const { personaCalibracion } = require('./calibration.aprobadores');
const motor = require('./calibracion/motor');
const { TEXTOS } = require('./calibration.certificado');

const CLASES_PESAS = ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'];
const SISTEMA = 'SISTEMA';

// ─── Contenido de una versión ──────────────────────────────────────────────

/** Contenido de la versión 1: la configuración inicial del sistema (fase 0). */
const contenidoInicial = () => {
  const c = motor.CONFIGURACION_V1;
  return structuredClone({
    parametros: {
      repetibilidad: c.repetibilidad,
      cobertura: c.cobertura,
      redondeoU: c.redondeoU,
      aire: c.aire,
      excentricidad: c.excentricidad,
      conformidad: c.conformidad,
      presentacion: c.presentacion,
      empServicio: c.empServicio,
      claseSugerida: c.claseSugerida,
      empuje: c.empuje,
      kD: c.kD,
      conveccion: {
        activa: c.conveccion.activa,
        clases: c.conveccion.clases,
        porEstabilizacion: Object.entries(c.conveccion.deltaTPorEstabilizacion).map(([texto, deltaT]) => ({ texto, deltaT })),
        deltaTSinDato: c.conveccion.deltaTSinDato,
      },
      avisos: c.avisos,
      enUso: c.enUso,
      pesadaMinima: c.pesadaMinima,
      usp: c.usp,
      densidades: c.densidades,
      pesas: c.pesas,
    },
    textos: TEXTOS,
  });
};

const numero = (min, max) => z.number({ error: 'Debe ser un número.' })
  .finite('Debe ser un número.').min(min, `Debe ser al menos ${min}.`).max(max, `Debe ser como máximo ${max}.`);
const texto = max => z.string({ error: 'Falta el texto.' }).trim().min(1, 'No puede quedar vacío.').max(max, `Admite hasta ${max} caracteres.`);
// Listas de números: sin repetidos y de menor a mayor.
const serie = (min, max, largo) => z.array(numero(min, max)).min(1, 'Hace falta al menos un valor.').max(largo, `Admite hasta ${largo} valores.`)
  .transform(lista => [...new Set(lista)].sort((a, b) => a - b));

const opcion = (lista, mensaje) => z.enum(lista, { error: mensaje });

const esquema = z.object({
  parametros: z.object({
    repetibilidad: z.object({ regla: opcion(motor.REGLAS_REPETIBILIDAD, 'Elige la regla de la s de repetibilidad.') }).strict(),
    cobertura: z.object({
      metodo: opcion(motor.METODOS_COBERTURA, 'Elige cómo se calcula k.'),
      probabilidad: numero(0.9, 0.999),
      k: numero(1, 4),
    }).strict(),
    redondeoU: z.object({
      cifras: z.number({ error: 'Debe ser un número.' }).int('Debe ser 1, 2 o 3.').min(1, 'Debe ser 1, 2 o 3.').max(3, 'Debe ser 1, 2 o 3.'),
      sentido: opcion(motor.SENTIDOS_REDONDEO, 'Elige hacia arriba o al más cercano.'),
    }).strict(),
    aire: z.object({ formula: opcion(Object.keys(motor.FORMULAS_AIRE), 'Elige la fórmula de la densidad del aire.') }).strict(),
    excentricidad: z.object({ metodo: opcion(motor.METODOS_EXCENTRICIDAD, 'Elige el método 1 o el 3.') }).strict(),
    conformidad: z.object({
      bandaGuarda: numero(0, 3),
      riesgoUmbral: numero(0.001, 0.5),
      riesgo: opcion(motor.METODOS_RIESGO, 'Elige cómo se calcula el riesgo asociado.'),
    }).strict(),
    presentacion: z.object({
      decimales: opcion(motor.DECIMALES_RESULTADO, 'Elige con cuántos decimales se escriben el error y la U.'),
      k: opcion(motor.FORMATOS_K, 'Elige cómo se escribe el factor de cobertura.'),
    }).strict(),
    empServicio: z.object({ factor: numero(1, 3) }).strict(),
    claseSugerida: z.object({ regla: opcion(motor.REGLAS_CLASE, 'Elige la regla de la clase sugerida.') }).strict(),
    empuje: z.enum(['5a', '5b'], { error: 'Elige 7.1.2-5a o 7.1.2-5b.' }),
    kD: numero(1, 3),
    conveccion: z.object({
      activa: z.boolean({ error: 'Indica si se aplica.' }),
      clases: z.array(z.enum(CLASES_PESAS, { error: 'Elige clases de la OIML R111.' })).max(CLASES_PESAS.length).transform(lista => CLASES_PESAS.filter(c => lista.includes(c))),
      porEstabilizacion: z.array(z.object({ texto: texto(60), deltaT: numero(0, 20) }).strict()).max(10, 'Admite hasta 10 filas.'),
      deltaTSinDato: numero(0, 20),
    }).strict(),
    avisos: z.object({ excentricidadEnD: numero(0.1, 100), lecturaVsCargaEnD: numero(0.1, 100), uEnD: numero(0.1, 100) }).strict(),
    enUso: z.object({
      k: numero(1, 3),
      deltaT: numero(0, 50),
      kT: numero(0, 0.001).nullable(),
      factorKT: numero(1, 10),
      fracciones: serie(0.001, 1, 12),
    }).strict(),
    pesadaMinima: z.object({ exactitudes: serie(0.0001, 0.5, 10), factores: serie(1, 20, 10) }).strict(),
    usp: z.object({
      tolerancia: numero(0.0001, 0.05),
      cargaEvaluacion: numero(0.001, 1),
      sMinimaEnD: numero(0, 2),
      factorS: numero(1, 4),
      divisorPesas: numero(1, 10),
    }).strict(),
    densidades: z.array(z.object({
      material: texto(60),
      claves: z.array(texto(40)).min(1, 'Hace falta al menos una palabra clave.').max(10, 'Admite hasta 10 palabras clave.'),
      rho: numero(500, 25000),
      u: numero(0, 2000),
    }).strict()).min(1, 'Hace falta al menos un material.').max(30, 'Admite hasta 30 materiales.'),
    pesas: z.object({ aptitud: opcion(motor.CRITERIOS_APTITUD_PESAS, 'Elige el criterio de aptitud de las pesas patrón.') }).strict(),
  }).strict(),
  textos: z.object({
    metodo: texto(1000),
    fechaEmision: texto(300),
    alcanceNota: texto(300),
    leyenda: z.array(texto(1500)).min(1, 'Hace falta al menos un párrafo.').max(4, 'Admite hasta 4 párrafos.'),
    pruebasConExcentricidad: texto(600),
    pruebasSinExcentricidad: texto(600),
    pruebas: z.array(texto(600)).max(8, 'Admite hasta 8 frases.'),
    sustitucion: texto(600),
    incertidumbre: texto(1500),
    repetibilidad: texto(300),
    reglas: z.object({ SIMPLE: texto(1500), CONSERVADORA: texto(1500), NINGUNA: texto(300) }).strict(),
    datosCliente: texto(600),
  }).strict(),
}).strict();

/** Valida el contenido de una versión; el error dice dónde está el problema. */
const validarContenido = (contenido) => {
  const resultado = esquema.safeParse(contenido);
  if (resultado.success) return resultado.data;
  const issue = resultado.error.issues[0];
  const donde = issue?.path?.length ? ` (${issue.path.join('.')})` : '';
  throw httpError(400, `Configuración no válida${donde}: ${issue?.message || 'datos inválidos.'}`);
};

/**
 * Completa un contenido guardado con lo que agregue el código después (claves
 * nuevas con su valor inicial); lo guardado manda. Los arreglos no se mezclan.
 */
const completar = (guardado, inicial = contenidoInicial()) => {
  if (Array.isArray(inicial) || inicial === null || typeof inicial !== 'object') return guardado === undefined ? inicial : guardado;
  if (guardado === null || typeof guardado !== 'object' || Array.isArray(guardado)) return inicial;
  const salida = { ...guardado };
  for (const [clave, valor] of Object.entries(inicial)) salida[clave] = completar(guardado[clave], valor);
  return salida;
};

const sinAcentos = valor => String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

/** La configuración que recibe el motor a partir del contenido de una versión. */
const configuracionMotor = (version, contenido) => {
  const p = contenido.parametros;
  return {
    version,
    repetibilidad: { ...p.repetibilidad },
    cobertura: { ...p.cobertura },
    redondeoU: { ...p.redondeoU },
    aire: { ...p.aire },
    excentricidad: { ...p.excentricidad },
    conformidad: { ...p.conformidad },
    presentacion: { ...p.presentacion },
    empServicio: { ...p.empServicio },
    claseSugerida: { ...p.claseSugerida },
    empuje: p.empuje,
    kD: p.kD,
    conveccion: {
      activa: p.conveccion.activa,
      clases: [...p.conveccion.clases],
      // Como lo compara el cálculo: sin tildes y en mayúsculas.
      deltaTPorEstabilizacion: Object.fromEntries(p.conveccion.porEstabilizacion.map(f => [sinAcentos(f.texto), f.deltaT])),
      deltaTSinDato: p.conveccion.deltaTSinDato,
    },
    avisos: { ...p.avisos },
    enUso: { ...p.enUso, fracciones: [...p.enUso.fracciones] },
    pesadaMinima: { exactitudes: [...p.pesadaMinima.exactitudes], factores: [...p.pesadaMinima.factores] },
    usp: { ...p.usp },
    densidades: p.densidades.map(d => ({ ...d, claves: [...d.claves] })),
    pesas: { ...p.pesas },
  };
};

/** Rutas con su valor (a.b[0].c), para comparar dos versiones. */
const aplanar = (valor, ruta = '', salida = {}) => {
  if (Array.isArray(valor)) {
    if (!valor.length) salida[ruta] = [];
    valor.forEach((v, i) => aplanar(v, `${ruta}[${i}]`, salida));
  } else if (valor && typeof valor === 'object') {
    Object.entries(valor).forEach(([clave, v]) => aplanar(v, ruta ? `${ruta}.${clave}` : clave, salida));
  } else {
    salida[ruta] = valor;
  }
  return salida;
};

/** Diferencias entre dos contenidos: [{ ruta, antes, despues }]. */
const diferencias = (antes, despues) => {
  const a = aplanar(antes || {});
  const d = aplanar(despues || {});
  return [...new Set([...Object.keys(a), ...Object.keys(d)])]
    .filter(ruta => JSON.stringify(a[ruta]) !== JSON.stringify(d[ruta]))
    .map(ruta => ({ ruta, antes: a[ruta] ?? null, despues: d[ruta] ?? null }));
};

// ─── Base de datos ─────────────────────────────────────────────────────────

const sinTabla = err => err?.number === 208 || /Invalid object name 'dbo\.CAL_METODO/i.test(String(err?.message || ''));
const SIN_MIGRACION = 'Falta la configuración del método de calibración (migración 021).';

const COLUMNAS = `id, version, estado, base, contenido, revision, motivo, creado_por, creado_nombre,
  CONVERT(varchar(19), creado_en, 126) AS creado_en, modificado_por, CONVERT(varchar(19), modificado_en, 126) AS modificado_en,
  aprobado_por, aprobado_nombre, CONVERT(varchar(19), aprobado_en, 126) AS aprobado_en,
  CONVERT(varchar(19), vigente_desde, 126) AS vigente_desde, CONVERT(varchar(19), vigente_hasta, 126) AS vigente_hasta`;

const leerVersiones = async (createRequest, { lock = false } = {}) => (await createRequest()
  .query(`SELECT ${COLUMNAS} FROM dbo.CAL_METODO_VERSIONES ${lock ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} ORDER BY version DESC`)).recordset
  .map(fila => ({ ...fila, contenido: completar(JSON.parse(fila.contenido)) }));

const leerHistorial = async createRequest => (await createRequest().query(`
  SELECT h.id, v.version, h.accion, h.detalle, h.motivo, h.usuario, h.usuario_nombre, CONVERT(varchar(19), h.fecha, 126) AS fecha
  FROM dbo.CAL_METODO_HISTORIAL h JOIN dbo.CAL_METODO_VERSIONES v ON v.id = h.version_id
  ORDER BY h.id DESC`)).recordset;

/**
 * Quién hace la acción: el usuario de la sesión y su nombre de DATA_USERS
 * (la sesión no trae el nombre). null: el sistema.
 */
const autorDe = (user, persona) => ({ usuario: actorName(user), nombre: clean(persona?.nombre) || null });

const registrar = (createRequest, versionId, accion, { detalle = null, motivo = null } = {}, autor) => createRequest()
  .input('id', sql.Int, versionId)
  .input('accion', sql.VarChar(12), accion)
  .input('detalle', sql.NVarChar(sql.MAX), detalle ? JSON.stringify(detalle) : null)
  .input('motivo', sql.NVarChar(500), motivo || null)
  .input('usuario', sql.NVarChar(50), autor ? autor.usuario : SISTEMA)
  .input('nombre', sql.NVarChar(120), autor ? autor.nombre : 'DataMET+')
  .query(`INSERT INTO dbo.CAL_METODO_HISTORIAL (version_id, accion, detalle, motivo, usuario, usuario_nombre)
    VALUES (@id, @accion, @detalle, @motivo, @usuario, @nombre)`);

/** La primera vez: la versión 1 (inicial del sistema) queda vigente, sin aprobar. */
const asegurarInicial = async (createRequest) => {
  const { recordset } = await createRequest()
    .input('contenido', sql.NVarChar(sql.MAX), JSON.stringify(contenidoInicial()))
    .input('motivo', sql.NVarChar(500), 'Configuración inicial del sistema (fase 0).')
    .query(`IF NOT EXISTS (SELECT 1 FROM dbo.CAL_METODO_VERSIONES WITH (UPDLOCK, HOLDLOCK))
      BEGIN
        INSERT INTO dbo.CAL_METODO_VERSIONES (version, estado, contenido, motivo, creado_por, creado_nombre)
        OUTPUT INSERTED.id VALUES (1, 'VIGENTE', @contenido, @motivo, '${SISTEMA}', 'DataMET+');
      END`);
  if (recordset?.[0]?.id) await registrar(createRequest, recordset[0].id, 'CREACION', { motivo: 'Configuración inicial del sistema (fase 0).' }, null);
};

// ─── Configuración para el cálculo ─────────────────────────────────────────

const VIGENCIA_CACHE_MS = 60 * 1000;
const cache = { vigente: null, leidaEn: 0, versiones: new Map() };
const limpiarCache = () => { cache.vigente = null; cache.leidaEn = 0; cache.versiones.clear(); };

const configuracion = (version, contenido, aprobada) => ({
  version, aprobada, contenido, motor: configuracionMotor(version, contenido), textos: contenido.textos,
});
const porDefecto = () => configuracion(1, contenidoInicial(), false);
const desdeFila = fila => configuracion(fila.version, completar(JSON.parse(fila.contenido)), Boolean(fila.aprobado_por));

/** La versión vigente (sin la migración o sin versiones: la inicial). */
const configuracionVigente = async () => {
  if (cache.vigente && Date.now() - cache.leidaEn < VIGENCIA_CACHE_MS) return cache.vigente;
  let vigente;
  try {
    const { recordset } = await getPool().request()
      .query("SELECT TOP (1) version, contenido, aprobado_por FROM dbo.CAL_METODO_VERSIONES WHERE estado = 'VIGENTE'");
    vigente = recordset[0] ? desdeFila(recordset[0]) : porDefecto();
  } catch (err) {
    if (!sinTabla(err)) throw err;
    vigente = porDefecto();
  }
  Object.assign(cache, { vigente, leidaEn: Date.now() });
  return vigente;
};

/** Una versión que rigió o rige (los registros aprobados guardan su número). */
const configuracionDe = async (version) => {
  if (version == null) return configuracionVigente();
  const numeroVersion = Number(version);
  if (cache.versiones.has(numeroVersion)) return cache.versiones.get(numeroVersion);
  let fila = null;
  try {
    fila = (await getPool().request().input('version', sql.Int, numeroVersion)
      .query("SELECT version, contenido, aprobado_por FROM dbo.CAL_METODO_VERSIONES WHERE version = @version AND estado IN ('VIGENTE', 'REEMPLAZADA')"))
      .recordset[0] || null;
  } catch (err) {
    if (!sinTabla(err)) throw err;
  }
  const resultado = fila ? desdeFila(fila) : numeroVersion === 1 ? porDefecto() : null;
  if (!resultado) throw httpError(409, `No existe la versión ${numeroVersion} de la configuración del método.`);
  // La 1 por defecto se vuelve a leer: puede crearse o aprobarse después.
  if (fila) cache.versiones.set(numeroVersion, resultado);
  return resultado;
};

// ─── Pantalla y operaciones ────────────────────────────────────────────────

const meta = (fila) => ({
  version: fila.version,
  estado: fila.estado,
  base: fila.base,
  revision: fila.revision,
  motivo: fila.motivo,
  creadoPor: fila.creado_nombre || fila.creado_por,
  creadoEn: fila.creado_en,
  modificadoPor: fila.modificado_por,
  modificadoEn: fila.modificado_en,
  aprobadoPor: fila.aprobado_nombre || fila.aprobado_por,
  aprobadoEn: fila.aprobado_en,
  vigenteDesde: fila.vigente_desde,
  vigenteHasta: fila.vigente_hasta,
  inicial: fila.creado_por === SISTEMA,
});

/** La versión que espera aprobación: el borrador o la inicial sin aprobar. */
const porAprobar = versiones => versiones.find(v => v.estado === 'BORRADOR')
  || versiones.find(v => v.estado === 'VIGENTE' && !v.aprobado_por && v.creado_por === SISTEMA)
  || null;

/**
 * Quién hizo el último cambio de una versión (redactarla o editarla): el único
 * que no la puede aprobar; quien la redactó antes y otro completó, sí.
 */
const ultimoEditorDe = (version, historial) => ultimoAutor([
  { usuario: version.creado_por, en: version.creado_en },
  ...historial
    .filter(h => h.version === version.version && ['CREACION', 'EDICION'].includes(h.accion))
    .sort((a, b) => a.id - b.id)
    .map(h => ({ usuario: h.usuario, en: h.fecha })),
  { usuario: version.modificado_por, en: version.modificado_en },
].filter(a => a.usuario !== SISTEMA));

const editoUltimo = (version, historial, usuario) => {
  const ultimo = ultimoEditorDe(version, historial);
  return Boolean(ultimo && usuario) && String(ultimo).toLowerCase() === String(usuario).toLowerCase();
};

const permisosDe = (persona, versiones, historial) => {
  const pendiente = porAprobar(versiones);
  const redacto = pendiente ? editoUltimo(pendiente, historial, persona.usuario) : false;
  let motivoAprobar = null;
  if (!pendiente) motivoAprobar = 'No hay una versión por aprobar.';
  else if (!persona.jefe) motivoAprobar = 'Solo el jefe de Calibración aprueba la configuración del método.';
  else if (redacto) motivoAprobar = 'Hiciste el último cambio de esta versión: debe aprobarla alguien que no la editó al final.';
  const borrador = versiones.some(v => v.estado === 'BORRADOR');
  return {
    redactar: persona.editor && !borrador,
    editar: persona.editor && borrador,
    descartar: (persona.editor || persona.jefe) && borrador,
    aprobar: !motivoAprobar,
    motivoAprobar,
  };
};

const leerTodo = async (createRequest, opciones) => ({
  versiones: await leerVersiones(createRequest, opciones),
  historial: await leerHistorial(createRequest),
});

const conMigracion = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    if (sinTabla(err)) throw httpError(503, SIN_MIGRACION);
    throw err;
  }
};

/** La pantalla: vigente, borrador, todas las versiones con sus diferencias e historial. */
const getMetodo = async (user) => conMigracion(async () => {
  const persona = await personaCalibracion(user);
  const { versiones, historial } = await withTransaction(async (createRequest) => {
    await asegurarInicial(createRequest);
    return leerTodo(createRequest);
  });
  const porNumero = new Map(versiones.map(v => [v.version, v]));
  const vigente = versiones.find(v => v.estado === 'VIGENTE');
  const borrador = versiones.find(v => v.estado === 'BORRADOR');
  const pendiente = porAprobar(versiones);
  return {
    vigente: vigente ? { ...meta(vigente), contenido: vigente.contenido } : null,
    borrador: borrador ? {
      ...meta(borrador),
      contenido: borrador.contenido,
      diferencias: diferencias(porNumero.get(borrador.base)?.contenido, borrador.contenido),
    } : null,
    porAprobar: pendiente ? pendiente.version : null,
    versiones: versiones.map(v => ({
      ...meta(v),
      contenido: v.contenido,
      diferencias: v.base ? diferencias(porNumero.get(v.base)?.contenido, v.contenido) : [],
    })),
    historial: historial.map(h => ({
      id: h.id, version: h.version, accion: h.accion, motivo: h.motivo, usuario: h.usuario_nombre || h.usuario, fecha: h.fecha,
      cambios: h.detalle ? JSON.parse(h.detalle) : [],
    })),
    permisos: permisosDe(persona, versiones, historial),
  };
});

const exigirEditor = async (user) => {
  const persona = await personaCalibracion(user);
  if (!persona.editor) throw httpError(403, 'Solo el personal de Calibración redacta la configuración del método.');
  return persona;
};

/** Nuevo borrador a partir de la versión vigente, con el motivo del cambio. */
const crearBorrador = async (user, { motivo }) => conMigracion(async () => {
  const autor = autorDe(user, await exigirEditor(user));
  return withTransaction(async (createRequest) => {
    await asegurarInicial(createRequest);
    const versiones = await leerVersiones(createRequest, { lock: true });
    const abierto = versiones.find(v => v.estado === 'BORRADOR');
    if (abierto) throw httpError(409, `Ya hay un borrador (versión ${abierto.version}): edítalo o descártalo.`);
    const vigente = versiones.find(v => v.estado === 'VIGENTE');
    const nueva = Math.max(0, ...versiones.map(v => v.version)) + 1;
    const { recordset } = await createRequest()
      .input('version', sql.Int, nueva)
      .input('base', sql.Int, vigente?.version ?? null)
      .input('contenido', sql.NVarChar(sql.MAX), JSON.stringify(vigente?.contenido || contenidoInicial()))
      .input('motivo', sql.NVarChar(500), motivo)
      .input('usuario', sql.NVarChar(50), autor.usuario)
      .input('nombre', sql.NVarChar(120), autor.nombre)
      .query(`INSERT INTO dbo.CAL_METODO_VERSIONES (version, estado, base, contenido, motivo, creado_por, creado_nombre)
        OUTPUT INSERTED.id VALUES (@version, 'BORRADOR', @base, @contenido, @motivo, @usuario, @nombre)`);
    await registrar(createRequest, recordset[0].id, 'CREACION', { motivo }, autor);
    return { version: nueva };
  });
});

/** Guarda el borrador; `revision` evita pisar lo que otra persona guardó. */
const guardarBorrador = async (user, { revision, contenido, motivo = null }) => conMigracion(async () => {
  const autor = autorDe(user, await exigirEditor(user));
  const nuevo = validarContenido(contenido);
  return withTransaction(async (createRequest) => {
    const versiones = await leerVersiones(createRequest, { lock: true });
    const borrador = versiones.find(v => v.estado === 'BORRADOR');
    if (!borrador) throw httpError(409, 'No hay un borrador abierto: crea uno desde la versión vigente.');
    if (borrador.revision !== revision) throw httpError(409, 'Otra persona guardó el borrador mientras lo editabas. Recárgalo antes de guardar.');
    const cambios = diferencias(borrador.contenido, nuevo);
    if (!cambios.length) return { version: borrador.version, revision: borrador.revision, cambios: 0 };
    await createRequest()
      .input('id', sql.Int, borrador.id)
      .input('contenido', sql.NVarChar(sql.MAX), JSON.stringify(nuevo))
      .input('usuario', sql.NVarChar(50), autor.usuario)
      .query(`UPDATE dbo.CAL_METODO_VERSIONES SET contenido = @contenido, revision = revision + 1,
          modificado_por = @usuario, modificado_en = SYSUTCDATETIME() WHERE id = @id`);
    await registrar(createRequest, borrador.id, 'EDICION', { detalle: cambios, motivo }, autor);
    return { version: borrador.version, revision: borrador.revision + 1, cambios: cambios.length };
  });
});

/** Descarta el borrador (queda con su historial). */
const descartarBorrador = async (user, { motivo }) => conMigracion(async () => {
  const persona = await personaCalibracion(user);
  if (!persona.editor && !persona.jefe) throw httpError(403, 'Solo el personal de Calibración descarta un borrador.');
  return withTransaction(async (createRequest) => {
    const versiones = await leerVersiones(createRequest, { lock: true });
    const borrador = versiones.find(v => v.estado === 'BORRADOR');
    if (!borrador) throw httpError(409, 'No hay un borrador abierto.');
    await createRequest().input('id', sql.Int, borrador.id)
      .query("UPDATE dbo.CAL_METODO_VERSIONES SET estado = 'DESCARTADA' WHERE id = @id");
    await registrar(createRequest, borrador.id, 'DESCARTE', { motivo }, autorDe(user, persona));
    return { version: borrador.version, estado: 'DESCARTADA' };
  });
});

/**
 * Aprueba la versión pendiente (jefe de Calibración, que no la redactó). El
 * borrador pasa a vigente y la anterior queda reemplazada; la inicial sin
 * aprobar solo registra la aprobación. `revision` asegura que se aprueba lo
 * que se revisó.
 */
const aprobar = async (user, { revision, motivo = null }) => conMigracion(async () => {
  const persona = await personaCalibracion(user);
  if (!persona.jefe) throw httpError(403, 'Solo el jefe de Calibración aprueba la configuración del método.');
  const resultado = await withTransaction(async (createRequest) => {
    await asegurarInicial(createRequest);
    const { versiones, historial } = await leerTodo(createRequest, { lock: true });
    const pendiente = porAprobar(versiones);
    if (!pendiente) throw httpError(409, 'No hay una versión por aprobar.');
    if (pendiente.revision !== revision) throw httpError(409, 'La versión cambió desde que la abriste. Recárgala y revísala de nuevo.');
    if (editoUltimo(pendiente, historial, persona.usuario)) {
      throw httpError(403, 'Hiciste el último cambio de esta versión: debe aprobarla alguien que no la editó al final.');
    }
    validarContenido(pendiente.contenido);
    const aprobador = (request) => request
      .input('id', sql.Int, pendiente.id)
      .input('usuario', sql.NVarChar(50), actorName(user))
      .input('nombre', sql.NVarChar(120), clean(persona.nombre) || null);
    if (pendiente.estado === 'BORRADOR') {
      // Primero la anterior deja de regir: solo puede haber una vigente.
      await createRequest().query(`UPDATE dbo.CAL_METODO_VERSIONES SET estado = 'REEMPLAZADA', vigente_hasta = SYSUTCDATETIME()
        WHERE estado = 'VIGENTE'`);
      await aprobador(createRequest()).query(`UPDATE dbo.CAL_METODO_VERSIONES SET estado = 'VIGENTE', aprobado_por = @usuario,
          aprobado_nombre = @nombre, aprobado_en = SYSUTCDATETIME(), vigente_desde = SYSUTCDATETIME() WHERE id = @id`);
    } else {
      await aprobador(createRequest()).query(`UPDATE dbo.CAL_METODO_VERSIONES SET aprobado_por = @usuario,
          aprobado_nombre = @nombre, aprobado_en = SYSUTCDATETIME() WHERE id = @id`);
    }
    await registrar(createRequest, pendiente.id, 'APROBACION', { motivo }, autorDe(user, persona));
    return { version: pendiente.version, estado: 'VIGENTE' };
  });
  limpiarCache();
  return resultado;
});

module.exports = {
  CLASES_PESAS,
  aprobar,
  completar,
  configuracionDe,
  configuracionMotor,
  configuracionVigente,
  contenidoInicial,
  crearBorrador,
  descartarBorrador,
  diferencias,
  getMetodo,
  guardarBorrador,
  limpiarCache,
  permisosDe,
  porAprobar,
  validarContenido,
};
