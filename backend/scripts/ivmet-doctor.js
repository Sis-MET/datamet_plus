const fs = require('node:fs');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { envFile } = require('../src/config/env-file');
const { HASH_PATTERN } = require('../src/services/ivmet.access-service');
const { readHidden } = require('./ivmet-access-code');

const fields = [
  'IVMET_ENABLED',
  'IVMET_ACCESS_CODE_HASH',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
];
function diagnose(file, processEnv = {}) {
  const effective = { ...file, ...processEnv };
  return {
    archivo: envFile,
    directorioActual: process.cwd(),
    ivmetHabilitado: String(effective.IVMET_ENABLED).toLowerCase() === 'true',
    hashValido: HASH_PATTERN.test(effective.IVMET_ACCESS_CODE_HASH || ''),
    jwtValido: (effective.JWT_SECRET || '').length >= 32,
    urlSupabase: /^https:\/\/[^\s/]+\/?$/.test(effective.SUPABASE_URL || ''),
    claveServidor: Boolean(
      effective.SUPABASE_SECRET_KEY || effective.SUPABASE_SERVICE_ROLE_KEY
    ),
    variablesDelProcesoDistintasAlArchivo: fields.filter(
      (name) =>
        processEnv[name] !== undefined &&
        file[name] !== undefined &&
        processEnv[name] !== file[name]
    ),
  };
}
async function main() {
  if (process.argv.slice(2).some((v) => v !== '--verify-code'))
    throw new Error(
      'Uso: pnpm ivmet:doctor [--verify-code]. No pases contraseñas como argumentos.'
    );
  const file = dotenv.parse(fs.readFileSync(envFile));
  const result = diagnose(file, process.env);
  if (process.argv.includes('--verify-code')) {
    const code = await readHidden(
      'Código IvMET que estás introduciendo (oculto): '
    );
    const effective = { ...file, ...process.env };
    result.coincideConArchivo =
      HASH_PATTERN.test(file.IVMET_ACCESS_CODE_HASH || '') &&
      (await bcrypt.compare(code, file.IVMET_ACCESS_CODE_HASH));
    result.coincideConEstaTerminal =
      result.hashValido &&
      (await bcrypt.compare(code, effective.IVMET_ACCESS_CODE_HASH));
  }
  console.log(JSON.stringify(result, null, 2));
  console.log(
    'Esta comprobación no inspecciona el proceso PM2 ya iniciado. Reinícialo tras corregir su configuración. No compartas tu .env.'
  );
}
if (require.main === module)
  main().catch(() => {
    console.error(
      'No se pudo comprobar el acceso. Revisa que exista backend/.env y utiliza una terminal interactiva con --verify-code.'
    );
    process.exitCode = 1;
  });
module.exports = { diagnose };
