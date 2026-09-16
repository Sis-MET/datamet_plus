const test = require('node:test');
const assert = require('node:assert/strict');
// Este fixture no toca servicios ni requiere credenciales externas.
for (const name of [
  'PORT',
  'DB_SERVER',
  'DB_USER',
  'DB_PASSWORD',
  'DB_DATABASE',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
])
  process.env[name] ||=
    name === 'PORT'
      ? '5000'
      : name === 'JWT_EXPIRES_IN'
        ? '15m'
        : 'test-only-not-a-real-credential';
process.env.IVMET_ENABLED = 'false';
const {
  validateAction,
  querySchema,
} = require('../src/services/ivmet.validation');
const {
  createAdminService,
  unwrap,
} = require('../src/services/ivmet.admin-service');
const {
  createCurrentAdminMiddleware,
  requireIvmetAdmin,
} = require('../src/middleware/ivmet.middleware');
const { createLegacyService } = require('../src/services/ivmet.legacy-service');
const id = '00000000-0000-4000-8000-000000000001';
const requestId = '00000000-0000-4000-8000-000000000002';
const userBody = {
  clientId: id,
  username: 'operador.test',
  name: 'Operador Test',
  role: 'cliente_operador',
  plantIds: [id],
  password: 'temporal-test-only-01',
};

test('valida importes como cadenas exactas y prohíbe campos ajenos', () => {
  const input = {
    id,
    clientId: id,
    version: '1',
    amount: '10.25',
    paidOn: '2026-08-27',
    method: 'TRANSFER',
    reference: 'TEST',
  };
  assert.equal(validateAction('payment.record', input).amount, '10.25');
  assert.throws(() =>
    validateAction('payment.record', { ...input, amount: 10.25 })
  );
  assert.throws(() =>
    validateAction('payment.record', { ...input, amount: '10.251' })
  );
  assert.throws(() =>
    validateAction('payment.record', { ...input, actor: 'otro' })
  );
  assert.throws(() => validateAction('user.reserve', {}));
});
test('el plan se crea sin código; el cliente no puede imponerlo', () => {
  const plan = { name: 'Plan de prueba', seats: 5, graceDays: 0 };
  assert.equal(validateAction('plan.save', plan).name, plan.name);
  assert.throws(() => validateAction('plan.save', { ...plan, code: 'MANUAL' }));
  assert.throws(() =>
    validateAction('plan.save', { ...plan, id, version: '1', code: 'CAMBIADO' })
  );
});
test('no admite roles de Métrica, plantas duplicadas o contraseña corta', () => {
  assert.throws(() =>
    validateAction('user.create', { ...userBody, role: 'metrica_admin' })
  );
  assert.throws(() =>
    validateAction('user.create', { ...userBody, plantIds: [id, id] })
  );
  assert.throws(() =>
    validateAction('user.create', { ...userBody, password: '123' })
  );
  assert.throws(() => querySchema.parse({ page: 0 }));
  assert.throws(() => querySchema.parse({ pageSize: 200 }));
});
test('crear usuario reserva UUID y no envía contraseña al RPC', async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data:
          args.action === 'user.reserve'
            ? { id, email: 'reserved@example.invalid' }
            : { id },
        error: null,
      };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: null },
          error: { status: 404 },
        }),
        createUser: async (body) => {
          assert.equal(body.password, userBody.password);
          assert.equal(body.id, id);
          return { data: { user: { id } }, error: null };
        },
      },
    },
  };
  const service = createAdminService({
    getClient: () => client,
    secret: 'test-secret',
  });
  await service.mutate('user.create', userBody, 'RIMMET:test', requestId);
  assert.equal(calls[0].args.action, 'user.reserve');
  assert.equal(calls[1].args.action, 'user.create');
  assert.ok(!JSON.stringify(calls).includes(userBody.password));
  assert.equal(calls[0].args.payload.passwordDigest.length, 64);
});
test('reintenta creación Auth sin duplicar ni borrar una cuenta confirmada', async () => {
  let creates = 0;
  const client = {
    rpc: async (_name, args) => ({
      data:
        args.action === 'user.reserve'
          ? { id, email: 'reserved@example.invalid' }
          : { id },
      error: null,
    }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              id,
              email: 'reserved@example.invalid',
              app_metadata: { ivmet_request: requestId },
            },
          },
          error: null,
        }),
        createUser: async () => {
          creates++;
        },
      },
    },
  };
  await createAdminService({ getClient: () => client, secret: 'test' }).mutate(
    'user.create',
    userBody,
    'RIMMET:test',
    requestId
  );
  assert.equal(creates, 0);
});
test('una falla no confirmada de Auth no intenta finalizar el perfil', async () => {
  const actions = [];
  const client = {
    rpc: async (_name, args) => {
      actions.push(args.action);
      return { data: { id, email: 'reserved@example.invalid' }, error: null };
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: null, error: { status: 503 } }),
        createUser: async () => assert.fail('No debe crear ante incertidumbre'),
      },
    },
  };
  await assert.rejects(
    createAdminService({ getClient: () => client, secret: 'test' }).mutate(
      'user.create',
      userBody,
      'RIMMET:test',
      requestId
    ),
    /verificar/
  );
  assert.deepEqual(actions, ['user.reserve']);
});
test('restablecimiento completado no vuelve a cambiar la contraseña en un reintento', async () => {
  let changes = 0;
  const client = {
    rpc: async (name) => ({
      data: name === 'ivmet_admin_request_result' ? { id } : { id },
      error: null,
    }),
    auth: {
      admin: {
        updateUserById: async () => {
          changes++;
        },
      },
    },
  };
  await createAdminService({ getClient: () => client, secret: 'test' }).mutate(
    'user.reset',
    {
      id,
      clientId: id,
      version: '1',
      reason: 'Prueba',
      password: userBody.password,
    },
    'RIMMET:test',
    requestId
  );
  assert.equal(changes, 0);
});
test('errores de infraestructura no filtran respuestas internas', () => {
  assert.throws(
    () => unwrap({ error: { code: 'XX000', message: 'secret-host-password' } }),
    (error) =>
      error.statusCode === 502 &&
      !JSON.stringify({ message: error.message, code: error.code }).includes(
        'secret'
      )
  );
  assert.throws(
    () => unwrap({ error: { code: 'PGRST202', message: 'missing' } }),
    (error) => error.code === 'IVMET_MIGRATION_REQUIRED'
  );
});
test('revalida nivel 3: acceso revocado en DataMET deniega un JWT viejo', async () => {
  const request = {
    input() {
      return this;
    },
    query: async () => ({ recordset: [{ acceso_cron: '2' }] }),
  };
  let status;
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  };
  await createCurrentAdminMiddleware({
    pool: () => ({ request: () => request }),
  })({ user: { usuario: 'test', acceso_cron: '3' } }, res, () =>
    assert.fail('No debe autorizar')
  );
  assert.equal(status, 403);
  requireIvmetAdmin({ user: { acceso_cron: '1' } }, res, () => assert.fail());
  assert.equal(status, 403);
});
test('alcance legado valida propiedad del cliente antes de solicitar sincronización', async () => {
  const service = createLegacyService();
  service.catalog = async () => ({
    client: { code: '0032' },
    plants: [{ code: '0032-11' }],
    equipment: [{ code: '0032-11-001' }],
  });
  await assert.rejects(
    service.validateScope({
      legacyClientId: 32,
      clientCode: '0032',
      plantCodes: ['0032-11'],
      equipmentCodes: ['0001-01-001'],
    }),
    /alcance/
  );
  await service.validateScope({
    legacyClientId: 32,
    clientCode: '0032',
    plantCodes: ['0032-11'],
    equipmentCodes: ['0032-11-001'],
  });
});

test('incorporación valida DataMET y conserva el nombre verificado en el servidor', async () => {
  const calls = [];
  const service = createAdminService({
    getClient: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return {
          data: name === 'ivmet_admin_request_result' ? null : { id },
          error: null,
        };
      },
    }),
    legacy: { validateScope: async () => ({ name: 'Cliente verificado' }) },
  });
  const payload = {
    legacyClientId: 103,
    clientCode: '0103',
    plantCodes: ['0103-11'],
    equipmentCodes: ['0103-11-001'],
    paidConfirmed: true,
    reason: 'Contrato autorizado',
  };
  await service.mutate('scope.request', payload, 'RIMMET:test', requestId);
  assert.equal(calls[1].args.payload.clientName, 'Cliente verificado');
  assert.equal(calls[1].args.actor, 'RIMMET:test');
  assert.throws(() =>
    validateAction('scope.request', {
      ...payload,
      clientName: 'Nombre impuesto',
    })
  );
});

test('un reintento confirmado no depende de DataMET pero vuelve a verificar su hash en SQL', async () => {
  const actions = [];
  const service = createAdminService({
    getClient: () => ({
      rpc: async (name) => {
        actions.push(name);
        return { data: { id }, error: null };
      },
    }),
    legacy: {
      validateScope: async () =>
        assert.fail(
          'No debe requerir DataMET para recuperar una respuesta confirmada'
        ),
    },
  });
  await service.mutate('scope.request', {}, 'RIMMET:test', requestId);
  assert.deepEqual(actions, [
    'ivmet_admin_request_result',
    'ivmet_admin_mutate',
  ]);
});

test('el reintento operativo exige motivo y no acepta comandos ni actor del navegador', () => {
  assert.equal(
    validateAction('scope.retry', { id, reason: 'Datos corregidos' }).id,
    id
  );
  assert.throws(() => validateAction('scope.retry', { id, reason: '' }));
  assert.throws(() =>
    validateAction('scope.retry', {
      id,
      reason: 'Reintentar',
      command: 'pm2 start',
    })
  );
  assert.equal(querySchema.parse({ scopeId: id }).scopeId, id);
  assert.throws(() => querySchema.parse({ legacyClientId: -1 }));
});
test('habilitar balanzas en lote exige una selección válida', () => {
  const other = '00000000-0000-4000-8000-000000000003';
  assert.deepEqual(
    validateAction('equipment.bulk-configure', { clientId: id, enabled: true, ids: [id, other] }),
    { clientId: id, enabled: true, ids: [id, other] }
  );
  assert.throws(() => validateAction('equipment.bulk-configure', { clientId: id, enabled: true, ids: [] }));
  assert.throws(() => validateAction('equipment.bulk-configure', { clientId: id, enabled: true, ids: [id, id] }));
  assert.throws(() => validateAction('equipment.bulk-configure', { clientId: id, enabled: 'true', ids: [id] }));
  assert.throws(() =>
    validateAction('equipment.bulk-configure', {
      clientId: id,
      enabled: true,
      ids: Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`),
    })
  );
});
