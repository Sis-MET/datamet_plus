const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { envFile, loadEnvFile } = require('../src/config/env-file');
const { diagnose } = require('../scripts/ivmet-doctor');

test('la ruta .env no depende del directorio desde el que PM2 arranca', () => {
  assert.equal(envFile, path.resolve(__dirname, '../.env'));
  const target = {};
  loadEnvFile({
    path: path.join(__dirname, 'fixtures/ivmet-config.env'),
    processEnv: target,
  });
  assert.equal(target.IVMET_ENABLED, 'true');
});
test('diagnóstico no revela secretos y distingue las variables heredadas', () => {
  const result = diagnose(
    {
      IVMET_ENABLED: 'true',
      JWT_SECRET: 'x'.repeat(32),
      SUPABASE_SERVICE_ROLE_KEY: 'private-do-not-print',
      SUPABASE_URL: 'https://example.invalid',
    },
    { IVMET_ENABLED: 'false' }
  );
  assert.equal(result.ivmetHabilitado, false);
  assert.deepEqual(result.variablesDelProcesoDistintasAlArchivo, [
    'IVMET_ENABLED',
  ]);
  assert.ok(!JSON.stringify(result).includes('private-do-not-print'));
});

test('Supabase sin configurar bloquea IvMET sin impedir que Cronograma arranque', () => {
  const loader = require('../src/config/env-file'),
    originalLoader = loader.loadEnvFile;
  const originalEnv = { ...process.env },
    originalWarn = console.warn;
  try {
    loader.loadEnvFile = () => ({});
    console.warn = () => {};
    Object.assign(process.env, {
      PORT: '5000',
      DB_SERVER: 'isolated.invalid',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_DATABASE: 'test',
      JWT_SECRET: 'x'.repeat(32),
      JWT_EXPIRES_IN: '1h',
      IVMET_ENABLED: 'true',
      SUPABASE_URL: '',
      SUPABASE_SECRET_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    });
    const settings = require('../src/config/env');
    assert.equal(settings.ivmet.enabled, true);
    assert.equal(settings.ivmet.configurationReady, false);
    assert.equal(settings.port, '5000');
  } finally {
    loader.loadEnvFile = originalLoader;
    console.warn = originalWarn;
    for (const key of Object.keys(process.env))
      if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    delete require.cache[require.resolve('../src/config/env')];
  }
});
