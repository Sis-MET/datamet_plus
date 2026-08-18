const fs = require('node:fs/promises');
const path = require('node:path');
const { getPool, sql } = require('./db');

const MIGRATIONS_DIRECTORY = path.join(__dirname, 'migrations');

const ensureMigrationTable = async (pool) => {
  await pool.request().query(`
    IF OBJECT_ID('dbo.SCHEMA_MIGRATIONS', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SCHEMA_MIGRATIONS (
        version VARCHAR(20) NOT NULL PRIMARY KEY,
        file_name NVARCHAR(260) NOT NULL,
        applied_at DATETIME2 NOT NULL CONSTRAINT DF_SCHEMA_MIGRATIONS_APPLIED_AT DEFAULT SYSUTCDATETIME()
      );
    END;
  `);
};

const runMigrations = async () => {
  const pool = getPool();
  await ensureMigrationTable(pool);

  const files = (await fs.readdir(MIGRATIONS_DIRECTORY))
    .filter(file => /^\d+_.+\.sql$/i.test(file))
    .sort((a, b) => a.localeCompare(b));

  const appliedResult = await pool.request().query('SELECT version FROM dbo.SCHEMA_MIGRATIONS');
  const applied = new Set(appliedResult.recordset.map(row => String(row.version)));
  const executed = [];

  for (const file of files) {
    const version = file.split('_')[0];
    if (applied.has(version)) continue;

    const script = await fs.readFile(path.join(MIGRATIONS_DIRECTORY, file), 'utf8');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction).batch(script);
      await new sql.Request(transaction)
        .input('version', sql.VarChar(20), version)
        .input('file', sql.NVarChar(260), file)
        .query('INSERT INTO dbo.SCHEMA_MIGRATIONS (version, file_name) VALUES (@version, @file)');
      await transaction.commit();
      executed.push(file);
    } catch (error) {
      try { await transaction.rollback(); } catch { /* la migración puede haber revertido la transacción */ }
      throw new Error(`Falló la migración ${file}: ${error.message}`);
    }
  }

  return executed;
};

module.exports = { runMigrations };
