const test = require('node:test');
const assert = require('node:assert/strict');
Object.assign(process.env, {
  PORT: '5000',
  DB_SERVER: 'isolated.invalid',
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  DB_DATABASE: 'test',
  JWT_SECRET: 'isolated-only-secret-for-tests-123456',
  JWT_EXPIRES_IN: '1h',
  IVMET_ENABLED: 'false',
});
const {
  validateOperation,
  createOperations,
} = require('../src/services/ivmet.operations');
const {
  createStaffMiddleware,
  limitClientRead,
} = require('../src/middleware/ivmet.staff.middleware');
const id = '00000000-0000-4000-8000-000000000001';
test('operaciones no admiten suplantar el actor ni importes numéricos', () => {
  assert.throws(() =>
    validateOperation('case.update', {
      id,
      version: '1',
      status: 'IN_REVIEW',
      comment: 'Comentario',
      actor: 'otro',
    })
  );
  assert.equal(
    validateOperation('staff.save', {
      actor: 'RIMMET:Admin',
      name: 'Admin',
      role: 'support',
      active: true,
    }).actor,
    'RIMMET:admin'
  );
  const plan = {
    name: 'Plan',
    tests: [
      {
        type: 'linearity',
        method: 'absolute_error',
        unit: 'kg',
        frequencyDays: 30,
        warningDays: 7,
        points: [
          {
            code: 'P1',
            label: 'Carga',
            group: 1,
            load: '0.123456789',
            tolerance: '0.000000001',
          },
        ],
      },
    ],
  };
  assert.throws(() => validateOperation('metrology.save', plan), {code:'CUSTOMER_MANAGED_CONFIGURATION',statusCode:403});
  assert.equal(validateOperation('equipment-update.review', {id,version:'1',comment:' Revisado '}).comment, 'Revisado');
  assert.throws(() => validateOperation('equipment-update.review', {id,version:'1',comment:'Revisado',actor:'otro'}));
  assert.throws(() =>
    validateOperation('metrology.save', {
      ...plan,
      tests: [...plan.tests, ...plan.tests],
    })
  );
  assert.throws(() =>
    validateOperation('metrology.save', {
      ...plan,
      tests: [
        {
          ...plan.tests[0],
          points: [{ ...plan.tests[0].points[0], load: 0.1 }],
        },
      ],
    })
  );
});
test('el contrato de operaciones envía el actor autenticado por separado', async () => {
  let sent;
  const service = createOperations({
    getClient: () => ({
      rpc: async (name, args) => {
        sent = { name, args };
        return { data: { id }, error: null };
      },
    }),
  });
  await service.mutate(
    'RIMMET:admin',
    'case.update',
    { id, version: '1', status: 'IN_REVIEW', comment: 'Respuesta' },
    id
  );
  assert.equal(sent.args.actor, 'RIMMET:admin');
  assert.equal(sent.args.payload.actor, undefined);
  assert.throws(
    () => service.read('RIMMET:admin', 'metrology', {}),
    /Invalid option/
  );
});
test('lecturas legadas y administración verifican el permiso individual', async () => {
  let checked,
    passed = false;
  const middleware = createStaffMiddleware({
    authorize: async (actor, capability) => {
      checked = { actor, capability };
      throw Object.assign(new Error('Sin permiso'), {
        statusCode: 403,
        code: 'STAFF_PERMISSION_REQUIRED',
      });
    },
  });
  const res = {
    status(v) {
      this.code = v;
      return this;
    },
    json(v) {
      this.body = v;
    },
  };
  await middleware(
    { path: '/clients', user: { usuario: ' ADMIN ' } },
    res,
    () => {
      passed = true;
    }
  );
  assert.deepEqual(checked, {
    actor: 'RIMMET:admin',
    capability: 'commercial',
  });
  assert.equal(res.code, 403);
  assert.equal(passed, false);
});
test('soporte llega a los casos desde la ficha del cliente, sin abrir lo comercial', async () => {
  const run = async (method, path, capabilities) => {
    let checked,
      passed = false;
    const middleware = createStaffMiddleware({
      authorize: async (actor, capability) => {
        checked = capability;
        if (capability && !capabilities.includes(capability))
          throw Object.assign(new Error('Sin permiso'), {
            statusCode: 403,
            code: 'STAFF_PERMISSION_REQUIRED',
          });
        return { actor, role: 'support', capabilities };
      },
    });
    const req = { method, path, user: { usuario: 'Soporte' } };
    const res = {
      status(v) {
        this.code = v;
        return this;
      },
      json(v) {
        this.body = v;
      },
    };
    await middleware(req, res, () => {
      passed = true;
    });
    return { checked, passed, code: res.code, body: res.body, req };
  };
  for (const path of ['/clients', `/clients/${id}`]) {
    const result = await run('GET', path, ['support']);
    assert.equal(result.checked, null, path);
    assert.equal(result.passed, true, path);
    assert.deepEqual(result.req.ivmetStaff.capabilities, ['support']);
  }
  for (const path of [
    `/clients/${id}/equipment`,
    `/clients/${id}/users`,
    `/clients/${id}/activity`,
    '/overview',
    '/legacy/clients',
  ]) {
    const result = await run('GET', path, ['support']);
    assert.equal(result.passed, false, path);
    assert.equal(result.code, 403, path);
  }
  assert.equal((await run('POST', '/clients', ['support'])).checked, 'commercial');
  const outsider = await run('GET', '/clients', ['integration']);
  assert.equal(outsider.passed, false);
  assert.equal(outsider.code, 403);
  assert.equal(outsider.body.code, 'STAFF_PERMISSION_REQUIRED');
});
test('la ficha limitada no expone contratos, cobros, licencias ni incorporaciones', () => {
  const directory = {
    total: 2,
    page: 1,
    pageSize: 20,
    items: [
      { id, codigo: '0001', nombre: 'Cliente', razon_social: 'Cliente SA', activo: true,
        synced_at: '2026-09-01', scope_id: id, plants: 2, equipment: 3, review: 1, licenses: 4,
        newCases: 2, pendingUpdates: 1, onboarding: { syncStatus: 'SUCCEEDED', plants: ['0001-01'] } },
      { id: null, codigo: '0002', nombre: 'En incorporación', scope_id: id, plants: 0,
        equipment: 0, review: 0, licenses: 0, newCases: 0, pendingUpdates: 0, onboarding: { syncStatus: 'QUEUED' } },
    ],
  };
  const limited = limitClientRead('clients', directory, ['support']);
  assert.equal(limited.total, 2);
  assert.deepEqual(limited.items[0], {
    id, codigo: '0001', nombre: 'Cliente', razon_social: 'Cliente SA', activo: true,
    plants: 2, equipment: 3, review: 1, newCases: 2, pendingUpdates: 1,
  });
  assert.equal(limited.items[1].id, null);
  assert.ok(!JSON.stringify(limited).includes('licenses'));
  assert.ok(!JSON.stringify(limited).includes('onboarding'));
  const workspace = {
    client: { id, codigo: '0001', nombre: 'Cliente', razon_social: 'Cliente SA', activo: true, legacy_cliente_id: 1 },
    plants: [{ id, cliente_id: id, legacy_codigo_planta: '0001-01', nombre: 'Planta', activo: true, source_hash: 'x' }],
    contracts: [{ id }],
    subscriptions: [{ id }],
    invoices: [{ id, total: '350.00' }],
    attention: { newCases: 2, pendingUpdates: 1 },
  };
  assert.deepEqual(limitClientRead('client', workspace, ['metrology', 'support']), {
    client: { id, codigo: '0001', nombre: 'Cliente', razon_social: 'Cliente SA', activo: true },
    plants: [{ id, legacy_codigo_planta: '0001-01', nombre: 'Planta', activo: true }],
    attention: { newCases: 2, pendingUpdates: 1 },
  });
  // Sin capacidades conocidas se limita igual: falla cerrado.
  const unknown = limitClientRead('client', workspace);
  assert.equal(unknown.invoices, undefined);
  assert.equal(unknown.attention, undefined);
  assert.equal(limitClientRead('clients', directory).items[0].newCases, undefined);
  assert.equal(limitClientRead('overview', directory, ['support']), directory);
});
test('los avisos de lo compartido son de soporte; la gestión comercial conserva su ficha', () => {
  const directory = {
    total: 1,
    items: [{ id, codigo: '0001', licenses: 4, newCases: 2, pendingUpdates: 1, onboarding: null }],
  };
  assert.deepEqual(limitClientRead('clients', directory, ['commercial', 'integration']).items[0], {
    id, codigo: '0001', licenses: 4, onboarding: null,
  });
  const workspace = { client: { id }, plants: [], invoices: [{ id }], attention: { newCases: 2, pendingUpdates: 1 } };
  assert.deepEqual(limitClientRead('client', workspace, ['commercial']), {
    client: { id }, plants: [], invoices: [{ id }],
  });
  // Administración ve todo y sin copias intermedias.
  const all = ['commercial', 'support', 'integration', 'staff'];
  assert.equal(limitClientRead('clients', directory, all), directory);
  assert.equal(limitClientRead('client', workspace, all), workspace);
});
