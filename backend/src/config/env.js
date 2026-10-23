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

// Los RIM viven en la misma base DB_DATABASE (DataMET; DataMET_prueba en
// pruebas). RIM_DB_NAME ya no se usa: si quedó en el .env, se ignora.
const rimDbAnterior = String(process.env.RIM_DB_NAME || '').trim();
if (rimDbAnterior && rimDbAnterior !== process.env.DB_DATABASE.trim()) {
  console.warn(`RIM_DB_NAME=${rimDbAnterior} se ignora: los RIM se leen de DB_DATABASE (${process.env.DB_DATABASE.trim()}). Quítela del .env.`);
}

const smtpPort = Number(process.env.SMTP_PORT) || 587;
const flag = (value, fallback) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true';
};

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
  // Correo saliente (alertas de calibración). Sin SMTP_HOST el envío queda
  // desactivado y las alertas solo se ven dentro del cronograma.
  smtp: {
    host: String(process.env.SMTP_HOST || '').trim(),
    port: smtpPort,
    secure: flag(process.env.SMTP_SECURE, smtpPort === 465),
    user: String(process.env.SMTP_USER || '').trim(),
    password: process.env.SMTP_PASSWORD || '',
    from: String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim(),
    rejectUnauthorized: flag(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true),
  },
  // Registros RIM: tablas de los scripts 012, 014 y 016 de ServiceMET, en la
  // misma base DB_DATABASE.
  rim: {
    database: process.env.DB_DATABASE.trim(),
  },
  // Soporte técnico: mejora de redacción de los informes (Google Gemini).
  // Sin clave, la función queda deshabilitada.
  gemini: {
    apiKey: String(process.env.GEMINI_API_KEY || '').trim(),
    model: String(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim(),
    modeloRespaldo: String(process.env.GEMINI_MODEL_RESPALDO || 'gemini-3.5-flash').trim(),
  },
  calibration: {
    alertsEnabled: flag(process.env.CAL_ALERTS_ENABLED, true),
    // Enlace al cronograma que se incluye en los correos (opcional).
    appUrl: String(process.env.APP_URL || '').trim(),
  },
  // Soporte técnico: correo diario de los próximos servicios (mismo SMTP).
  soporte: {
    alertsEnabled: flag(process.env.ST_ALERTS_ENABLED, true),
    documentosDir: String(process.env.ST_DOCUMENTOS_DIR || '').trim(),
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
