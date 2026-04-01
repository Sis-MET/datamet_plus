require('dotenv').config();
const { connectDB, sql } = require('./src/config/db');

async function test() {
  try {
    const pool = await connectDB();
    // Obtener estructura de columnas de DATA_ACTIVOS
    const result = await pool.request().query(`
      SELECT TOP 3 * FROM DATA_ACTIVOS
      WHERE categoria = 'VEHICULO'
    `);
    console.log('Columns:', Object.keys(result.recordset[0] || {}));
    console.log('Sample rows:', JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

test();
