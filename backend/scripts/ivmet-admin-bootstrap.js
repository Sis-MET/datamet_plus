// Operación explícita de instalación. No se ejecuta al arrancar el servidor.
const readline = require('node:readline/promises');
async function main() {
  if (!process.stdin.isTTY || process.argv.length > 2)
    throw new Error(
      'Ejecuta pnpm ivmet:admin-bootstrap en una terminal interactiva.'
    );
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let username, name;
  try {
    username = (
      await prompt.question(
        'Usuario existente de RimMET que será administrador IvMET: '
      )
    )
      .trim()
      .toLowerCase();
    name = (await prompt.question('Nombre del administrador: ')).trim();
    if (
      !username ||
      !name ||
      (
        await prompt.question(
          '¿Registrar este primer administrador? Escribe SI: '
        )
      ).trim() !== 'SI'
    )
      throw new Error('Operación cancelada.');
  } finally {
    prompt.close();
  }
  const { connectDB, sql } = require('../src/config/db');
  const { getSupabaseAdminClient } = require('../src/config/supabase');
  const pool = await connectDB();
  try {
    const result = await pool
      .request()
      .input('usuario', sql.VarChar(100), username)
      .query('SELECT acceso_cron FROM dbo.DATA_USERS WHERE usuario=@usuario');
    if (
      result.recordset.length !== 1 ||
      String(result.recordset[0].acceso_cron) !== '3'
    )
      throw new Error('El usuario debe existir y tener acceso_cron 3.');
    const { error } = await getSupabaseAdminClient().rpc(
      'ivmet_bootstrap_admin',
      { target_actor: 'RIMMET:' + username, target_name: name }
    );
    if (error)
      throw new Error(
        error.message === 'ADMIN_ALREADY_BOOTSTRAPPED'
          ? 'Ya existe un administrador. Los permisos siguientes se asignan desde el gestor.'
          : 'No se pudo registrar. Comprueba la migración 202608280002 y la configuración de Supabase.'
      );
    console.log(
      'Administrador IvMET registrado. No se cambiaron contraseñas ni permisos en DataMET.'
    );
  } finally {
    await pool.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
