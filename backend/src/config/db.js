const sql = require('mssql');
const env = require('./env');

let pool;

const connectDB = async () => {
  try {
    if (pool) return pool;

    pool = await sql.connect(env.db);
    console.log(`✅ Conectado a SQL Server en ${env.db.server} (Base: ${env.db.database})`);
    
    return pool;
  } catch (error) {
    console.error('❌ Error fatal al conectar a SQL Server:', error.message);
    // En producción podrías querer que no finalice o reintente. Para este boilerplate inicial, fallar rápido es mejor.
    process.exit(1);
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('La conexión a la BD no ha sido inicializada. Llama a connectDB primero.');
  }
  return pool;
};

module.exports = {
  connectDB,
  getPool,
  sql // Exportamos la librería original para tener Types, inputs, etc a la mano
};
