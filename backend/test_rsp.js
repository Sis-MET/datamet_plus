require('dotenv').config();
const { connectDB, getPool, sql } = require('./src/config/db');

async function test() {
  try {
    await connectDB();
    const pool = await getPool();
    const currentYear = new Date().getFullYear().toString().slice(-2); // ej. '26' para 2026
    const prefix = `RSP${currentYear}-`;
    
    console.log("PREFIX:", prefix);

    const result = await pool.request()
      .input('prefixLiteral', sql.VarChar, prefix)
      .input('prefixLike', sql.VarChar, `${prefix}%`)
      .query(`
        SELECT ISNULL(MAX(TRY_CAST(REPLACE(codigo_reg, @prefixLiteral, '') AS INT)), 0) as maxId
        FROM DATA_CRONOGRAMA
        WHERE codigo_reg LIKE @prefixLike
      `);
      
    console.log("RESULT:", result.recordset);
    const nextId = result.recordset[0].maxId + 1;
    console.log("NEXT:", `${prefix}${nextId}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
