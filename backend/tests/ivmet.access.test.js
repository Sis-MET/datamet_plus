const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createAccessService } = require('../src/services/ivmet.access-service');

// Credenciales ficticias. No se conectan SQL Server, Supabase ni otros servidores.
const code = 'preview-only*2026';
const secret = 'isolated-test-session-secret-not-for-production';
const codeHash = bcrypt.hashSync(code, 10);
const start = Date.UTC(2026, 7, 27, 12);
const user = {
  usuario: 'Admin.Test',
  acceso_cron: '3',
  exp: start / 1000 + 7200,
};
const context = { user, authorization: 'Bearer isolated-login-session' };
const makeService = (options = {}) =>
  createAccessService({
    secret,
    codeHash,
    now: () => start,
    ...options,
  });
const unlock = (service, extra = {}) =>
  service.unlock({ ...context, body: { code }, ...extra });

test('bcrypt exacto: código correcto, mayúsculas y asterisco; respuesta sin secretos', async () => {
  const service = makeService();
  for (const wrong of [code.toUpperCase(), code.replace('*', ''), `${code} `]) {
    await assert.rejects(unlock(service, { body: { code: wrong } }), {
      code: 'IVMET_ACCESS_INVALID_CODE',
    });
  }
  const grant = await unlock(service);
  assert.deepEqual(Object.keys(grant).sort(), ['expiresAt', 'ticket']);
  assert.equal(grant.expiresAt, new Date(start + 3600000).toISOString());
  assert.equal(
    service.status({ ...context, ticket: grant.ticket }).unlocked,
    true,
  );
  assert.ok(!JSON.stringify(grant).includes(code));
  assert.ok(!JSON.stringify(grant).includes(codeHash));
});

test('solo nivel 3 y sesión vigente; la concesión no amplía la sesión principal', async () => {
  const service = makeService();
  for (const role of [undefined, '1', '2', 'admin']) {
    await assert.rejects(
      unlock(service, { user: { ...user, acceso_cron: role } }),
      { statusCode: 403 },
    );
  }
  for (const auth of ['', undefined]) {
    await assert.rejects(unlock(service, { authorization: auth }), {
      statusCode: 403,
    });
  }
  const grant = await unlock(service, {
    user: { ...user, exp: start / 1000 + 60 },
  });
  assert.equal(grant.expiresAt, new Date(start + 60000).toISOString());
  await assert.rejects(
    unlock(service, { user: { ...user, exp: start / 1000 } }),
    { statusCode: 401 },
  );
});

test('sin hash o con configuración inválida falla cerrado solo el acceso IvMET', async () => {
  for (const config of [
    { codeHash: '' },
    { codeHash: 'invalid' },
    { secret: '' },
  ]) {
    const service = makeService(config);
    assert.deepEqual(service.status(context), {
      configured: false,
      unlocked: false,
      expiresAt: null,
    });
    await assert.rejects(unlock(service), {
      statusCode: 503,
      code: 'IVMET_ACCESS_NOT_CONFIGURED',
    });
  }
});

test('rechaza campos adicionales y códigos que exceden los 72 bytes de bcrypt', async () => {
  for (const body of [
    null,
    {},
    { code: 3 },
    { code: '' },
    { code, role: '3' },
    { code: 'a'.repeat(73) },
    { code: 'á'.repeat(37) },
  ]) {
    let compared = false;
    const service = makeService({
      compare: async () => {
        compared = true;
        return true;
      },
    });
    await assert.rejects(unlock(service, { body }), { statusCode: 422 });
    assert.equal(compared, false);
  }
});

test('cinco intentos por usuario, sin evasión por mayúsculas o cambio de sesión, durante 15 minutos', async () => {
  let time = start;
  let comparisons = 0;
  const service = makeService({
    now: () => time,
    compare: async () => {
      comparisons++;
      return false;
    },
  });
  for (let index = 0; index < 5; index++) {
    await assert.rejects(unlock(service), { statusCode: 403 });
  }
  await assert.rejects(
    unlock(service, {
      user: { ...user, usuario: 'ADMIN.TEST' },
      authorization: 'Bearer another-session',
    }),
    { statusCode: 429, retryAfter: 900 },
  );
  assert.equal(comparisons, 5);
  time += 900000;
  await assert.rejects(unlock(service), { statusCode: 403 });
  assert.equal(comparisons, 6);
});

test('intentos concurrentes reservan cupo antes de ejecutar bcrypt', async () => {
  let comparisons = 0;
  const service = makeService({
    compare: async () => {
      comparisons++;
      return false;
    },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => unlock(service)),
  );
  assert.equal(comparisons, 5);
  assert.equal(
    results.filter((result) => result.reason?.statusCode === 429).length,
    7,
  );
});

test('pase ligado al usuario, rol, sesión exacta, firma y vencimiento', async () => {
  let time = start;
  const service = makeService({ now: () => time });
  const { ticket } = await unlock(service);
  for (const extra of [
    { user: { ...user, usuario: 'another-user' } },
    { user: { ...user, acceso_cron: '2' } },
    { authorization: 'Bearer another-session' },
    { authorization: '' },
    { ticket: ticket.slice(0, -12) + 'invalid-signature' },
    { ticket: jwt.sign({ ...user }, secret) },
  ])
    assert.equal(
      service.status({ ...context, ticket, ...extra }).unlocked,
      false,
    );
  // El pase del módulo tampoco puede sustituir al JWT principal.
  assert.throws(() => jwt.verify(ticket, secret));
  time += 3600000;
  assert.equal(service.status({ ...context, ticket }).unlocked, false);
});

test('rotar el hash del código o el secreto principal invalida concesiones anteriores', async () => {
  const { ticket } = await unlock(makeService());
  const changedHash = bcrypt.hashSync('different-test-code', 10);
  for (const service of [
    makeService({ codeHash: changedHash }),
    makeService({ secret: secret + '-new' }),
  ]) {
    assert.equal(service.status({ ...context, ticket }).unlocked, false);
  }
});

test('HTTP: toda la API IvMET exige login, nivel actual 3 y código; no afecta otras rutas', async (t) => {
  Object.assign(process.env, {
    PORT: '5000',
    DB_SERVER: 'isolated.invalid',
    DB_USER: 'test',
    DB_PASSWORD: 'test',
    DB_DATABASE: 'test',
    JWT_SECRET: secret,
    JWT_EXPIRES_IN: '1h',
    IVMET_ENABLED: 'true',
    SUPABASE_URL: 'https://isolated.invalid',
    SUPABASE_SECRET_KEY: 'test-only',
    IVMET_ACCESS_CODE_HASH: codeHash,
  });
  let currentRole = '3';
  let controllerCalls = 0;
  const dbId = require.resolve('../src/config/db');
  const controllerId = require.resolve('../src/controllers/ivmet.controller');
  const previousDb = require.cache[dbId];
  const previousController = require.cache[controllerId];
  const supabaseId = require.resolve('../src/config/supabase');
  const previousSupabase = require.cache[supabaseId];
  require.cache[supabaseId] = { id:supabaseId,loaded:true,exports:{getSupabaseAdminClient:()=>({rpc:async()=>({data:{role:'admin',capabilities:['commercial','support','integration','staff']},error:null})})} };
  require.cache[dbId] = {
    id: dbId,
    loaded: true,
    exports: {
      sql: { VarChar: () => null },
      getPool: () => ({
        request: () => ({
          input() {
            return this;
          },
          // Sirve a la sesión (`protect`) y al nivel actual de IvMET.
          query: async () => ({ recordset: [{ id: 1, usuario: user.usuario, estado: 'ACTIVO', acceso_cron: currentRole }] }),
        }),
      }),
    },
  };
  const handlers = [
    'getOverview',
    'getClients',
    'getPlans',
    'getUpgradeRequests',
    'getIntegration',
    'getOnboarding',
    'getClient',
    'getEquipment',
    'getUsers',
    'getActivity',
    'searchLegacy',
    'legacyCatalog',
    'mutate',
    'getOperations',
    'mutateOperations',
  ];
  require.cache[controllerId] = {
    id: controllerId,
    loaded: true,
    exports: Object.fromEntries(
      handlers.map((name) => [
        name,
        (_req, res) => {
          controllerCalls++;
          res.json({ success: true });
        },
      ]),
    ),
  };
  t.after(() => {
    if (previousSupabase) require.cache[supabaseId] = previousSupabase;
    else delete require.cache[supabaseId];
    if (previousDb) require.cache[dbId] = previousDb;
    else delete require.cache[dbId];
    if (previousController) require.cache[controllerId] = previousController;
    else delete require.cache[controllerId];
  });
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/ivmet', require('../src/routes/ivmet.routes'));
  app.get('/api/other-module', (_req, res) => res.sendStatus(200));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = jwt.sign({ usuario: user.usuario, acceso_cron: '3' }, secret, {
    expiresIn: '1h',
  });
  const request = (path, { token = login, ticket, body } = {}) =>
    fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(ticket ? { 'X-Ivmet-Access': ticket } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal(
    (await request('/api/other-module', { token: null })).status,
    200,
  );
  assert.equal(
    (await request('/api/ivmet/overview', { token: null })).status,
    401,
  );
  // El nivel que cuenta es el de DATA_USERS, no el que dice el token.
  const lowRoleToken = jwt.sign(
    { usuario: user.usuario, acceso_cron: '2' },
    secret,
  );
  currentRole = '2';
  assert.equal(
    (
      await request('/api/ivmet/access/unlock', {
        token: lowRoleToken,
        body: { code },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/api/ivmet/access/unlock', {
        body: { code },
      })
    ).status,
    403,
    'un token de nivel 3 no basta si el usuario ya no es nivel 3',
  );
  currentRole = '3';
  const status = await request('/api/ivmet/access');
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await status.json()).data, {
    configured: true,
    unlocked: false,
    expiresAt: null,
  });
  const routes = [
    'overview',
    'clients',
    'plans',
    'upgrade-requests',
    'integration',
    'onboarding',
    'clients/1',
    'clients/1/equipment',
    'clients/1/users',
    'clients/1/activity',
    'legacy/clients',
    'legacy/clients/1/catalog',
  ];
  for (const path of routes) {
    const response = await request('/api/ivmet/' + path);
    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).code, 'IVMET_ACCESS_CODE_REQUIRED');
  }
  assert.equal(
    (await request('/api/ivmet/actions/plan.save', { body: { payload: {} } }))
      .status,
    403,
  );
  assert.equal(controllerCalls, 0);
  const invalid = await request('/api/ivmet/access/unlock', {
    body: { code: 'wrong' },
  });
  assert.equal(invalid.status, 403);
  const granted = await request('/api/ivmet/access/unlock', { body: { code } });
  assert.equal(granted.status, 200);
  assert.equal(granted.headers.get('cache-control'), 'no-store');
  const { ticket } = (await granted.json()).data;
  for (const path of routes)
    assert.equal((await request('/api/ivmet/' + path, { ticket })).status, 200);
  assert.equal(
    (
      await request('/api/ivmet/actions/plan.save', {
        ticket,
        body: { payload: {} },
      })
    ).status,
    200,
  );
  const expectedCalls = routes.length + 1;
  assert.equal(controllerCalls, expectedCalls);
  currentRole = '2';
  const revoked = await request('/api/ivmet/overview', { ticket });
  assert.equal(revoked.status, 403);
  assert.equal((await revoked.json()).code, 'IVMET_ACCESS_DENIED');
  assert.equal(
    (await request('/api/ivmet/access/unlock', { body: { code } })).status,
    403,
  );
  assert.equal(controllerCalls, expectedCalls);
});

test('middleware comunica Retry-After y no filtra errores internos', async () => {
  const {
    createAccessMiddleware,
  } = require('../src/middleware/ivmet.access.middleware');
  for (const rateLimit of [true, false]) {
    let status;
    let output;
    const headers = {};
    const res = {
      set(name, value) {
        headers[name] = value;
        return this;
      },
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        output = value;
        return this;
      },
    };
    const service = {
      unlock: async () => {
        if (rateLimit)
          throw Object.assign(new Error('Espera'), {
            statusCode: 429,
            retryAfter: 900,
            code: 'IVMET_ACCESS_RATE_LIMITED',
          });
        throw new Error('private-code-hash-or-credential');
      },
    };
    await createAccessMiddleware(service).unlock({ headers: {}, user }, res);
    assert.equal(status, rateLimit ? 429 : 503);
    assert.equal(headers['Cache-Control'], 'no-store');
    if (rateLimit) assert.equal(headers['Retry-After'], '900');
    assert.ok(!JSON.stringify(output).includes('private-code'));
  }
});
