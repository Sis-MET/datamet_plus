const { connectDB, sql } = require('../src/config/db');
const { runMigrations } = require('../src/config/migration.service');

const main = async () => {
  await connectDB();
  const executed = await runMigrations();
  console.log(executed.length > 0
    ? `Migraciones aplicadas: ${executed.join(', ')}`
    : 'La base de datos ya está actualizada.');
  await sql.close();
};

main().catch(async error => {
  console.error(error.message);
  try { await sql.close(); } catch { /* sin conexión abierta */ }
  process.exitCode = 1;
});
