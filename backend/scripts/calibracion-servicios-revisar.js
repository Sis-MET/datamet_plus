/**
 * Revisa los servicios de calibración que subió ServiceMET (fase 2): los lee
 * con el adaptador de DataMET+ y resume los avisos de calidad de datos.
 * Solo lee; no escribe nada.
 *
 *   node scripts/calibracion-servicios-revisar.js                 → todos
 *   node scripts/calibracion-servicios-revisar.js --anio 2026
 *   node scripts/calibracion-servicios-revisar.js --desde 2026-01-01 --hasta 2026-06-30 --json
 */
const { connectDB, sql } = require('../src/config/db');
const { revisarServicios } = require('../src/services/calibration.servicios');

const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : null;
};

const main = async () => {
  const anio = argumento('anio');
  const desde = argumento('desde') || (anio ? `${anio}-01-01` : null);
  const hasta = argumento('hasta') || (anio ? `${anio}-12-31` : null);
  await connectDB();
  const resumen = await revisarServicios({ desde, hasta });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(resumen, null, 2));
    return;
  }
  const periodo = desde || hasta ? ` (${desde || '…'} a ${hasta || '…'})` : '';
  console.log(`\nServicios${periodo}: ${resumen.total}`);
  console.log(`  leídos sin fallar:      ${resumen.leidos}`);
  console.log(`  con errores (no se podrían calcular): ${resumen.conErrores}`);
  console.log(`  sin avisos para revisar: ${resumen.sinAvisos}`);
  if (resumen.fallos.length) {
    console.log('\nFallos del adaptador:');
    for (const fallo of resumen.fallos.slice(0, 20)) console.log(`  ${fallo.servicio}: ${fallo.mensaje}`);
  }
  console.log('\nAvisos (servicios afectados):');
  for (const aviso of resumen.avisos) {
    console.log(`  [${aviso.nivel}] ${aviso.codigo} (${aviso.seccion}): ${aviso.servicios}`);
    for (const ejemplo of aviso.ejemplos.slice(0, 2)) console.log(`      ${ejemplo.servicio}: ${ejemplo.mensaje}`);
  }
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => sql.close().catch(() => {}));
