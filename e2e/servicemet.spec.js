import { expect, test } from '@playwright/test';

// Versiones de ServiceMET en Calibración: la API se simula con un estado en
// memoria que aplica las mismas reglas que el backend.

const token = (payload) => `header.${Buffer.from(JSON.stringify({ exp: 4102444800, ...payload })).toString('base64url')}.signature`;

const USUARIOS = {
  jefe: { id: 7, usuario: 'jefe.cal', nombre: 'Jefa', apellido: 'Calibración', cargo: 'Jefe de Area', area: 'Calibración', acceso_cron: 2 },
  sistemas: { id: 22, usuario: 'sistemas', nombre: 'Auxiliar', apellido: 'Sistemas', cargo: 'Auxiliar de Sistemas', area: 'Administración', acceso_cron: 3 },
};

const PERMISOS = {
  jefe: { registrar: false, aprobar: true, ponerEnUso: true },
  sistemas: { registrar: true, aprobar: false, ponerEnUso: true },
};

const base = (overrides) => ({
  commit: null, nuevo: [], corregido: [], impacto: null, registroValidacion: null,
  estado: 'REGISTRADA', validacion: null, validacionResultado: null, validadoPor: null, validadoEn: null,
  decisionObs: null, decididoPor: null, decididoNombre: null, decididoCargo: null, decididoEn: null,
  enUsoDesde: null, dispositivos: null, puestaObs: null, puestaPor: null, puestaEn: null,
  aPosteriori: true, registradoPor: 'migración 014', registradoEn: '2026-10-27T14:00:00Z',
  ...overrides,
});

const estadoInicial = () => ({
  versiones: [
    base({
      id: 9, version: '6.4.1+19', fecha: '2026-10-20', commit: '646ec67', clase: 'A',
      resumen: 'Soporte técnico: una prueba omitida ya no se guarda ni se sube.',
      nuevo: ['El interruptor de las pruebas avisa y guarda en el acto.'],
      corregido: ['Volver a activar la linealidad ya no deja la pantalla en blanco.'],
      impacto: 'Una prueba omitida queda vacía en el registro y no llega a DataMET.',
      registroValidacion: 'VAL-6.4.1+19', estado: 'VALIDADA', validacion: 'flutter test 507/0 y backend 115/0.',
      validacionResultado: 'CONFORME', validadoPor: 'sistemas', validadoEn: '2026-10-27T15:00:00Z',
    }),
    base({
      id: 7, version: '6.3.5+17', fecha: '2026-10-15', commit: '3692570', clase: 'A',
      resumen: 'Ubicación de cada servicio y ficha del instrumento.',
      nuevo: ['Ubicación de cada servicio de calibración y de soporte.'],
      estado: 'EN_USO', validacion: 'Pruebas conformes.', validacionResultado: 'CONFORME', validadoPor: 'sistemas',
      decididoPor: 'jefe.cal', decididoNombre: 'Jefa Calibración', decididoCargo: 'Jefe de Area', decididoEn: '2026-10-16T13:00:00Z',
      enUsoDesde: '2026-10-16', dispositivos: '6 teléfonos',
    }),
  ],
  telefonos: [
    { instalacion: 'a1', version: '6.4.1+19', tecnico: 'Técnico Uno', dispositivo: 'Samsung A54', ultimoReporte: new Date(Date.now() - 3600e3).toISOString() },
    { instalacion: 'b2', version: '6.3.5+17', tecnico: 'Técnico Dos', dispositivo: 'Moto G', ultimoReporte: new Date(Date.now() - 2 * 86400e3).toISOString() },
  ],
  historial: {},
  peticiones: [],
});

const conAcciones = (version, rol) => {
  const permisos = PERMISOS[rol];
  const abierta = ['REGISTRADA', 'VALIDADA'].includes(version.estado);
  const decidir = permisos.aprobar && abierta;
  return {
    ...version,
    acciones: {
      editar: permisos.registrar && abierta,
      validar: permisos.registrar && abierta,
      decidir,
      aprobar: decidir && version.validacionResultado === 'CONFORME',
      ponerEnUso: permisos.ponerEnUso && version.estado === 'APROBADA',
    },
  };
};

const situacion = (version) => {
  if (!version) return 'SIN_REGISTRAR';
  if (['APROBADA', 'EN_USO'].includes(version.estado)) return 'APROBADA';
  return version.estado === 'RECHAZADA' ? 'RECHAZADA' : 'PENDIENTE';
};

async function abrir(page, rol) {
  const estado = estadoInicial();
  const usuario = USUARIOS[rol];
  await page.addInitScript(({ sesion, user }) => {
    if (sessionStorage.getItem('servicemet-spec-ready')) return;
    sessionStorage.setItem('servicemet-spec-ready', '1');
    localStorage.clear();
    localStorage.setItem('datamet_token', sesion);
    localStorage.setItem('datamet_user', JSON.stringify(user));
  }, { sesion: token({ id: usuario.id, usuario: usuario.usuario, acceso_cron: usuario.acceso_cron, cargo: usuario.cargo }), user: usuario });

  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const json = (data) => route.fulfill({ json: { success: true, data } });
    const match = pathname.match(/^\/api\/calibracion\/servicemet(?:\/(\d+))?(?:\/([a-z-]+))?$/);
    if (!match) return route.fulfill({ status: 503, json: { success: false, message: 'Sin simular en la prueba' } });

    const id = match[1] ? Number(match[1]) : null;
    const version = estado.versiones.find(item => item.id === id);
    const body = request.postDataJSON?.() || null;
    if (request.method() !== 'GET') estado.peticiones.push({ method: request.method(), path: pathname, body });
    const registrar = (accion, detalle) => {
      estado.historial[id] = [{ id: Date.now(), accion, detalle, usuario: usuario.usuario, fecha: new Date().toISOString() }, ...(estado.historial[id] || [])];
    };

    if (!id && request.method() === 'GET') {
      const versiones = estado.versiones.map(item => conAcciones(item, rol));
      return json({
        versiones,
        permisos: PERMISOS[rol],
        telefonos: {
          disponible: true,
          dias: 180,
          items: estado.telefonos.map((telefono) => {
            const propia = versiones.find(item => item.version === telefono.version);
            return { ...telefono, versionId: propia?.id ?? null, situacion: situacion(propia) };
          }),
        },
      });
    }
    if (!id && request.method() === 'POST') {
      const nueva = base({ id: 20, ...body, aPosteriori: false, registradoPor: usuario.usuario });
      estado.versiones.unshift(nueva);
      estado.historial[20] = [];
      return json({ id: 20, version: body.version });
    }
    if (id && !match[2]) {
      return json({ ...conAcciones(version, rol), historial: estado.historial[id] || [{ id: 1, accion: 'REGISTRO', detalle: 'Registrada a posteriori', usuario: 'migración 014', fecha: '2026-10-27T14:00:00Z' }] });
    }
    if (match[2] === 'decision') {
      Object.assign(version, body.decision === 'APROBAR'
        ? { estado: 'APROBADA', decididoPor: usuario.usuario, decididoNombre: 'Jefa Calibración', decididoCargo: usuario.cargo, decididoEn: new Date().toISOString(), decisionObs: body.observaciones }
        : { estado: 'RECHAZADA', decididoPor: usuario.usuario, decididoNombre: 'Jefa Calibración', decididoCargo: usuario.cargo, decididoEn: new Date().toISOString(), decisionObs: body.observaciones });
      registrar(body.decision === 'APROBAR' ? 'APROBACION' : 'RECHAZO', body.observaciones);
      return json({ id, estado: version.estado });
    }
    if (match[2] === 'puesta-en-uso') {
      Object.assign(version, { estado: 'EN_USO', enUsoDesde: body.fecha, dispositivos: body.dispositivos, puestaPor: usuario.usuario, puestaEn: new Date().toISOString() });
      registrar('PUESTA_EN_USO', `En uso desde ${body.fecha}`);
      return json({ id, estado: 'EN_USO' });
    }
    return route.fulfill({ status: 404, json: { success: false, message: 'Ruta no simulada' } });
  });

  await page.setViewportSize({ width: 1366, height: 860 });
  await page.goto('/calibracion/servicemet');
  return estado;
}

test('el jefe de Calibración aprueba la versión validada y registra su puesta en uso', async ({ page }) => {
  const estado = await abrir(page, 'jefe');

  // La sección se abre desde la barra lateral y la barra superior la nombra.
  const nav = page.getByRole('navigation', { name: 'Módulos' });
  await expect(nav.getByRole('link', { name: 'Versiones ServiceMET' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: /^Calibración ?: Versiones ServiceMET$/ })).toBeVisible();

  await expect(page.getByRole('heading', { name: /ServiceMET 6\.3\.5\+17 en uso/ })).toBeVisible();
  await expect(page.getByText('La versión 6.4.1+19 está validada y espera tu aprobación.')).toBeVisible();
  // El jefe no registra versiones: eso lo hace Sistemas.
  await expect(page.getByRole('button', { name: 'Registrar versión' })).toHaveCount(0);

  // Un teléfono ya usa la versión sin aprobar.
  const telefonos = page.getByRole('region', { name: 'Teléfonos con ServiceMET' });
  await expect(telefonos.getByText('1 con versión sin aprobar')).toBeVisible();
  await expect(telefonos.getByRole('listitem').filter({ hasText: 'Técnico Uno' }).getByText('Sin aprobar')).toBeVisible();

  await page.getByRole('button', { name: 'Revisar y aprobar' }).click();
  const ficha = page.getByRole('dialog', { name: 'ServiceMET 6.4.1+19' });
  await expect(ficha.getByText('flutter test 507/0 y backend 115/0.')).toBeVisible();
  await expect(ficha.getByText('El interruptor de las pruebas avisa y guarda en el acto.')).toBeVisible();
  await ficha.getByRole('button', { name: 'Aprobar o no aprobar' }).click();

  const decision = page.getByRole('dialog', { name: 'Decisión del jefe de Calibración' });
  await expect(decision.getByRole('button', { name: 'Aprobar para uso' })).toHaveAttribute('aria-pressed', 'true');
  await decision.getByLabel('Observaciones').fill('Conforme al VAL-6.4.1+19.');
  await decision.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(decision).toBeHidden();
  expect(estado.peticiones.at(-1)).toMatchObject({ path: '/api/calibracion/servicemet/9/decision', body: { decision: 'APROBAR', observaciones: 'Conforme al VAL-6.4.1+19.' } });

  await expect(ficha.getByText('Aprobada para uso por')).toBeVisible();
  await ficha.getByRole('button', { name: 'Registrar puesta en uso' }).click();
  const puesta = page.getByRole('dialog', { name: 'Registrar puesta en uso' });
  await puesta.getByLabel('Teléfonos actualizados').fill('Los 6 teléfonos');
  await puesta.getByRole('button', { name: 'Registrar puesta en uso' }).click();
  await expect(puesta).toBeHidden();
  expect(estado.peticiones.at(-1).body).toMatchObject({ dispositivos: 'Los 6 teléfonos' });
  await expect(ficha.getByText(/En uso desde el/)).toBeVisible();

  await ficha.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: /ServiceMET 6\.4\.1\+19 en uso/ })).toBeVisible();
  await expect(telefonos.getByText('Todos con versión aprobada')).toBeVisible();
});

test('Sistemas registra una versión nueva con sus cambios, uno por línea', async ({ page }) => {
  const estado = await abrir(page, 'sistemas');
  await expect(page.getByText('La versión 6.4.1+19 está validada y espera la aprobación del jefe de Calibración.')).toBeVisible();

  await page.getByRole('button', { name: 'Registrar versión' }).click();
  const form = page.getByRole('dialog', { name: 'Registrar versión de ServiceMET' });
  await form.getByLabel('Versión', { exact: true }).fill('6.4.2');
  await form.getByRole('button', { name: 'Registrar versión' }).click();
  await expect(form.getByText(/con su build/).first()).toBeVisible();
  expect(estado.peticiones).toHaveLength(0);

  await form.getByLabel('Versión', { exact: true }).fill('6.4.2+20');
  await form.getByLabel('Commit').fill('ABC1234');
  await form.getByRole('button', { name: 'B · Funcional' }).click();
  await form.getByLabel('Resumen').fill('Ajustes del formulario RIM.');
  await form.getByLabel('Nuevo').fill('- Botón para repetir la firma\n\n• Aviso al quedar sin talonarios');
  await form.getByRole('button', { name: 'Registrar versión' }).click();
  await expect(form).toBeHidden();

  expect(estado.peticiones.at(-1)).toMatchObject({
    method: 'POST',
    path: '/api/calibracion/servicemet',
    body: { version: '6.4.2+20', commit: 'ABC1234', clase: 'B', nuevo: ['Botón para repetir la firma', 'Aviso al quedar sin talonarios'], corregido: [] },
  });
  await expect(page.getByRole('button', { name: /6\.4\.2\+20/ })).toBeVisible();
  await expect(page.getByText('La versión 6.4.2+20 espera su validación antes de pasar al jefe de Calibración.')).toBeVisible();
});
