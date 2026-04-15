const sql = require('mssql');
const env = require('./env');

let poolMain;

const connectDB = async () => {
  try {
    if (!poolMain) {
      poolMain = await sql.connect(env.db);
      console.log(`✅ Conectado a SQL Server en ${env.db.server} (Base: ${env.db.database})`);
    }

    return poolMain;
  } catch (error) {
    console.error('❌ Error fatal al conectar a SQL Server:', error.message);
    process.exit(1);
  }
};

const getPool = () => {
  if (!poolMain) {
    throw new Error('La conexión a la BD no ha sido inicializada. Llama a connectDB primero.');
  }

  return poolMain;
};

module.exports = {
  connectDB,
  getPool,
  sql // Exportamos la librería original para tener Types, inputs, etc a la mano
};
