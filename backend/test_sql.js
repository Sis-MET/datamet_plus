const { sql, getPool } = require('./src/config/db');

async function testUsers() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        usuario,
        ISNULL(NULLIF(LTRIM(RTRIM(CONCAT(nombre1, ' ', apellido1))), ''), usuario) AS nombre,
        cargo,
        area
      FROM DATA_USERS
      ORDER BY nombre1
    `);
    console.log('--- TECNICOS RESULT ---');
    console.log(result.recordset.slice(0, 10)); // first 10
    console.log('Total:', result.recordset.length);
    process.exit(0);
  } catch(e) {
    console.error('SQL ERROR:', e);
    process.exit(1);
  }
}
testUsers();
