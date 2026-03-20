require('dotenv').config({ path: __dirname + '/.env' });
const sql = require('mssql');
const { connectDB } = require('./src/config/db');

async function setup() {
  try {
    const pool = await connectDB();
    console.log('Creando tabla en la base de datos...');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DATA_SCHEDULE_V2]') AND type in (N'U'))
      BEGIN
          CREATE TABLE [dbo].[DATA_SCHEDULE_V2] (
              id INT IDENTITY(1,1) PRIMARY KEY,
              id_usuario INT NULL,
              usuario VARCHAR(200) NULL,
              vehiculo VARCHAR(100) NULL,
              fecha DATE,
              manana NVARCHAR(500) NULL,
              tarde NVARCHAR(500) NULL,
              color_am VARCHAR(10) NULL,
              color_pm VARCHAR(10) NULL,
              creado_por VARCHAR(100) NULL,
              fecha_creacion DATETIME DEFAULT GETDATE(),
              actualizado_por VARCHAR(100) NULL,
              fecha_modificacion DATETIME NULL
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
