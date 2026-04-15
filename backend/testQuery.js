const { connectDB, sql } = require('./src/config/db');

async function run() {
  try {
    const pool = await connectDB();
    console.log("Conectado");
    const result = await pool.request()
      .query(`
        SELECT TOP 15
          cot.cod_cotizacion,
          cot.cod_contacto,
          LEFT(
            cot.cod_contacto,
            LEN(cot.cod_contacto) - CHARINDEX('-', REVERSE(cot.cod_contacto))
          ) AS codigo_planta,
          ISNULL(c.cliente, '')    AS nombre_cliente,
          ISNULL(p.dir, '')        AS nombre_planta
        FROM DataMET_prueba.dbo.DATA_COTIZACIONES cot
        LEFT JOIN DataMET_prueba.dbo.DATA_PLANTAS p
          ON p.codigo_planta = LEFT(
               cot.cod_contacto,
               LEN(cot.cod_contacto) - CHARINDEX('-', REVERSE(cot.cod_contacto))
             )
        LEFT JOIN DataMET_prueba.dbo.DATA_CLIENTES c
          ON c.codigo_cliente = p.cliente_id
      `);
    console.log("Exitoso:", result.recordset);
  } catch (err) {
    console.error("ERROR QUERY:", err.message);
  }
  process.exit(0);
}

run();
