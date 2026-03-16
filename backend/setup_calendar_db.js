require('dotenv').config({ path: __dirname + '/.env' });
const sql = require('mssql');
const { connectDB } = require('./src/config/db');

async function setup() {
  try {
    const pool = await connectDB();
    console.log('Creando tabla en la base de datos...');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DATA_SCHEDULE]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DATA_SCHEDULE] (
              id INT IDENTITY(1,1) PRIMARY KEY,
              Tecnico VARCHAR(100),
              fecha_inicio DATE,
              fecha_fin DATE,
              tipo VARCHAR(50),
              estado VARCHAR(50),
              cod_metrica VARCHAR(100),
              descripcion VARCHAR(255),
              cliente VARCHAR(200),
              codigo_cliente INT,
              codigo_planta VARCHAR(50)
          );
      END
    `);
    console.log('✅ Tabla [dbo].[DATA_SCHEDULE] verificada/creada');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando la estructura:', error);
    process.exit(1);
  }
}

setup();
