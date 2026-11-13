/**
 * Permisos con nombre (Sistema › Gestión de permisos, migración 029;
 * NB/ISO/IEC 17025, 7.11.3 a y 8.4).
 *
 * Un permiso (`tiempos.soporte.ver`, ver `permisos.catalogo.js`) se concede a
 * una persona o a un grupo: un área, un cargo o un cargo de un área («jefes
 * de área» es el cargo «Jefe de Area» en todas las áreas). Sistemas (nivel 3)
 * los tiene todos. `tienePermiso(user, clave)` es la única comprobación: lee
 * en cada llamada la fila vigente de DATA_USERS y las concesiones, así un
 * cambio de área, de cargo o de permiso rige en la siguiente petición. El
 * menú de la aplicación solo oculta; el backend lo vuelve a comprobar siempre.
 *
 * Las concesiones no se borran: revocar deja la fila con quién, cuándo y por
 * qué (`revocado_*`). Cada cambio agrega una fila en APP_PERMISOS_HISTORIAL
 * con quién, cuándo, qué y quiénes tenían el permiso antes y después; la base
 * rechaza modificar o borrar esas filas (triggers de la migración 029).
 */
// Se leen al llamar (no al cargar el módulo) para que las pruebas puedan simular la base.
const db = require('../config/db');
const transacciones = require('./calibration.db');
const { CLAVES, GESTORES, PERMISOS, permisoDe } = require('./permisos.catalogo');

const { sql } = db;
const { httpError, normalizeArea } = transacciones;
const withTransaction = (trabajo) => transacciones.withTransaction(trabajo);

// ─── Reglas ────────────────────────────────────────────────────────────────

/** Área o cargo como se comparan: sin tildes, en minúsculas y con un solo espacio. */
const normalizar = (valor) => normalizeArea(valor).replace(/\s+/g, ' ');

const esSistemas = (persona) => String(persona?.acceso_cron ?? '').trim() === '3';

/**
 * ¿La regla (una concesión o un gestor) alcanza a la persona? Una persona por
 * su id; un grupo por su área y su cargo (el que falta vale para todos).
 */
const coincide = (regla, persona) => {
  if (!regla || !persona) return false;
  const usuarioId = regla.usuarioId ?? regla.usuario_id ?? null;
  if (usuarioId !== null) return Number(persona.id) === Number(usuarioId);
  if (!regla.area && !regla.cargo) return false;
  return (!regla.area || normalizar(persona.area) === regla.area)
    && (!regla.cargo || normalizar(persona.cargo) === regla.cargo);
};

const exigirClave = (clave) => {
  if (!CLAVES.includes(clave)) throw new Error(`Permiso desconocido: ${clave}`);
};

/** Con las concesiones vigentes ya leídas: ¿la persona (fila de DATA_USERS) tiene el permiso? */
const tienePermisoCon = (concesiones, persona, clave) => {
  exigirClave(clave);
  if (!persona) return false;
  if (esSistemas(persona)) return true;
  return (concesiones || []).some(concesion => concesion.permiso === clave && coincide(concesion, persona));
};

/** Gestionan los permisos Sistemas (nivel 3) y quien digan GESTORES (fijo en el código). */
const gestiona = (persona, gestores = GESTORES) => Boolean(persona)
  && (esSistemas(persona) || gestores.some(regla => coincide(regla, persona)));

// ─── Lectura ───────────────────────────────────────────────────────────────

const pedir = () => db.getPool().request();

const sinMigracion = (error) => /Invalid object name 'dbo\.APP_PERMISOS/i.test(error?.message || '');

const MENSAJE_SIN_MIGRACION = 'Falta la migración 029 (gestión de permisos) en la base de datos. Ejecuta "pnpm migrate" en backend.';

const PERSONA_SELECT = `SELECT id, usuario, area, cargo, acceso_cron,
  LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))) AS nombre FROM DATA_USERS`;

/** Fila vigente de DATA_USERS del usuario de la sesión (activo), o null. */
const leerPersona = async (user, request = pedir, bloquear = false) => {
  const id = Number(user?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await request().input('id', sql.Int, id)
    .query(`${PERSONA_SELECT} ${bloquear ? 'WITH (HOLDLOCK)' : ''} WHERE id = @id AND estado = 'ACTIVO';`);
  return result.recordset[0] || null;
};

/** Concesiones que siembra la migración 029; valen mientras no esté aplicada. */
const iniciales = (claves) => claves.flatMap(clave => (permisoDe(clave)?.inicial || [])
  .map(regla => ({ permiso: clave, usuario_id: null, area: regla.area ?? null, cargo: regla.cargo ?? null })));

/** Concesiones vigentes (de un permiso o de todos). Sin la migración, las iniciales del catálogo. */
const leerVigentes = async (clave = null, request = pedir) => {
  try {
    const consulta = request();
    if (clave) consulta.input('permiso', sql.VarChar(60), clave);
    const result = await consulta.query(`SELECT id, permiso, usuario_id, area, cargo
      FROM dbo.APP_PERMISOS_CONCESIONES WHERE revocado_en IS NULL${clave ? ' AND permiso = @permiso' : ''};`);
    return result.recordset;
  } catch (error) {
    if (!sinMigracion(error)) throw error;
    return iniciales(clave ? [clave] : CLAVES);
  }
};

/**
 * ¿El usuario de la sesión tiene el permiso? La comprobación única del
 * backend: la usan los servicios y `requirePermiso`.
 */
const tienePermiso = async (user, clave) => {
  exigirClave(clave);
  const [persona, concesiones] = await Promise.all([leerPersona(user), leerVigentes(clave)]);
  return tienePermisoCon(concesiones, persona, clave);
};

/** Como `tienePermiso`, pero responde 403 con el mensaje si no lo tiene. */
const exigirPermiso = async (user, clave, mensaje) => {
  if (await tienePermiso(user, clave)) return;
  throw httpError(403, mensaje || `No tienes el permiso «${permisoDe(clave).nombre}». Lo concede Sistemas en Gestión de permisos.`);
};

/** ¿El usuario de la sesión gestiona los permisos? (Sistemas y el jefe de Sistemas.) */
const puedeGestionar = async (user) => gestiona(await leerPersona(user));

/** Los permisos del usuario de la sesión, para el menú: { permisos, gestionar }. */
const misPermisos = async (user) => {
  const [persona, concesiones] = await Promise.all([leerPersona(user), leerVigentes()]);
  return {
    permisos: CLAVES.filter(clave => tienePermisoCon(concesiones, persona, clave)),
    gestionar: gestiona(persona),
  };
};

// ─── Gestión ───────────────────────────────────────────────────────────────

/** Áreas o cargos de DATA_USERS: su clave normalizada, cómo se escribe más y cuántos lo tienen. */
const etiquetas = (personal, campo) => {
  const grupos = new Map();
  for (const persona of personal) {
    const escrito = String(persona[campo] ?? '').replace(/\s+/g, ' ').trim();
    const clave = normalizar(escrito);
    if (!clave) continue;
    const grupo = grupos.get(clave) || { clave, personas: 0, variantes: new Map() };
    grupo.personas += 1;
    grupo.variantes.set(escrito, (grupo.variantes.get(escrito) || 0) + 1);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()]
    .map(({ clave, personas, variantes }) => ({
      clave,
      nombre: [...variantes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0][0],
      personas,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
};

const nombreDe = (lista, clave) => lista.find(item => item.clave === clave)?.nombre || clave;

/** La regla en palabras: «Jefes de área de todas las áreas», «Todo el personal de Calibración»… */
const describir = (regla, { personal = [], areas = [], cargos = [] } = {}) => {
  const usuarioId = regla.usuarioId ?? regla.usuario_id ?? null;
  if (usuarioId !== null) {
    const persona = personal.find(item => Number(item.id) === Number(usuarioId));
    return persona ? persona.nombre || persona.usuario : `Persona n.º ${usuarioId} (sin acceso o dada de baja)`;
  }
  const area = regla.area ? nombreDe(areas, regla.area) : null;
  const cargo = regla.cargo ? nombreDe(cargos, regla.cargo) : null;
  if (area && cargo) return `${cargo} de ${area}`;
  if (area) return `Todo el personal de ${area}`;
  if (regla.cargo === 'jefe de area') return 'Jefes de área de todas las áreas';
  return `Cargo «${cargo}» en todas las áreas`;
};

const iso = (valor) => (valor instanceof Date ? valor.toISOString() : valor ? `${String(valor).replace(' ', 'T')}Z` : null);

const leerJson = (texto) => {
  try {
    const valor = JSON.parse(texto || '[]');
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
};

/** Personal activo que puede entrar a la aplicación (sin contraseñas). */
const leerPersonal = async (request, bloquear = false) => {
  const result = await request().query(`${PERSONA_SELECT} ${bloquear ? 'WITH (HOLDLOCK)' : ''}
    WHERE estado = 'ACTIVO' AND CAST(ISNULL(acceso_cron, 0) AS varchar(10)) <> '0'
    ORDER BY nombre1, apellido1;`);
  return result.recordset;
};

const leerConcesiones = async (request, bloquear = false) => {
  try {
    const result = await request().query(`SELECT id, permiso, usuario_id, area, cargo, motivo, concedido_por,
        CONVERT(varchar(19), concedido_en, 126) AS concedido_en
      FROM dbo.APP_PERMISOS_CONCESIONES ${bloquear ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
      WHERE revocado_en IS NULL ORDER BY permiso, id;`);
    return result.recordset;
  } catch (error) {
    if (sinMigracion(error)) throw httpError(503, MENSAJE_SIN_MIGRACION);
    throw error;
  }
};

/** Todo lo que muestra la pantalla: catálogo, personal con sus permisos y concesiones vigentes. */
const armarGestion = (personal, concesiones) => {
  const contexto = { personal, areas: etiquetas(personal, 'area'), cargos: etiquetas(personal, 'cargo') };
  return {
    catalogo: PERMISOS.map(({ clave, nombre, descripcion, modulo }) => ({ clave, nombre, descripcion, modulo })),
    gestores: ['Sistemas (nivel 3)', ...GESTORES.map(regla => describir(regla, contexto))],
    areas: contexto.areas,
    cargos: contexto.cargos,
    personal: personal.map(persona => ({
      id: persona.id,
      usuario: persona.usuario,
      nombre: persona.nombre || persona.usuario,
      area: persona.area || null,
      cargo: persona.cargo || null,
      nivel: String(persona.acceso_cron ?? '').trim(),
      sistemas: esSistemas(persona),
      gestiona: gestiona(persona),
      permisos: CLAVES.filter(clave => tienePermisoCon(concesiones, persona, clave)).map(clave => ({
        clave,
        sistemas: esSistemas(persona),
        concesiones: concesiones.filter(c => c.permiso === clave && coincide(c, persona)).map(c => c.id),
      })),
    })),
    concesiones: concesiones.map(concesion => ({
      id: concesion.id,
      permiso: concesion.permiso,
      tipo: concesion.usuario_id !== null ? 'PERSONA' : 'GRUPO',
      usuarioId: concesion.usuario_id,
      area: concesion.area,
      cargo: concesion.cargo,
      sujeto: describir(concesion, contexto),
      motivo: concesion.motivo,
      concedidoPor: concesion.concedido_por,
      concedidoEn: iso(concesion.concedido_en),
      alcance: personal.filter(persona => coincide(concesion, persona)).length,
    })),
  };
};

const leerGestion = async (request, bloquear = false) => {
  const personal = await leerPersonal(request, bloquear);
  const concesiones = await leerConcesiones(request, bloquear);
  return { personal, concesiones, gestion: armarGestion(personal, concesiones) };
};

/** El actor que gestiona, leído de nuevo dentro de la transacción. */
const exigirGestor = async (request, user) => {
  const actor = await leerPersona(user, request, true);
  if (!gestiona(actor)) throw httpError(403, 'Solo Sistemas y el jefe de Sistemas gestionan los permisos.');
  return { ...actor, usuario: String(actor.usuario || user?.usuario || 'sistema').slice(0, 50) };
};

const obtenerGestion = (user) => withTransaction(async (request) => {
  await exigirGestor(request, user);
  return (await leerGestion(request)).gestion;
});

const HISTORIAL_LIMITE = 500;

/** Los cambios de permisos, del más reciente al más antiguo (hasta 500). */
const obtenerHistorial = (user) => withTransaction(async (request) => {
  await exigirGestor(request, user);
  let result;
  try {
    result = await request().input('limite', sql.Int, HISTORIAL_LIMITE).query(`
      SELECT TOP (@limite) id, accion, permiso, concesion_id, sujeto, anteriores, nuevos, motivo, usuario, nombre,
        CONVERT(varchar(19), fecha, 126) AS fecha
      FROM dbo.APP_PERMISOS_HISTORIAL ORDER BY id DESC;`);
  } catch (error) {
    if (sinMigracion(error)) throw httpError(503, MENSAJE_SIN_MIGRACION);
    throw error;
  }
  return result.recordset.map(fila => ({
    id: fila.id,
    accion: fila.accion,
    permiso: fila.permiso,
    permisoNombre: permisoDe(fila.permiso)?.nombre || fila.permiso,
    concesionId: fila.concesion_id,
    sujeto: fila.sujeto,
    antes: leerJson(fila.anteriores),
    despues: leerJson(fila.nuevos),
    motivo: fila.motivo,
    usuario: fila.usuario,
    nombre: fila.nombre,
    fecha: iso(fila.fecha),
  }));
});

const agregarHistorial = (request, { accion, permiso, concesionId, sujeto, antes, despues, motivo, actor }) => request()
  .input('accion', sql.VarChar(20), accion)
  .input('permiso', sql.VarChar(60), permiso)
  .input('concesion', sql.Int, concesionId)
  .input('sujeto', sql.NVarChar(200), sujeto.slice(0, 200))
  .input('anteriores', sql.NVarChar(sql.MAX), JSON.stringify(antes))
  .input('nuevos', sql.NVarChar(sql.MAX), JSON.stringify(despues))
  .input('motivo', sql.NVarChar(300), motivo)
  .input('usuario', sql.NVarChar(50), actor.usuario)
  .input('nombre', sql.NVarChar(120), String(actor.nombre || actor.usuario).slice(0, 120))
  .query(`INSERT INTO dbo.APP_PERMISOS_HISTORIAL
      (accion, permiso, concesion_id, sujeto, anteriores, nuevos, motivo, usuario, nombre)
    VALUES (@accion, @permiso, @concesion, @sujeto, @anteriores, @nuevos, @motivo, @usuario, @nombre);`);

const mismaRegla = (a, b) => (a.usuario_id ?? null) === (b.usuario_id ?? null)
  && (a.area ?? null) === (b.area ?? null) && (a.cargo ?? null) === (b.cargo ?? null);

/** Sujetos que tienen el permiso, en palabras, para el historial. */
const sujetosDe = (concesiones, clave, contexto) => concesiones
  .filter(concesion => concesion.permiso === clave)
  .map(concesion => describir(concesion, contexto));

const esDuplicado = (error) => [2601, 2627].includes(error?.number)
  || [2601, 2627].includes(error?.originalError?.info?.number);

/**
 * Concede un permiso a una persona ({ tipo: 'PERSONA', usuarioId }) o a un
 * grupo ({ tipo: 'GRUPO', area, cargo }) con su motivo. Responde la gestión
 * actualizada.
 */
const conceder = (body, user) => withTransaction(async (request) => {
  const actor = await exigirGestor(request, user);
  const permiso = permisoDe(body.permiso);
  if (!permiso) throw httpError(400, 'Ese permiso no existe.');
  const { personal, concesiones } = await leerGestion(request, true);
  const contexto = { personal, areas: etiquetas(personal, 'area'), cargos: etiquetas(personal, 'cargo') };

  let regla;
  if (body.tipo === 'PERSONA') {
    if (!personal.some(persona => Number(persona.id) === Number(body.usuarioId))) {
      throw httpError(400, 'Elige una persona activa del personal.');
    }
    regla = { usuario_id: Number(body.usuarioId), area: null, cargo: null };
  } else {
    const area = body.area ? normalizar(body.area) : null;
    const cargo = body.cargo ? normalizar(body.cargo) : null;
    if (!area && !cargo) throw httpError(400, 'Elige un área, un cargo o los dos.');
    if (area && !contexto.areas.some(item => item.clave === area)) throw httpError(400, 'Esa área no la tiene nadie del personal activo.');
    if (cargo && !contexto.cargos.some(item => item.clave === cargo)) throw httpError(400, 'Ese cargo no lo tiene nadie del personal activo.');
    regla = { usuario_id: null, area, cargo };
  }
  const sujeto = describir(regla, contexto);
  if (concesiones.some(concesion => concesion.permiso === permiso.clave && mismaRegla(concesion, regla))) {
    throw httpError(409, `«${sujeto}» ya tiene ese permiso.`);
  }

  const antes = sujetosDe(concesiones, permiso.clave, contexto);
  let insertada;
  try {
    insertada = await request()
      .input('permiso', sql.VarChar(60), permiso.clave)
      .input('usuarioId', sql.Int, regla.usuario_id)
      .input('area', sql.NVarChar(60), regla.area)
      .input('cargo', sql.NVarChar(60), regla.cargo)
      .input('motivo', sql.NVarChar(300), body.motivo)
      .input('usuario', sql.NVarChar(50), actor.usuario)
      .query(`INSERT INTO dbo.APP_PERMISOS_CONCESIONES (permiso, usuario_id, area, cargo, motivo, concedido_por)
        VALUES (@permiso, @usuarioId, @area, @cargo, @motivo, @usuario);
        SELECT CAST(SCOPE_IDENTITY() AS int) AS id;`);
  } catch (error) {
    if (esDuplicado(error)) throw httpError(409, `«${sujeto}» ya tiene ese permiso.`);
    throw error;
  }
  const concesionId = insertada.recordset[0].id;
  await agregarHistorial(request, {
    accion: 'CONCEDER', permiso: permiso.clave, concesionId, sujeto, antes, despues: [...antes, sujeto],
    motivo: body.motivo, actor,
  });
  return (await leerGestion(request)).gestion;
});

/** Revoca una concesión vigente con su motivo. La fila queda, con quién, cuándo y por qué. */
const revocar = (id, body, user) => withTransaction(async (request) => {
  const actor = await exigirGestor(request, user);
  const { personal, concesiones } = await leerGestion(request, true);
  const contexto = { personal, areas: etiquetas(personal, 'area'), cargos: etiquetas(personal, 'cargo') };
  const concesion = concesiones.find(item => item.id === id);
  if (!concesion) {
    const existe = await request().input('id', sql.Int, id)
      .query('SELECT TOP (1) id FROM dbo.APP_PERMISOS_CONCESIONES WHERE id = @id;');
    throw existe.recordset[0]
      ? httpError(409, 'Esa concesión ya se revocó. Vuelve a abrir la gestión de permisos.')
      : httpError(404, 'Esa concesión no existe.');
  }
  const antes = sujetosDe(concesiones, concesion.permiso, contexto);
  const sujeto = describir(concesion, contexto);
  const result = await request()
    .input('id', sql.Int, id)
    .input('usuario', sql.NVarChar(50), actor.usuario)
    .input('motivo', sql.NVarChar(300), body.motivo)
    .query(`UPDATE dbo.APP_PERMISOS_CONCESIONES
      SET revocado_por = @usuario, revocado_en = SYSUTCDATETIME(), motivo_revocacion = @motivo
      WHERE id = @id AND revocado_en IS NULL;`);
  if (!result.rowsAffected?.[0]) throw httpError(409, 'Esa concesión ya se revocó. Vuelve a abrir la gestión de permisos.');
  await agregarHistorial(request, {
    accion: 'REVOCAR', permiso: concesion.permiso, concesionId: id, sujeto, antes,
    despues: sujetosDe(concesiones.filter(item => item.id !== id), concesion.permiso, contexto),
    motivo: body.motivo, actor,
  });
  return (await leerGestion(request)).gestion;
});

module.exports = {
  MENSAJE_SIN_MIGRACION,
  armarGestion,
  coincide,
  conceder,
  describir,
  etiquetas,
  exigirPermiso,
  gestiona,
  misPermisos,
  normalizar,
  obtenerGestion,
  obtenerHistorial,
  puedeGestionar,
  revocar,
  tienePermiso,
  tienePermisoCon,
};
