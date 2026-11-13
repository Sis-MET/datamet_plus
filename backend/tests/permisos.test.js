const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const transacciones = require('../src/services/calibration.db');
const { parse } = require('../src/services/system.validation');
const { CLAVES, GESTORES, PERMISOS } = require('../src/services/permisos.catalogo');
const permisos = require('../src/services/permisos');

// Doble de la base: el personal de DATA_USERS y las tablas de la migración
// 029. Ejecuta los servicios reales; revierte la transacción si fallan.
let base;
const reiniciar = ({ migracion = true } = {}) => {
  base = {
    migracion,
    personal: [
      { id: 22, usuario: 'Barrau', nombre: 'Jhonatan Barrau', area: 'Administración', cargo: 'Auxiliar de Sistemas', acceso_cron: 3 },
      { id: 11, usuario: 'Telleria', nombre: 'Ramiro Telleria', area: 'Administración', cargo: 'Jefe de Area', acceso_cron: 2 },
      { id: 2, usuario: 'Delgado', nombre: 'Edgar Delgado', area: 'Comercial', cargo: 'Jefe de Area', acceso_cron: 2 },
      { id: 3, usuario: 'Rojas', nombre: 'Ana Rojas', area: 'Comercial', cargo: 'Auxiliar Comercial', acceso_cron: 2 },
      { id: 7, usuario: 'Vallejos', nombre: 'Gerson Vallejos', area: 'Calibración', cargo: 'Jefe de Area', acceso_cron: 2 },
      { id: 9, usuario: 'Paz', nombre: 'Bruno Paz', area: 'Calibración', cargo: 'Técnico', acceso_cron: 2 },
      { id: 8, usuario: 'Velasquez', nombre: 'Jose Velasquez', area: 'Soporte Técnico', cargo: 'Jefe de Área', acceso_cron: 2 },
      { id: 10, usuario: 'Vega', nombre: 'Carla Vega', area: 'Soporte Tecnico', cargo: 'Técnico 3', acceso_cron: 2 },
    ],
    concesiones: [
      { id: 1, permiso: 'tiempos.soporte.ver', usuario_id: null, area: null, cargo: 'jefe de area', motivo: 'Semilla', concedido_por: 'migración 029', concedido_en: '2026-11-13T15:00:00', revocado_en: null },
      { id: 2, permiso: 'tiempos.calibracion.ver', usuario_id: null, area: null, cargo: 'jefe de area', motivo: 'Semilla', concedido_por: 'migración 029', concedido_en: '2026-11-13T15:00:00', revocado_en: null },
    ],
    historial: [],
    escrituras: 0,
  };
};

const sinTabla = () => Object.assign(new Error("Invalid object name 'dbo.APP_PERMISOS_CONCESIONES'."), { number: 208 });

class Request {
  constructor() { this.params = {}; }
  input(nombre, _tipo, valor) { this.params[nombre] = valor; return this; }
  async query(texto) {
    const p = this.params;
    const filas = rows => ({ recordset: structuredClone(rows), rowsAffected: [rows.length] });
    if (texto.includes('FROM DATA_USERS')) {
      return filas(texto.includes('WHERE id = @id') ? base.personal.filter(persona => persona.id === p.id) : base.personal);
    }
    if (texto.includes('APP_PERMISOS') && !base.migracion) throw sinTabla();
    if (texto.includes('INSERT INTO dbo.APP_PERMISOS_CONCESIONES')) {
      base.escrituras += 1;
      const id = Math.max(0, ...base.concesiones.map(c => c.id)) + 1;
      base.concesiones.push({ id, permiso: p.permiso, usuario_id: p.usuarioId, area: p.area, cargo: p.cargo,
        motivo: p.motivo, concedido_por: p.usuario, concedido_en: '2026-11-13T16:00:00', revocado_en: null });
      return filas([{ id }]);
    }
    if (texto.includes('UPDATE dbo.APP_PERMISOS_CONCESIONES')) {
      base.escrituras += 1;
      const fila = base.concesiones.find(c => c.id === p.id && !c.revocado_en);
      if (!fila) return { recordset: [], rowsAffected: [0] };
      Object.assign(fila, { revocado_en: '2026-11-13T17:00:00', revocado_por: p.usuario, motivo_revocacion: p.motivo });
      return { recordset: [], rowsAffected: [1] };
    }
    if (texto.includes('INSERT INTO dbo.APP_PERMISOS_HISTORIAL')) {
      base.escrituras += 1;
      base.historial.push({ id: base.historial.length + 1, ...p, fecha: '2026-11-13T16:00:00' });
      return filas([]);
    }
    if (texto.includes('FROM dbo.APP_PERMISOS_HISTORIAL')) return filas([...base.historial].reverse());
    if (texto.includes('FROM dbo.APP_PERMISOS_CONCESIONES WHERE id = @id')) return filas(base.concesiones.filter(c => c.id === p.id));
    if (texto.includes('FROM dbo.APP_PERMISOS_CONCESIONES')) {
      return filas(base.concesiones.filter(c => !c.revocado_en && (!p.permiso || c.permiso === p.permiso)));
    }
    throw new Error(`Consulta no simulada: ${texto}`);
  }
}
db.getPool = () => ({ request: () => new Request() });
transacciones.withTransaction = async (trabajo) => {
  const antes = structuredClone(base);
  try {
    return await trabajo(() => new Request());
  } catch (error) {
    base = antes;
    throw error;
  }
};

const persona = (id) => base.personal.find(item => item.id === id);
const sesion = (id) => ({ id, usuario: persona(id)?.usuario });

test('el catálogo tiene claves únicas y cada permiso su nombre, módulo y siembra', () => {
  assert.equal(new Set(CLAVES).size, CLAVES.length);
  assert.ok(CLAVES.includes('tiempos.soporte.ver'));
  assert.ok(CLAVES.includes('tiempos.calibracion.ver'));
  for (const permiso of PERMISOS) {
    assert.match(permiso.clave, /^[a-z]+(\.[a-z]+)+$/);
    assert.ok(permiso.nombre && permiso.descripcion && permiso.modulo, permiso.clave);
  }
  // La gestión no se concede desde la pantalla: va fija en el código.
  assert.ok(!CLAVES.some(clave => clave.startsWith('permisos.')));
  assert.ok(Array.isArray(GESTORES));
});

test('una concesión alcanza a una persona o a un grupo de área y cargo, sin importar tildes ni espacios', () => {
  reiniciar();
  const vigentes = base.concesiones;
  const tiene = (id, clave) => permisos.tienePermisoCon(vigentes, persona(id), clave);
  // Sistemas (nivel 3) tiene todos los permisos.
  for (const clave of CLAVES) assert.equal(tiene(22, clave), true, clave);
  // Los jefes de área de todas las áreas ven los dos tiempos de servicio.
  for (const id of [11, 2, 7, 8]) {
    assert.equal(tiene(id, 'tiempos.soporte.ver'), true, `jefe ${id}`);
    assert.equal(tiene(id, 'tiempos.calibracion.ver'), true, `jefe ${id}`);
  }
  // El resto del personal, no; tampoco el de su propia área.
  for (const id of [3, 9, 10]) {
    assert.equal(tiene(id, 'tiempos.soporte.ver'), false, `persona ${id}`);
    assert.equal(tiene(id, 'tiempos.calibracion.ver'), false, `persona ${id}`);
  }
  assert.equal(permisos.tienePermisoCon(vigentes, { id: 50, cargo: ' JEFE DE  ÁREA ', area: 'Gerencia' }, 'tiempos.soporte.ver'), true);
  assert.equal(permisos.tienePermisoCon(vigentes, null, 'tiempos.soporte.ver'), false);
  assert.throws(() => permisos.tienePermisoCon(vigentes, persona(22), 'no.existe'), /Permiso desconocido/);

  // Persona, área y cargo de un área.
  const otras = [
    { permiso: 'tiempos.soporte.ver', usuario_id: 9, area: null, cargo: null },
    { permiso: 'tiempos.calibracion.ver', usuario_id: null, area: 'soporte tecnico', cargo: null },
    { permiso: 'tiempos.calibracion.ver', usuario_id: null, area: 'comercial', cargo: 'auxiliar comercial' },
  ];
  assert.equal(permisos.tienePermisoCon(otras, persona(9), 'tiempos.soporte.ver'), true);
  assert.equal(permisos.tienePermisoCon(otras, persona(10), 'tiempos.soporte.ver'), false);
  assert.equal(permisos.tienePermisoCon(otras, persona(10), 'tiempos.calibracion.ver'), true);
  assert.equal(permisos.tienePermisoCon(otras, persona(3), 'tiempos.calibracion.ver'), true);
  assert.equal(permisos.tienePermisoCon(otras, persona(2), 'tiempos.calibracion.ver'), false);
  // Un grupo sin área ni cargo no concede nada.
  assert.equal(permisos.coincide({ usuario_id: null, area: null, cargo: null }, persona(3)), false);
});

test('gestionan los permisos Sistemas (nivel 3) y quien digan los gestores fijos del código', () => {
  reiniciar();
  assert.equal(permisos.gestiona(persona(22)), true);
  for (const id of [11, 2, 7, 8, 3]) assert.equal(permisos.gestiona(persona(id)), GESTORES.some(r => permisos.coincide(r, persona(id))), `persona ${id}`);
  assert.equal(permisos.gestiona(null), false);
  // Con un gestor por persona o por grupo.
  assert.equal(permisos.gestiona(persona(11), [{ usuarioId: 11 }]), true);
  assert.equal(permisos.gestiona(persona(2), [{ usuarioId: 11 }]), false);
  assert.equal(permisos.gestiona(persona(11), [{ area: 'administracion', cargo: 'jefe de area' }]), true);
  assert.equal(permisos.gestiona(persona(7), [{ area: 'administracion', cargo: 'jefe de area' }]), false);
});

test('las reglas se describen en palabras con el área y el cargo como se escriben en DATA_USERS', () => {
  reiniciar();
  const contexto = {
    personal: base.personal,
    areas: permisos.etiquetas(base.personal, 'area'),
    cargos: permisos.etiquetas(base.personal, 'cargo'),
  };
  // «Soporte Técnico» se escribe así una vez y sin tilde otra: gana la más usada (empate: orden alfabético).
  assert.deepEqual(contexto.areas.find(item => item.clave === 'soporte tecnico'), { clave: 'soporte tecnico', nombre: 'Soporte Tecnico', personas: 2 });
  assert.equal(contexto.cargos.find(item => item.clave === 'jefe de area').personas, 4);
  const describir = regla => permisos.describir(regla, contexto);
  assert.equal(describir({ usuario_id: null, area: null, cargo: 'jefe de area' }), 'Jefes de área de todas las áreas');
  assert.equal(describir({ usuario_id: null, area: 'calibracion', cargo: null }), 'Todo el personal de Calibración');
  assert.equal(describir({ usuario_id: null, area: 'calibracion', cargo: 'jefe de area' }), 'Jefe de Area de Calibración');
  assert.equal(describir({ usuario_id: null, area: null, cargo: 'tecnico' }), 'Cargo «Técnico» en todas las áreas');
  assert.equal(describir({ usuario_id: 9 }), 'Bruno Paz');
  assert.match(describir({ usuario_id: 99 }), /n\.º 99/);
});

test('tienePermiso lee la fila vigente de DATA_USERS: un cambio de cargo o una baja rige de inmediato', async () => {
  reiniciar();
  assert.equal(await permisos.tienePermiso(sesion(2), 'tiempos.soporte.ver'), true);
  // El token puede decir otra cosa: vale lo que dice DATA_USERS ahora.
  assert.equal(await permisos.tienePermiso({ id: 3, acceso_cron: '3', cargo: 'Jefe de Area' }, 'tiempos.soporte.ver'), false);
  persona(2).cargo = 'Auxiliar Comercial';
  assert.equal(await permisos.tienePermiso(sesion(2), 'tiempos.soporte.ver'), false);
  base.personal = base.personal.filter(item => item.id !== 7);
  assert.equal(await permisos.tienePermiso({ id: 7 }, 'tiempos.calibracion.ver'), false);
  assert.equal(await permisos.tienePermiso({}, 'tiempos.calibracion.ver'), false);
  await assert.rejects(permisos.exigirPermiso(sesion(3), 'tiempos.calibracion.ver'), e => e.statusCode === 403 && /Gestión de permisos/.test(e.message));
  await assert.rejects(permisos.tienePermiso(sesion(22), 'tiempos.todo'), /Permiso desconocido/);
});

test('sin la migración 029 rigen las concesiones iniciales del catálogo y la gestión pide la migración', async () => {
  reiniciar({ migracion: false });
  assert.equal(await permisos.tienePermiso(sesion(8), 'tiempos.soporte.ver'), true);
  assert.equal(await permisos.tienePermiso(sesion(2), 'tiempos.calibracion.ver'), true);
  assert.equal(await permisos.tienePermiso(sesion(10), 'tiempos.soporte.ver'), false);
  assert.deepEqual(await permisos.misPermisos(sesion(9)), { permisos: [], gestionar: false });
  await assert.rejects(permisos.obtenerGestion(sesion(22)), e => e.statusCode === 503 && /029/.test(e.message));
});

test('«mis permisos» da los permisos del menú y si gestiona', async () => {
  reiniciar();
  assert.deepEqual(await permisos.misPermisos(sesion(22)), { permisos: CLAVES, gestionar: true });
  assert.deepEqual(await permisos.misPermisos(sesion(2)), { permisos: ['tiempos.soporte.ver', 'tiempos.calibracion.ver'], gestionar: GESTORES.some(r => permisos.coincide(r, persona(2))) });
  assert.deepEqual(await permisos.misPermisos(sesion(9)), { permisos: [], gestionar: false });
});

test('la gestión muestra el personal con su área, cargo y permisos, y de dónde viene cada uno', async () => {
  reiniciar();
  const gestion = await permisos.obtenerGestion(sesion(22));
  assert.deepEqual(gestion.catalogo.map(p => p.clave), CLAVES);
  assert.equal(gestion.gestores[0], 'Sistemas (nivel 3)');
  assert.equal(gestion.personal.length, base.personal.length);
  const jefe = gestion.personal.find(p => p.id === 7);
  assert.deepEqual(
    [jefe.nombre, jefe.area, jefe.cargo, jefe.nivel, jefe.sistemas],
    ['Gerson Vallejos', 'Calibración', 'Jefe de Area', '2', false],
  );
  assert.deepEqual(jefe.permisos, [
    { clave: 'tiempos.soporte.ver', sistemas: false, concesiones: [1] },
    { clave: 'tiempos.calibracion.ver', sistemas: false, concesiones: [2] },
  ]);
  assert.deepEqual(gestion.personal.find(p => p.id === 22).permisos.map(p => p.sistemas), [true, true]);
  assert.deepEqual(gestion.personal.find(p => p.id === 9).permisos, []);
  assert.deepEqual(gestion.concesiones.map(c => [c.id, c.tipo, c.sujeto, c.alcance]), [
    [2, 'GRUPO', 'Jefes de área de todas las áreas', 4],
    [1, 'GRUPO', 'Jefes de área de todas las áreas', 4],
  ].sort((a, b) => a[0] - b[0]));
  assert.equal(gestion.concesiones[0].concedidoEn, '2026-11-13T15:00:00Z');
  // Sin contraseñas ni otros datos de DATA_USERS.
  assert.ok(gestion.personal.every(p => !('pass' in p)));
});

test('solo Sistemas y el jefe de Sistemas gestionan, y se rechaza antes de escribir', async () => {
  reiniciar();
  const otros = [2, 7, 8, 3].filter(id => !GESTORES.some(r => permisos.coincide(r, persona(id))));
  for (const id of otros) {
    await assert.rejects(permisos.obtenerGestion(sesion(id)), e => e.statusCode === 403, `persona ${id}`);
    await assert.rejects(permisos.obtenerHistorial(sesion(id)), e => e.statusCode === 403, `persona ${id}`);
    await assert.rejects(permisos.conceder({ permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: id, motivo: 'x' }, sesion(id)),
      e => e.statusCode === 403, `persona ${id}`);
    await assert.rejects(permisos.revocar(1, { motivo: 'x' }, sesion(id)), e => e.statusCode === 403, `persona ${id}`);
  }
  assert.equal(base.escrituras, 0);
});

test('conceder a una persona o a un grupo deja la concesión y su historial con antes y después', async () => {
  reiniciar();
  const gestion = await permisos.conceder(parse('concesionPermiso', {
    permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: 9, motivo: 'Coordina los servicios de Soporte con Calibración',
  }), sesion(22));
  assert.deepEqual(gestion.personal.find(p => p.id === 9).permisos.map(p => p.clave), ['tiempos.soporte.ver']);
  const nueva = base.concesiones.at(-1);
  assert.deepEqual([nueva.permiso, nueva.usuario_id, nueva.area, nueva.cargo, nueva.concedido_por],
    ['tiempos.soporte.ver', 9, null, null, 'Barrau']);
  const registro = base.historial.at(-1);
  assert.deepEqual([registro.accion, registro.permiso, registro.concesion, registro.sujeto, registro.usuario, registro.nombre],
    ['CONCEDER', 'tiempos.soporte.ver', nueva.id, 'Bruno Paz', 'Barrau', 'Jhonatan Barrau']);
  assert.deepEqual(JSON.parse(registro.anteriores), ['Jefes de área de todas las áreas']);
  assert.deepEqual(JSON.parse(registro.nuevos), ['Jefes de área de todas las áreas', 'Bruno Paz']);
  assert.equal(registro.motivo, 'Coordina los servicios de Soporte con Calibración');

  // A un grupo: el área se guarda normalizada aunque llegue con tildes.
  await permisos.conceder(parse('concesionPermiso', {
    permiso: 'tiempos.calibracion.ver', tipo: 'GRUPO', area: 'Soporte Técnico', motivo: 'Comparan tiempos entre áreas',
  }), sesion(22));
  assert.deepEqual([base.concesiones.at(-1).area, base.concesiones.at(-1).cargo], ['soporte tecnico', null]);
  assert.equal(base.historial.at(-1).sujeto, 'Todo el personal de Soporte Tecnico');
  assert.equal(await permisos.tienePermiso(sesion(10), 'tiempos.calibracion.ver'), true);
});

test('no se concede dos veces lo mismo, ni a quien no está en el personal, ni a un grupo inexistente', async () => {
  reiniciar();
  const conceder = body => permisos.conceder(parse('concesionPermiso', { motivo: 'Prueba', ...body }), sesion(22));
  await assert.rejects(conceder({ permiso: 'tiempos.soporte.ver', tipo: 'GRUPO', cargo: 'Jefe de Área' }), e => e.statusCode === 409);
  await assert.rejects(conceder({ permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: 404 }), e => e.statusCode === 400);
  await assert.rejects(conceder({ permiso: 'tiempos.soporte.ver', tipo: 'GRUPO', area: 'Marte' }), e => e.statusCode === 400 && /área/.test(e.message));
  await assert.rejects(conceder({ permiso: 'tiempos.soporte.ver', tipo: 'GRUPO', cargo: 'Astronauta' }), e => e.statusCode === 400 && /cargo/.test(e.message));
  await assert.rejects(conceder({ permiso: 'no.existe', tipo: 'GRUPO', cargo: 'Técnico' }), e => e.statusCode === 400);
  assert.equal(base.escrituras, 0);
  // La validación exige el motivo y el sujeto.
  assert.throws(() => parse('concesionPermiso', { permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', usuarioId: 9 }), /por qué se concede/);
  assert.throws(() => parse('concesionPermiso', { permiso: 'tiempos.soporte.ver', tipo: 'PERSONA', motivo: 'x' }), /Elige a la persona/);
  assert.throws(() => parse('concesionPermiso', { permiso: 'tiempos.soporte.ver', tipo: 'GRUPO', motivo: 'x' }), /área, un cargo/);
  assert.throws(() => parse('revocacionPermiso', { motivo: '   ' }), /por qué se revoca/);
});

test('revocar no borra: la concesión queda con quién, cuándo y por qué, y el historial lo registra', async () => {
  reiniciar();
  const gestion = await permisos.revocar(1, parse('revocacionPermiso', { motivo: 'Solo lo ve el jefe de Soporte' }), sesion(22));
  assert.equal(gestion.concesiones.some(c => c.id === 1), false);
  assert.equal(gestion.personal.find(p => p.id === 2).permisos.some(p => p.clave === 'tiempos.soporte.ver'), false);
  const revocada = base.concesiones.find(c => c.id === 1);
  assert.deepEqual([revocada.revocado_por, revocada.motivo_revocacion], ['Barrau', 'Solo lo ve el jefe de Soporte']);
  assert.equal(base.concesiones.length, 2);
  const registro = base.historial.at(-1);
  assert.deepEqual([registro.accion, registro.concesion, registro.sujeto], ['REVOCAR', 1, 'Jefes de área de todas las áreas']);
  assert.deepEqual([JSON.parse(registro.anteriores), JSON.parse(registro.nuevos)], [['Jefes de área de todas las áreas'], []]);
  // Ya revocada o inexistente.
  await assert.rejects(permisos.revocar(1, { motivo: 'otra vez' }, sesion(22)), e => e.statusCode === 409);
  await assert.rejects(permisos.revocar(99, { motivo: 'x' }, sesion(22)), e => e.statusCode === 404);
  // El historial sale del más reciente al más antiguo, con el nombre del permiso.
  const historial = await permisos.obtenerHistorial(sesion(22));
  assert.equal(historial[0].accion, 'REVOCAR');
  assert.equal(historial[0].permisoNombre, 'Ver los tiempos de servicio de Soporte técnico');
  assert.deepEqual(historial[0].antes, ['Jefes de área de todas las áreas']);
  assert.deepEqual(historial[0].despues, []);
});
