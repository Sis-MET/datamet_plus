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
