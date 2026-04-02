const { connectDB } = require('./src/config/db');
const fs = require('fs');

async function run() {
  const pool = await connectDB();
  const res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'DATA_ACTIVOS'");
  fs.writeFileSync('cols.json', JSON.stringify(res.recordset.map(r => r.COLUMN_NAME), null, 2));
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
