require('./env-file').loadEnvFile();

const requiredEnvVars = [
  'PORT',
  'DB_SERVER',
  'DB_USER',
  'DB_PASSWORD',
  'DB_DATABASE',
  'JWT_SECRET',
  'JWT_EXPIRES_IN'
];

const checkEnv = () => {
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.error('CRITICAL ERROR: Missing the following required environment variables:');
    console.error(missingVars.join(', '));
    process.exit(1);
  }
};

// Se ejecuta la validación al importar el módulo
checkEnv();

const configuredCorsOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const ivmetEnabled = String(process.env.IVMET_ENABLED || 'false').toLowerCase() === 'true';

const missingIvmetVars = [];
if (ivmetEnabled) {
  if (!process.env.SUPABASE_URL) missingIvmetVars.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missingIvmetVars.push('SUPABASE_SECRET_KEY');
  }

  if (missingIvmetVars.length > 0) {
    // Una configuración incompleta de IvMET no debe derribar Cronograma/RimMET.
    console.warn('IvMET no disponible: faltan variables ' + missingIvmetVars.join(', '));
  }
}

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: configuredCorsOrigins.length > 0
    ? configuredCorsOrigins
    : process.env.NODE_ENV === 'production' ? false : '*',
  db: {
    server: process.env.DB_SERVER.trim(),
    user: process.env.DB_USER.trim(),
    password: process.env.DB_PASSWORD.trim(),
    database: process.env.DB_DATABASE.trim(),
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    port: 1433,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    // Pool configuration
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN
  },
  ivmet: {
    enabled: ivmetEnabled,
    configurationReady: missingIvmetVars.length === 0,
    // Sin hash válido el módulo permanece bloqueado; las otras API siguen disponibles.
    accessCodeHash: process.env.IVMET_ACCESS_CODE_HASH || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  }
};
