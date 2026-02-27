require('dotenv').config();

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

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
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
  }
};
