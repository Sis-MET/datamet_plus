/**
 * Cumplimiento de la NB/ISO/IEC 17025:2018 (puntos 7.5, 7.11 y 8.4) del
 * módulo Calibración.
 *
 * gatherFacts() reúne datos de la base y del entorno solo con lecturas;
 * evaluateCompliance() es pura y decide el estado de cada requisito. Los
 * requisitos están resumidos con palabras propias, no son el texto de la
 * norma (ver la skill .claude/skills/nb-iso-17025).
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { getPool, sql } = require('../config/db');
const env = require('../config/env');
const { IS_ACTIVE } = require('./calibration.db');

const MIGRATIONS_DIRECTORY = path.join(__dirname, '../config/migrations');

const ESTADOS = ['CUMPLE', 'PARCIAL', 'NO_CUMPLE', 'LABORATORIO'];
const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'];

// ─── Datos (solo lectura) ──────────────────────────────────────────────────

// Una consulta que falla (tabla ausente, sin permiso sobre msdb) deja su dato
// en null: la evaluación lo trata como «no se pudo comprobar».
const safe = async (work) => {
  try {
    return await work();
  } catch {
    return null;
  }
};

const first = async (query) => (await getPool().request().query(query)).recordset[0];

const blank = (column) => `NULLIF(LTRIM(RTRIM(REPLACE(${column}, NCHAR(160), N' '))), '')`;
const normalized = (column) => `UPPER(LTRIM(RTRIM(REPLACE(${column}, NCHAR(160), N' '))))`;
const hasNbsp = (column) => `${column} LIKE N'%' + NCHAR(160) + N'%'`;

const readBaseDatos = () => first(`
  SELECT
    DB_NAME() AS nombre,
    CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(40)) AS version,
    CAST(SERVERPROPERTY('Edition') AS nvarchar(80)) AS edicion,
    (SELECT recovery_model_desc FROM sys.databases WHERE name = DB_NAME()) AS recuperacion,
    (SELECT CAST(SUM(CAST(size AS bigint)) * 8 / 1024 AS int) FROM sys.database_files WHERE type = 0) AS tamanoMb,
    CASE WHEN OBJECT_ID('dbo.CAL_CERTIFICADOS', 'U') IS NULL THEN 0 ELSE 1 END AS certificados,
    CASE WHEN OBJECT_ID('dbo.CAL_EQUIPOS_HISTORIAL', 'U') IS NULL THEN 0 ELSE 1 END AS historial,
    CASE WHEN OBJECT_ID('dbo.CAL_EVENTOS_HISTORIAL', 'U') IS NULL THEN 0 ELSE 1 END AS eventosHistorial,
    CASE WHEN OBJECT_ID('dbo.CAL_PLAN_HISTORIAL', 'U') IS NULL THEN 0 ELSE 1 END AS planHistorial,
    CASE WHEN COL_LENGTH('dbo.CAL_CERTIFICADOS', 'revisado_por') IS NULL THEN 0 ELSE 1 END AS revision,
    CASE WHEN OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NULL THEN 0 ELSE 1 END AS cambios,
    CASE WHEN OBJECT_ID('dbo.APP_FALLAS', 'U') IS NULL THEN 0 ELSE 1 END AS fallas
`);

// backup_finish_date está en la hora local del servidor: la antigüedad se
// calcula allí mismo y la fecha viaja como texto.
const readRespaldos = () => first(`
  SELECT
    COUNT(*) AS total,
    CONVERT(varchar(16), MAX(backup_finish_date), 120) AS ultimo,
    DATEDIFF(hour, MAX(backup_finish_date), GETDATE()) AS horas,
    SUM(CASE WHEN backup_finish_date >= DATEADD(day, -30, GETDATE()) THEN 1 ELSE 0 END) AS ultimos30
  FROM msdb.dbo.backupset
  WHERE database_name = DB_NAME() AND type = 'D'
`);

const readMigraciones = async () => {
  const archivos = (await fs.readdir(MIGRATIONS_DIRECTORY))
    .filter(file => /^\d+_.+\.sql$/i.test(file))
    .map(file => file.split('_')[0])
    .sort();
  const registradas = await safe(async () => (
    (await getPool().request().query('SELECT version FROM dbo.SCHEMA_MIGRATIONS')).recordset.map(row => String(row.version))
  ));
  return { archivos, registradas };
};

const readEquipos = () => first(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN ${IS_ACTIVE} THEN 1 ELSE 0 END) AS activos,
    SUM(CASE WHEN ${IS_ACTIVE} AND cert_fecha IS NULL THEN 1 ELSE 0 END) AS sinCertificado,
    SUM(CASE WHEN ${IS_ACTIVE} AND cert_fecha IS NOT NULL
      AND (${blank('certificado')} IS NULL OR ISNULL(cert_periodo, 0) <= 0 OR ${blank('ente_calibrador')} IS NULL)
      THEN 1 ELSE 0 END) AS incompletos,
    SUM(CASE WHEN ${blank('reg_usuario')} IS NULL OR reg_fecha IS NULL THEN 1 ELSE 0 END) AS sinRegistro,
    SUM(CASE WHEN cert_fecha IS NOT NULL AND cert_periodo > 0
      AND (cert_fechaven IS NULL OR cert_fechaven <> DATEADD(day, cert_periodo, cert_fecha))
      THEN 1 ELSE 0 END) AS vencimientoInconsistente,
    SUM(CASE WHEN ${hasNbsp('cod_instrumento')} OR ${hasNbsp('certificado')} THEN 1 ELSE 0 END) AS espaciosInvisibles,
    (SELECT COUNT(*) FROM (
      SELECT id FROM dbo.DATA_EQUIPOS_CAL GROUP BY id HAVING COUNT(*) > 1
    ) AS repetidos) AS idsDuplicados,
    (SELECT COUNT(*) FROM (
      SELECT ${normalized('cod_instrumento')} AS codigo FROM dbo.DATA_EQUIPOS_CAL
      GROUP BY ${normalized('cod_instrumento')} HAVING COUNT(*) > 1
    ) AS repetidos) AS codigosDuplicados
  FROM dbo.DATA_EQUIPOS_CAL
`);

const readCertificados = () => first(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN ${blank('registrado_por')} IS NOT NULL THEN 1 ELSE 0 END) AS conAutor,
    SUM(CASE WHEN anulado = 1 THEN 1 ELSE 0 END) AS anulados,
    SUM(CASE WHEN anulado = 1 AND ${blank('motivo_anulacion')} IS NOT NULL THEN 1 ELSE 0 END) AS anuladosConMotivo
  FROM dbo.CAL_CERTIFICADOS
`);

const readHistorial = () => first(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN accion IN ('EDICION', 'CORRECCION', 'ANULACION') THEN 1 ELSE 0 END) AS modificaciones
  FROM dbo.CAL_EQUIPOS_HISTORIAL
`);

const readEventos = () => first(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN estado = 'REALIZADO' AND tipo = 'VERIFICACION' THEN 1 ELSE 0 END) AS verificaciones,
    SUM(CASE WHEN estado = 'REALIZADO' AND tipo = 'VERIFICACION' AND resultado IS NULL THEN 1 ELSE 0 END) AS verificacionesSinResultado
  FROM dbo.CAL_EVENTOS
`);

const readProgramas = () => first(`
  SELECT
    SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) AS activos,
    SUM(CASE WHEN activo = 0 THEN 1 ELSE 0 END) AS retirados
  FROM dbo.CAL_PROGRAMAS
`);

const readFallas = () => first(`
  SELECT COUNT(*) AS correos
  FROM dbo.CAL_ALERTAS_ENVIOS
  WHERE estado = 'ERROR' AND enviado_en >= DATEADD(day, -90, SYSUTCDATETIME())
`);

// Revisión por un segundo usuario (migración 006). Se considera atrasado lo
// registrado en el módulo hace más de 15 días sin revisar.
const readRevisiones = () => first(`
  WITH vigentes AS (
    SELECT actual.revisado_por, actual.origen, actual.desde
    FROM dbo.DATA_EQUIPOS_CAL e
    OUTER APPLY (
      SELECT TOP 1 c.revisado_por, c.origen, COALESCE(c.corregido_en, c.registrado_en) AS desde
      FROM dbo.CAL_CERTIFICADOS c
      WHERE c.equipo_id = e.id AND c.anulado = 0 AND c.cert_fecha = e.cert_fecha
        AND ${blank('c.certificado')} = ${blank('e.certificado')}
      ORDER BY c.id DESC
    ) actual
    WHERE ${IS_ACTIVE} AND e.cert_fecha IS NOT NULL
  )
  SELECT
    COUNT(*) AS certVigentes,
    SUM(CASE WHEN revisado_por IS NULL THEN 1 ELSE 0 END) AS certPendientes,
    SUM(CASE WHEN revisado_por IS NULL AND origen = 'MODULO'
      AND desde < DATEADD(day, -15, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS certAtrasados,
    (SELECT COUNT(*) FROM dbo.CAL_EVENTOS WHERE tipo = 'VERIFICACION' AND estado = 'REALIZADO') AS verRealizadas,
    (SELECT COUNT(*) FROM dbo.CAL_EVENTOS
      WHERE tipo = 'VERIFICACION' AND estado = 'REALIZADO' AND revisado_por IS NULL) AS verPendientes,
    (SELECT COUNT(*) FROM dbo.CAL_EVENTOS
      WHERE tipo = 'VERIFICACION' AND estado = 'REALIZADO' AND revisado_por IS NULL
        AND actualizado_en < DATEADD(day, -15, SYSUTCDATETIME())) AS verAtrasadas,
    (SELECT COUNT(*) FROM dbo.CAL_EVENTOS
      WHERE tipo = 'VERIFICACION' AND estado = 'REALIZADO' AND ${blank('registro_ref')} IS NULL) AS verSinHoja,
    (SELECT COUNT(*) FROM dbo.CAL_EVENTOS_HISTORIAL WHERE accion <> 'INICIAL') AS versionesFechas,
    (SELECT COUNT(*) FROM dbo.CAL_PLAN_HISTORIAL WHERE accion <> 'INICIAL') AS versionesPlan
  FROM vigentes
`);

// Control de cambios (migración 007). `version` es la que usa quien consulta.
const readCambios = async (version) => {
  const result = await getPool().request()
    .input('version', sql.NVarChar(20), version || null)
    .query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN estado = 'IMPLEMENTADO' AND aprobado_por IS NULL THEN 1 ELSE 0 END) AS enUsoSinAprobar,
        SUM(CASE WHEN estado IN ('REGISTRADO', 'VALIDADO', 'APROBADO') THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN version = @version THEN 1 ELSE 0 END) AS deVersion,
        SUM(CASE WHEN version = @version AND aprobado_por IS NOT NULL AND estado <> 'RECHAZADO' THEN 1 ELSE 0 END) AS deVersionAprobados
      FROM dbo.APP_CAMBIOS
    `);
  return result.recordset[0];
};

const readFallasSistema = () => first(`
  SELECT
    SUM(CASE WHEN estado IN ('ABIERTA', 'EN_CURSO') THEN 1 ELSE 0 END) AS abiertas,
    SUM(CASE WHEN estado = 'ABIERTA' AND accion_inmediata IS NULL
      AND primera_vez < DATEADD(day, -7, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS sinAtender,
    SUM(CASE WHEN ultima_vez >= DATEADD(day, -90, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS ultimos90,
    SUM(CASE WHEN estado = 'CERRADA' THEN 1 ELSE 0 END) AS cerradas
  FROM dbo.APP_FALLAS
`);

// Mismo criterio que getCalibrationPermissions: nivel 3 o área Calibración.
const readAccesos = () => first(`
  SELECT
    COUNT(*) AS activos,
    SUM(CASE WHEN CAST(acceso_cron AS varchar(10)) = '3'
      OR LOWER(LTRIM(RTRIM(area))) LIKE N'calibraci_n' THEN 1 ELSE 0 END) AS editores
  FROM DATA_USERS
  WHERE estado = 'ACTIVO' AND CAST(ISNULL(acceso_cron, 0) AS varchar(10)) <> '0'
`);

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|^[^.]+$/i;

const readEntorno = () => {
  const appUrl = env.calibration.appUrl;
  return {
    modo: env.nodeEnv,
    node: process.version,
    sesionExpira: env.jwt.expiresIn || null,
    baseCifrada: Boolean(env.db.options?.encrypt),
    servidorLocal: PRIVATE_HOST.test(String(env.db.server || '')),
    https: appUrl ? appUrl.toLowerCase().startsWith('https://') : null,
    correo: Boolean(env.smtp.host),
  };
};

// Números de SQL Server (SUM sobre cero filas devuelve NULL) a enteros.
const counts = (row) => (row
  ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' || value == null ? Number(value) || 0 : value]))
  : null);

const gatherFacts = async ({ version = null } = {}) => {
  const [
    baseDatos, respaldos, migraciones, equipos, certificados, historial, eventos, programas, fallas, accesos,
    revisiones, cambios, fallasSistema,
  ] = await Promise.all([
    safe(readBaseDatos),
    safe(readRespaldos),
    readMigraciones(),
    safe(readEquipos),
    safe(readCertificados),
    safe(readHistorial),
    safe(readEventos),
    safe(readProgramas),
    safe(readFallas),
    safe(readAccesos),
    safe(readRevisiones),
    safe(() => readCambios(version)),
    safe(readFallasSistema),
  ]);
  return {
    evaluadoEn: new Date().toISOString(),
    version,
    entorno: readEntorno(),
    baseDatos: baseDatos && {
      ...baseDatos,
      tamanoMb: Number(baseDatos.tamanoMb) || null,
      certificados: Boolean(baseDatos.certificados),
      historial: Boolean(baseDatos.historial),
      eventosHistorial: Boolean(baseDatos.eventosHistorial),
      planHistorial: Boolean(baseDatos.planHistorial),
      revision: Boolean(baseDatos.revision),
      cambios: Boolean(baseDatos.cambios),
      fallas: Boolean(baseDatos.fallas),
    },
    respaldos: respaldos && { ...counts(respaldos), ultimo: respaldos.ultimo, horas: respaldos.horas },
    migraciones,
    equipos: counts(equipos),
    certificados: counts(certificados),
    historial: counts(historial),
    eventos: counts(eventos),
    programas: counts(programas),
    fallas: counts(fallas),
    accesos: counts(accesos),
    revisiones: counts(revisiones),
    cambios: counts(cambios),
    fallasSistema: counts(fallasSistema),
  };
};

// ─── Evaluación ────────────────────────────────────────────────────────────

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const ratio = (part, total) => `${part} de ${total}`;
const tone = (bad, level = 'danger') => (bad ? level : 'success');

const DURATION_UNITS = { s: ['segundo', 'segundos'], m: ['minuto', 'minutos'], h: ['hora', 'horas'], d: ['día', 'días'] };
const formatDuration = (value) => {
  const match = /^(\d+)\s*([smhd])$/i.exec(String(value || '').trim());
  if (!match) return value ? String(value) : null;
  const [one, many] = DURATION_UNITS[match[2].toLowerCase()];
  return plural(Number(match[1]), one, many);
};

const CLAUSULAS = [
  {
    id: '7.5',
    titulo: 'Registros técnicos',
    descripcion: 'Lo que se registra de cada calibración y verificación debe bastar para entenderla, decir quién la hizo y dejar rastro de cada cambio.',
  },
  {
    id: '7.11',
    titulo: 'Control de los datos y gestión de la información',
    descripcion: 'El sistema debe estar validado, protegido contra accesos y pérdidas, mantener la integridad de los datos y registrar sus fallas.',
  },
  {
    id: '8.4',
    titulo: 'Control de registros',
    descripcion: 'Los registros deben poder identificarse, encontrarse, respaldarse y conservarse el tiempo necesario.',
  },
];

const REQUISITOS = [
  // ── 7.5 Registros técnicos ──
  {
    id: '7.5.1-certificados',
    clausula: '7.5.1',
    titulo: 'Datos del certificado de cada equipo',
    requisito: 'Cada registro técnico incluye el resultado y la información suficiente para entenderlo y, si hace falta, repetir la actividad.',
    evaluar: ({ equipos }) => {
      if (!equipos) return noData('los equipos de DATA_EQUIPOS_CAL');
      const completos = equipos.activos - equipos.incompletos - equipos.sinCertificado;
      return {
        estado: equipos.incompletos > 0 ? 'PARCIAL' : 'CUMPLE',
        evidencias: [
          'Cada equipo guarda número de certificado, emisión, vigencia y ente calibrador; el vencimiento lo calcula el sistema.',
          'Los certificados anteriores quedan en el historial del equipo.',
        ],
        brechas: [
          equipos.incompletos > 0 && `${plural(equipos.incompletos, 'equipo activo tiene', 'equipos activos tienen')} el certificado incompleto (sin número, vigencia o ente).`,
        ],
        notas: [
          'El resultado de la calibración y su incertidumbre están en el certificado del ente; el módulo guarda su referencia. El original se archiva según el procedimiento de registros.',
          equipos.sinCertificado > 0 && `${plural(equipos.sinCertificado, 'equipo activo aún no tiene', 'equipos activos aún no tienen')} certificado: no deberían usarse hasta calibrarse.`,
        ],
        accion: equipos.incompletos > 0 ? 'Completar el número, la vigencia o el ente desde «Corregir» en la ficha de cada equipo.' : null,
        prioridad: equipos.incompletos > 0 ? 'MEDIA' : null,
        datos: [
          { etiqueta: 'Activos con certificado completo', valor: ratio(completos, equipos.activos), tono: tone(equipos.incompletos > 0, 'warning') },
          { etiqueta: 'Activos sin certificado', valor: String(equipos.sinCertificado), tono: equipos.sinCertificado > 0 ? 'warning' : 'neutral' },
        ],
      };
    },
  },
  {
    id: '7.5.1-verificaciones',
    clausula: '7.5.1',
    titulo: 'Registro de cada verificación interna',
    requisito: 'El registro de una verificación permite entender cómo se obtuvo el resultado: qué se midió, con qué patrón y en qué condiciones.',
    evaluar: ({ baseDatos, revisiones }) => {
      if (baseDatos && !baseDatos.eventosHistorial) return missingMigration('006', 'se exige la hoja de datos de cada verificación');
      const sinHoja = revisiones?.verSinHoja || 0;
      return {
        estado: sinHoja > 0 ? 'PARCIAL' : 'CUMPLE',
        origen: revisiones ? 'DATOS' : 'DISENO',
        evidencias: [
          'Cada verificación realizada guarda la fecha programada y la real, el resultado (obligatorio), observaciones, quién la registró y cuándo.',
          'Al registrarla se exige la referencia de la hoja o el archivo con sus datos (lecturas, patrón usado, condiciones).',
        ],
        brechas: [
          sinHoja > 0 && `${plural(sinHoja, 'verificación registrada', 'verificaciones registradas')} antes de este control no ${sinHoja === 1 ? 'indica' : 'indican'} su hoja de datos.`,
        ],
        accion: sinHoja > 0 ? 'Completar la hoja de datos de las verificaciones anteriores desde su ficha (pide motivo).' : null,
        prioridad: sinHoja > 0 ? 'MEDIA' : null,
        datos: revisiones ? [
          { etiqueta: 'Verificaciones realizadas', valor: String(revisiones.verRealizadas), tono: 'neutral' },
          { etiqueta: 'Sin hoja de datos', valor: String(sinHoja), tono: tone(sinHoja > 0, 'warning') },
        ] : [],
      };
    },
  },
  {
    id: '7.5.1-responsables',
    clausula: '7.5.1',
    titulo: 'Quién lo hizo, quién lo revisó y cuándo',
    requisito: 'Cada registro indica la fecha y quién realizó la actividad, y también quién revisó los datos y resultados.',
    evaluar: ({ baseDatos, equipos, revisiones }) => {
      if (baseDatos && !baseDatos.revision) return missingMigration('006', 'se registra quién revisó los datos');
      const atrasados = (revisiones?.certAtrasados || 0) + (revisiones?.verAtrasadas || 0);
      const heredados = revisiones ? revisiones.certPendientes - revisiones.certAtrasados : 0;
      return {
        estado: atrasados > 0 ? 'PARCIAL' : 'CUMPLE',
        origen: revisiones ? 'DATOS' : 'DISENO',
        evidencias: [
          'El autor sale de la sesión del usuario y la fecha la pone el servidor: ninguno se puede editar.',
          'Certificados y verificaciones los revisa un segundo usuario; el sistema impide que lo haga quien los registró o corrigió, y guarda quién y cuándo.',
          'Si los datos cambian después, la revisión vuelve a quedar pendiente.',
        ],
        brechas: [
          atrasados > 0 && `${plural(atrasados, 'registro lleva', 'registros llevan')} más de 15 días sin revisar.`,
        ],
        notas: [
          heredados > 0 && `${plural(heredados, 'certificado vigente aún no tiene', 'certificados vigentes aún no tienen')} revisión (incluye los cargados antes del módulo): conviene revisarlos contra el original.`,
          equipos?.sinRegistro > 0 && `${plural(equipos.sinRegistro, 'equipo cargado', 'equipos cargados')} antes del módulo no ${equipos.sinRegistro === 1 ? 'indica' : 'indican'} quién lo registró.`,
        ],
        accion: atrasados > 0 ? 'Revisar los certificados y verificaciones pendientes desde la ficha de cada equipo.' : null,
        prioridad: atrasados > 0 ? 'MEDIA' : null,
        datos: revisiones ? [
          { etiqueta: 'Certificados vigentes revisados', valor: ratio(revisiones.certVigentes - revisiones.certPendientes, revisiones.certVigentes), tono: tone(revisiones.certPendientes > 0, 'warning') },
          { etiqueta: 'Verificaciones revisadas', valor: ratio(revisiones.verRealizadas - revisiones.verPendientes, revisiones.verRealizadas), tono: tone(revisiones.verPendientes > 0, 'warning') },
        ] : [],
      };
    },
  },
  {
    id: '7.5.1-momento',
    clausula: '7.5.1',
    titulo: 'Registro en el momento y ligado a la tarea',
    requisito: 'Las observaciones y los datos se registran cuando se producen y se pueden asociar a la tarea concreta.',
    evaluar: () => ({
      estado: 'CUMPLE',
      origen: 'DISENO',
      evidencias: [
        'La fecha y hora de registro las pone el servidor al guardar y son aparte de la fecha del hecho (emisión o verificación), que sí se informa.',
        'Cada registro queda ligado a su equipo y a la fecha concreta del plan.',
      ],
    }),
  },
  {
    id: '7.5.2-equipos',
    clausula: '7.5.2',
    titulo: 'Cambios en equipos y certificados',
    requisito: 'Toda modificación se puede rastrear hasta la versión anterior: se conservan el dato original y el nuevo, con la fecha, qué cambió y quién lo cambió.',
    evaluar: ({ baseDatos, historial, certificados }) => {
      if (baseDatos && (!baseDatos.certificados || !baseDatos.historial)) {
        return missingMigration('005', 'se guardan el historial de certificados ni los cambios de los equipos');
      }
      if (baseDatos && !baseDatos.revision) return missingMigration('006', 'se conserva la versión completa de un certificado corregido');
      return {
        estado: 'CUMPLE',
        origen: historial ? 'DATOS' : 'DISENO',
        evidencias: [
          'Cada cambio queda en el historial del equipo con la versión anterior y la nueva completas, quién y cuándo.',
          'Corregir un certificado exige el motivo y conserva la versión anterior completa, observaciones incluidas.',
          'Un certificado renovado pasa al historial; uno anulado se conserva con su motivo y vuelve a regir el anterior. Nada se borra.',
        ],
        notas: ['Si otro sistema cambia el certificado directamente en DATA_EQUIPOS_CAL, el módulo archiva lo que encuentra la próxima vez que escribe en ese equipo.'],
        datos: [
          historial && { etiqueta: 'Cambios registrados', valor: String(historial.total), tono: 'neutral' },
          certificados && { etiqueta: 'Certificados en el historial', valor: String(certificados.total), tono: 'neutral' },
          certificados?.anulados > 0 && {
            etiqueta: 'Anulados con motivo',
            valor: ratio(certificados.anuladosConMotivo, certificados.anulados),
            tono: tone(certificados.anuladosConMotivo < certificados.anulados, 'warning'),
          },
        ],
      };
    },
  },
  {
    id: '7.5.2-verificaciones',
    clausula: '7.5.2',
    titulo: 'Cambios en verificaciones y fechas del plan',
    requisito: 'Cambiar el resultado de una verificación o el estado de una fecha deja rastro de la versión anterior, con quién y cuándo.',
    evaluar: ({ baseDatos, revisiones }) => {
      if (baseDatos && !baseDatos.eventosHistorial) return missingMigration('006', 'queda rastro de los cambios en las fechas del plan');
      return {
        estado: 'CUMPLE',
        origen: revisiones ? 'DATOS' : 'DISENO',
        evidencias: [
          'Cada cambio de estado, resultado, hoja de datos o reprogramación guarda la versión anterior y la nueva, quién y cuándo.',
          'Modificar una fecha que ya figuraba como realizada exige el motivo.',
          '«Restablecer» deja la última versión en el historial antes de volver a la programación original.',
        ],
        datos: revisiones ? [{ etiqueta: 'Versiones registradas', valor: String(revisiones.versionesFechas), tono: 'neutral' }] : [],
      };
    },
  },
  {
    id: '7.5.2-plan',
    clausula: '7.5.2',
    titulo: 'Cambios en la configuración del plan',
    requisito: 'Los cambios en la frecuencia de verificación, los responsables y las actividades se pueden rastrear.',
    evaluar: ({ baseDatos, revisiones }) => {
      if (baseDatos && !baseDatos.planHistorial) return missingMigration('006', 'se conserva la configuración anterior del plan');
      return {
        estado: 'CUMPLE',
        origen: revisiones ? 'DATOS' : 'DISENO',
        evidencias: [
          'Cada cambio de frecuencia, responsable, avisos o actividad guarda la configuración anterior y la nueva, quién y cuándo.',
          'Una actividad eliminada se retira del plan sin borrarse.',
        ],
        datos: revisiones ? [{ etiqueta: 'Cambios de configuración registrados', valor: String(revisiones.versionesPlan), tono: 'neutral' }] : [],
      };
    },
  },

  // ── 7.11 Control de los datos y gestión de la información ──
  {
    id: '7.11.1',
    clausula: '7.11.1',
    titulo: 'Acceso a los datos necesarios',
    requisito: 'El personal accede a los datos y la información que necesita para su trabajo.',
    evaluar: ({ accesos }) => ({
      estado: 'CUMPLE',
      origen: accesos ? 'DATOS' : 'DISENO',
      evidencias: [
        'Todo usuario con sesión consulta el plan, los equipos, los certificados y su historial.',
        'Lo vencido y lo próximo aparece en «Requieren atención» y en el contador de la barra lateral.',
      ],
      datos: accesos ? [{ etiqueta: 'Usuarios con acceso', valor: String(accesos.activos), tono: 'neutral' }] : [],
    }),
  },
  {
    id: '7.11.2-validacion',
    clausula: '7.11.2',
    titulo: 'Validación antes de usar el sistema',
    requisito: 'Un sistema desarrollado para el laboratorio se valida en su funcionamiento, incluidas sus interfaces, antes de usarse.',
    evaluar: ({ baseDatos, cambios, version }) => {
      if (baseDatos && !baseDatos.cambios) return missingMigration('007', 'se registran la validación y la aprobación de cada cambio');
      const deVersion = cambios?.deVersion || 0;
      const sinAprobar = deVersion - (cambios?.deVersionAprobados || 0);
      const brechas = [
        version && deVersion === 0 && `La versión ${version} en uso no tiene cambios registrados en Control de cambios.`,
        version && sinAprobar > 0 && `La versión ${version} en uso tiene ${plural(sinAprobar, 'cambio sin validar o aprobar', 'cambios sin validar o aprobar')}.`,
      ];
      const pendiente = brechas.some(Boolean);
      return {
        estado: pendiente ? 'PARCIAL' : (version ? 'CUMPLE' : 'LABORATORIO'),
        origen: cambios ? 'DATOS' : 'DISENO',
        evidencias: [
          'Cada cambio se registra en Control de cambios con su validación (qué se probó, con qué datos y el resultado) y su aprobación antes de implementarse.',
          'Hay pruebas automáticas del backend y del frontend («pnpm test») para los cálculos, las reglas de certificados y las validaciones de cada formulario.',
        ],
        brechas,
        notas: [!version && 'No se recibió la versión en uso para compararla con los cambios aprobados.'],
        accion: pendiente ? `Validar y aprobar en Control de cambios los cambios de la versión ${version} antes de ponerla en producción.` : null,
        prioridad: pendiente ? 'ALTA' : null,
        datos: [
          version && { etiqueta: 'Versión en uso', valor: version, tono: 'neutral' },
          version && cambios && { etiqueta: 'Cambios aprobados de esta versión', valor: ratio(cambios.deVersionAprobados, deVersion), tono: tone(pendiente, 'warning') },
        ],
      };
    },
  },
  {
    id: '7.11.2-cambios',
    clausula: '7.11.2',
    titulo: 'Control de cambios',
    requisito: 'Todo cambio del sistema, incluida su configuración, se autoriza, documenta y valida antes de implementarse.',
    evaluar: ({ baseDatos, migraciones, cambios }) => {
      if (baseDatos && !baseDatos.cambios) return missingMigration('007', 'existe el registro de control de cambios');
      const { archivos = [], registradas } = migraciones || {};
      const sinRegistrar = registradas ? archivos.filter(version => !registradas.includes(version)) : archivos;
      const enUso = cambios?.enUsoSinAprobar || 0;
      const brechas = [
        enUso > 0 && `${plural(enUso, 'cambio en uso se registró', 'cambios en uso se registraron')} a posteriori sin validación ni aprobación.`,
        !registradas && 'La base no tiene la tabla SCHEMA_MIGRATIONS: no queda constancia de qué cambios tiene.',
        registradas && sinRegistrar.length > 0 && `Migraciones sin registrar en esta base: ${sinRegistrar.join(', ')}. Pueden estar aplicadas a mano, pero no queda constancia.`,
      ];
      const pendiente = brechas.some(Boolean);
      return {
        estado: pendiente ? 'PARCIAL' : 'CUMPLE',
        origen: 'DATOS',
        evidencias: [
          'Control de cambios registra cada cambio con su descripción, impacto y referencias, y su paso por validación, aprobación e implementación; cada paso queda en su historial.',
          'El código queda en el control de versiones (git) y los cambios de la base son migraciones numeradas registradas en SCHEMA_MIGRATIONS.',
          'Un cambio aprobado ya no se edita: cualquier ajuste es un cambio nuevo.',
        ],
        brechas,
        accion: pendiente
          ? [enUso > 0 && 'Completar la validación y la aprobación de los cambios en uso', sinRegistrar.length > 0 && 'registrar las migraciones con «pnpm migrate»'].filter(Boolean).join(' y ') + '.'
          : null,
        prioridad: pendiente ? 'MEDIA' : null,
        datos: [
          cambios && { etiqueta: 'Cambios registrados', valor: String(cambios.total), tono: 'neutral' },
          cambios && { etiqueta: 'En uso sin aprobar', valor: String(enUso), tono: tone(enUso > 0, 'warning') },
          { etiqueta: 'Migraciones registradas', valor: ratio(archivos.length - sinRegistrar.length, archivos.length), tono: tone(sinRegistrar.length > 0, 'warning') },
        ],
      };
    },
  },
  {
    id: '7.11.3-a',
    clausula: '7.11.3 a',
    titulo: 'Protección contra el acceso no autorizado',
    requisito: 'Solo las personas autorizadas acceden al sistema y modifican los datos.',
    evaluar: ({ entorno, accesos }) => {
      const sesion = formatDuration(entorno.sesionExpira);
      return {
        estado: 'PARCIAL',
        origen: 'DATOS',
        evidencias: [
          `Para entrar se necesita usuario y contraseña${sesion ? `; la sesión vence a las ${sesion}` : ''}.`,
          'Solo el área Calibración y el nivel 3 modifican; el servidor lo comprueba en cada cambio.',
          'Tras 3 intentos fallidos el usuario queda bloqueado un minuto.',
        ],
        brechas: [
          'Las contraseñas se guardan y comparan en texto plano en DATA_USERS: quien lea esa tabla puede entrar como cualquier usuario y registrar a su nombre. Coordinar con el Jefe de Sistemas: la norma pide proteger el acceso y guardarlas con hash es la forma esperada de hacerlo, pero varios sistemas las leen en texto plano.',
          'El bloqueo por intentos fallidos se pierde al reiniciar el servidor.',
          entorno.https === false && 'La aplicación se publica por HTTP: usuario y contraseña viajan sin cifrar por la red.',
          entorno.modo !== 'production' && `El servidor corre en modo «${entorno.modo}»: ante un error devuelve detalles internos al navegador.`,
          !entorno.baseCifrada && 'La conexión con SQL Server no va cifrada.',
        ],
        notas: [entorno.https == null && 'No se pudo comprobar si la aplicación se publica con HTTPS (APP_URL no está configurado).'],
        accion: 'Coordinar con el Jefe de Sistemas el paso de las contraseñas de DATA_USERS a hash (bcrypt) en todos los sistemas que las usan. Mientras tanto: publicar con HTTPS y fijar NODE_ENV=production.',
        prioridad: 'ALTA',
        datos: [
          accesos && { etiqueta: 'Usuarios que pueden modificar', valor: ratio(accesos.editores, accesos.activos), tono: 'neutral' },
          { etiqueta: 'Modo del servidor', valor: entorno.modo, tono: tone(entorno.modo !== 'production', 'warning') },
          sesion && { etiqueta: 'Vencimiento de la sesión', valor: sesion, tono: 'neutral' },
        ],
      };
    },
  },
  {
    id: '7.11.3-b',
    clausula: '7.11.3 b',
    titulo: 'Protección contra la manipulación y la pérdida',
    requisito: 'Los datos están resguardados para que no se alteren indebidamente ni se pierdan.',
    evaluar: () => ({
      estado: 'PARCIAL',
      origen: 'DISENO',
      evidencias: [
        'Los cambios se guardan en transacciones: se guarda todo o nada.',
        'Desde la aplicación no se borran certificados ni equipos: se anulan o se dan de baja.',
        'Cada cambio de los registros técnicos y de la configuración queda versionado en su historial.',
      ],
      brechas: [
        'Quien entre directamente a SQL Server puede modificar registros sin dejar rastro: la base no audita los cambios.',
      ],
      notas: ['Los respaldos se evalúan en 8.4.2.'],
      accion: 'Auditar los cambios de las tablas de registros en la base (triggers o SQL Server Audit) y limitar el acceso directo a ella.',
      prioridad: 'MEDIA',
    }),
  },
  {
    id: '7.11.3-c',
    clausula: '7.11.3 c',
    titulo: 'Entorno de operación',
    requisito: 'El sistema funciona en un entorno que cumple las especificaciones del proveedor o del laboratorio.',
    evaluar: ({ entorno, baseDatos }) => {
      const produccion = entorno.modo === 'production';
      const express = /express/i.test(baseDatos?.edicion || '');
      return {
        estado: produccion ? 'LABORATORIO' : 'PARCIAL',
        origen: 'DATOS',
        evidencias: [
          baseDatos
            ? `Funciona con Node.js ${entorno.node} y SQL Server ${baseDatos.version} (${baseDatos.edicion}).`
            : `Funciona con Node.js ${entorno.node} sobre SQL Server.`,
          entorno.servidorLocal && 'La base de datos está en un servidor de la red del laboratorio.',
        ],
        brechas: [!produccion && 'El servidor no está configurado para producción (NODE_ENV).'],
        notas: [
          express && 'SQL Server Express limita cada base a 10 GB y no incluye el Agente para programar tareas: conviene vigilar el tamaño.',
          'Las especificaciones del servidor (versiones, espacio, energía de respaldo, acceso físico) las documenta el laboratorio.',
        ],
        accion: produccion
          ? 'Documentar las especificaciones del servidor y verificarlas periódicamente.'
          : 'Fijar NODE_ENV=production en el servidor y documentar sus especificaciones.',
        prioridad: produccion ? 'BAJA' : 'MEDIA',
        datos: [
          baseDatos?.tamanoMb && {
            etiqueta: 'Tamaño de la base',
            valor: `${(baseDatos.tamanoMb / 1024).toFixed(1)} GB${express ? ' de 10 GB' : ''}`,
            tono: express ? tone(baseDatos.tamanoMb > 8 * 1024, 'warning') : 'neutral',
          },
        ],
      };
    },
  },
  {
    id: '7.11.3-d',
    clausula: '7.11.3 d',
    titulo: 'Integridad de los datos',
    requisito: 'El sistema se mantiene de forma que los datos sigan completos, coherentes y sin duplicados.',
    evaluar: ({ equipos }) => {
      if (!equipos) return noData('los equipos de DATA_EQUIPOS_CAL');
      const duplicados = equipos.idsDuplicados + equipos.codigosDuplicados;
      return {
        estado: duplicados > 0 ? 'NO_CUMPLE' : 'PARCIAL',
        evidencias: [
          'Cada formulario se valida en el servidor antes de guardar.',
          'Las tablas del módulo tienen claves y restricciones; el id y el código de un equipo nuevo se reservan con bloqueo para no duplicarse.',
          'El vencimiento lo calcula el sistema (emisión + vigencia); no se digita.',
        ],
        brechas: [
          equipos.idsDuplicados > 0 && `${plural(equipos.idsDuplicados, 'id repetido', 'ids repetidos')} en DATA_EQUIPOS_CAL.`,
          equipos.codigosDuplicados > 0 && `${plural(equipos.codigosDuplicados, 'código de equipo repetido', 'códigos de equipo repetidos')}.`,
          equipos.vencimientoInconsistente > 0 && `${plural(equipos.vencimientoInconsistente, 'equipo guarda', 'equipos guardan')} un vencimiento (cert_fechaven) distinto de emisión + vigencia. El módulo usa el cálculo, pero otros sistemas podrían leer el dato guardado.`,
          equipos.espaciosInvisibles > 0 && `${plural(equipos.espaciosInvisibles, 'equipo tiene', 'equipos tienen')} espacios invisibles en el código o el certificado.`,
          'DATA_EQUIPOS_CAL no tiene clave primaria ni restricciones: su integridad depende de cada sistema que escribe en ella.',
        ],
        accion: duplicados > 0
          ? 'Resolver los ids o códigos repetidos de DATA_EQUIPOS_CAL.'
          : 'Recalcular los vencimientos guardados y limpiar los espacios invisibles de los registros heredados; después, dar a DATA_EQUIPOS_CAL una clave primaria coordinándolo con los otros sistemas.',
        prioridad: duplicados > 0 ? 'ALTA' : 'MEDIA',
        datos: [
          { etiqueta: 'Ids o códigos repetidos', valor: String(duplicados), tono: tone(duplicados > 0) },
          { etiqueta: 'Vencimiento guardado ≠ calculado', valor: ratio(equipos.vencimientoInconsistente, equipos.total), tono: tone(equipos.vencimientoInconsistente > 0, 'warning') },
          { etiqueta: 'Con espacios invisibles', valor: String(equipos.espaciosInvisibles), tono: tone(equipos.espaciosInvisibles > 0, 'warning') },
        ],
      };
    },
  },
  {
    id: '7.11.3-e',
    clausula: '7.11.3 e',
    titulo: 'Registro de fallas del sistema',
    requisito: 'Se registran las fallas del sistema y las acciones inmediatas y correctivas tomadas.',
    evaluar: ({ baseDatos, fallas, fallasSistema }) => {
      if (baseDatos && !baseDatos.fallas) return missingMigration('007', 'se registran las fallas del sistema');
      const sinAtender = fallasSistema?.sinAtender || 0;
      return {
        estado: sinAtender > 0 ? 'PARCIAL' : 'CUMPLE',
        origen: fallasSistema ? 'DATOS' : 'DISENO',
        evidencias: [
          'Los errores del servidor, de las tareas programadas y del proceso se guardan solos en Registro de fallas, agrupando sus repeticiones.',
          'Cada falla se cierra con su acción inmediata y su acción correctiva, y puede ligarse al cambio que la corrigió.',
          'Las fallas que la aplicación no puede ver (servidor caído, red) se registran a mano.',
        ],
        brechas: [
          sinAtender > 0 && `${plural(sinAtender, 'falla abierta lleva', 'fallas abiertas llevan')} más de 7 días sin acción inmediata.`,
        ],
        accion: sinAtender > 0 ? 'Atender las fallas abiertas en Registro de fallas: acción inmediata, causa y acción correctiva.' : null,
        prioridad: sinAtender > 0 ? 'ALTA' : null,
        datos: [
          fallasSistema && { etiqueta: 'Fallas abiertas', valor: String(fallasSistema.abiertas), tono: fallasSistema.abiertas > 0 ? 'warning' : 'success' },
          fallasSistema && { etiqueta: 'Registradas en 90 días', valor: String(fallasSistema.ultimos90), tono: 'neutral' },
          fallas && { etiqueta: 'Correos de alerta fallidos (90 días)', valor: String(fallas.correos), tono: fallas.correos > 0 ? 'warning' : 'neutral' },
        ],
      };
    },
  },
  {
    id: '7.11.4',
    clausula: '7.11.4',
    titulo: 'Proveedores externos del sistema',
    requisito: 'Si un proveedor externo gestiona o mantiene el sistema, el laboratorio se asegura de que cumpla estos mismos requisitos.',
    evaluar: ({ entorno }) => ({
      estado: 'LABORATORIO',
      origen: 'DATOS',
      evidencias: [
        entorno.servidorLocal && 'La base de datos y la aplicación funcionan en la red del laboratorio.',
      ],
      notas: ['Si el desarrollo, el soporte, el servidor o el correo están a cargo de un proveedor externo, debe haber un acuerdo con él y su evaluación como proveedor (6.6).'],
      accion: 'Archivar el acuerdo y la evaluación de cada proveedor que interviene en el sistema (desarrollo, soporte, correo).',
      prioridad: 'MEDIA',
      datos: [{ etiqueta: 'Correo saliente', valor: entorno.correo ? 'Configurado' : 'Sin configurar', tono: 'neutral' }],
    }),
  },
  {
    id: '7.11.5',
    clausula: '7.11.5',
    titulo: 'Instrucciones y manuales',
    requisito: 'Las instrucciones, manuales y datos de referencia del sistema están al alcance del personal.',
    evaluar: () => ({
      estado: 'PARCIAL',
      origen: 'DISENO',
      evidencias: [
        'Cada ficha explica en pantalla qué hace cada acción y cómo se calculan las fechas.',
        'El README documenta la instalación, la configuración y las reglas del módulo para el personal técnico.',
      ],
      brechas: ['No hay un instructivo de uso para el personal accesible desde la aplicación.'],
      accion: 'Publicar un instructivo de uso del módulo, controlado como documento (8.3) y enlazado desde la aplicación.',
      prioridad: 'MEDIA',
    }),
  },
  {
    id: '7.11.6',
    clausula: '7.11.6',
    titulo: 'Verificación de cálculos y transferencias',
    requisito: 'Los cálculos y las transferencias de datos se verifican de forma apropiada y sistemática.',
    evaluar: ({ baseDatos, equipos }) => {
      const revision = !baseDatos || baseDatos.revision;
      return {
        estado: revision ? 'CUMPLE' : 'PARCIAL',
        origen: equipos ? 'DATOS' : 'DISENO',
        evidencias: [
          'Las fechas de calibración, verificación y aviso se calculan con funciones cubiertas por pruebas automáticas.',
          revision && 'Los datos transcritos de cada certificado los verifica un segundo usuario contra el original.',
          'Esta evaluación compara en cada carga el vencimiento guardado con el calculado.',
          'Al pasar los certificados a su historial (migración 005) se limpiaron los espacios invisibles y se omitieron los duplicados.',
        ],
        brechas: [!revision && 'Los datos del certificado se transcriben a mano y nadie más los verifica (falta la migración 006).'],
        accion: revision ? null : 'Aplicar la migración 006 para habilitar la revisión por un segundo usuario.',
        prioridad: revision ? null : 'MEDIA',
        datos: equipos ? [{
          etiqueta: 'Vencimientos guardados que no coinciden',
          valor: ratio(equipos.vencimientoInconsistente, equipos.total),
          tono: tone(equipos.vencimientoInconsistente > 0, 'warning'),
        }] : [],
      };
    },
  },

  // ── 8.4 Control de registros ──
  {
    id: '8.4.1',
    clausula: '8.4.1',
    titulo: 'Registros legibles y conservados',
    requisito: 'Se conservan registros legibles que demuestran que se cumplen los requisitos.',
    evaluar: ({ certificados, historial }) => ({
      estado: 'CUMPLE',
      origen: certificados ? 'DATOS' : 'DISENO',
      evidencias: [
        'Certificados, verificaciones y cambios se consultan en la ficha de cada equipo, con fecha y autor.',
        'Los certificados anulados y los equipos dados de baja se conservan.',
      ],
      notas: ['Para auditorías convendría exportar el historial de cada equipo (PDF o Excel).'],
      datos: [
        certificados && { etiqueta: 'Certificados conservados', valor: String(certificados.total), tono: 'neutral' },
        historial && { etiqueta: 'Cambios conservados', valor: String(historial.total), tono: 'neutral' },
      ],
    }),
  },
  {
    id: '8.4.2-identificacion',
    clausula: '8.4.2',
    titulo: 'Identificación y recuperación',
    requisito: 'Cada registro se identifica sin ambigüedad y se puede encontrar y recuperar con facilidad.',
    evaluar: ({ equipos }) => {
      const repetidos = equipos ? equipos.codigosDuplicados : 0;
      return {
        estado: repetidos > 0 ? 'PARCIAL' : 'CUMPLE',
        origen: equipos ? 'DATOS' : 'DISENO',
        evidencias: [
          'Cada registro tiene identificador propio y se asocia al código del equipo y al número de certificado.',
          'Se encuentran con la búsqueda por código, instrumento o certificado, y cada equipo muestra su historial completo.',
        ],
        brechas: [repetidos > 0 && 'Hay códigos de equipo repetidos: un registro podría asociarse al equipo equivocado.'],
        accion: repetidos > 0 ? 'Resolver los códigos de equipo repetidos.' : null,
        prioridad: repetidos > 0 ? 'ALTA' : null,
        datos: equipos ? [{ etiqueta: 'Códigos repetidos', valor: String(repetidos), tono: tone(repetidos > 0) }] : [],
      };
    },
  },
  {
    id: '8.4.2-respaldo',
    clausula: '8.4.2',
    titulo: 'Almacenamiento y respaldo',
    requisito: 'Los registros se almacenan protegidos y respaldados para poder recuperarlos ante una falla.',
    evaluar: ({ respaldos, baseDatos }) => {
      const simple = baseDatos?.recuperacion === 'SIMPLE';
      const base = {
        evidencias: ['Los registros se guardan en SQL Server; solo se modifican desde la aplicación o por sus administradores.'],
        notas: [simple && 'Modelo de recuperación SIMPLE: ante una falla se recupera hasta el último respaldo completo y se pierde lo registrado después.'],
      };
      if (!respaldos) {
        return {
          ...base,
          estado: 'LABORATORIO',
          origen: 'DISENO',
          notas: [...base.notas, 'La aplicación no tiene permiso para consultar el historial de respaldos del servidor.'],
          accion: 'Documentar la frecuencia, el lugar y las pruebas de restauración de los respaldos.',
          prioridad: 'MEDIA',
        };
      }
      const dias = respaldos.horas == null ? null : Math.floor(respaldos.horas / 24);
      const estado = respaldos.total === 0 || dias > 7 ? 'NO_CUMPLE' : dias > 2 ? 'PARCIAL' : 'LABORATORIO';
      return {
        ...base,
        estado,
        evidencias: [
          ...base.evidencias,
          respaldos.total > 0 && `Hay ${plural(respaldos.ultimos30, 'respaldo completo', 'respaldos completos')} de esta base en los últimos 30 días.`,
        ],
        brechas: [
          respaldos.total === 0 && 'No hay respaldos completos de esta base.',
          respaldos.total > 0 && dias > 2 && `El último respaldo completo tiene ${plural(dias, 'día', 'días')}.`,
        ],
        notas: [...base.notas, estado === 'LABORATORIO' && 'Falta la evidencia del laboratorio: dónde se guardan los respaldos y las pruebas de restauración.'],
        accion: estado === 'LABORATORIO'
          ? 'Registrar dónde se guardan los respaldos y probar su restauración periódicamente.'
          : 'Programar un respaldo completo diario de esta base y probar su restauración.',
        prioridad: estado === 'LABORATORIO' ? 'MEDIA' : 'ALTA',
        datos: [
          { etiqueta: 'Último respaldo completo', valor: respaldos.ultimo || 'Ninguno', tono: tone(estado === 'NO_CUMPLE' || estado === 'PARCIAL', estado === 'NO_CUMPLE' ? 'danger' : 'warning') },
          { etiqueta: 'Respaldos en 30 días', valor: String(respaldos.ultimos30), tono: 'neutral' },
          baseDatos && { etiqueta: 'Modelo de recuperación', valor: baseDatos.recuperacion, tono: 'neutral' },
        ],
      };
    },
  },
  {
    id: '8.4.2-conservacion',
    clausula: '8.4.2',
    titulo: 'Tiempo de conservación y disposición',
    requisito: 'Los registros se conservan el tiempo definido por el laboratorio y sus obligaciones, y solo se eliminan de forma controlada.',
    evaluar: () => ({
      estado: 'LABORATORIO',
      origen: 'DISENO',
      evidencias: [
        'El módulo conserva sin límite los certificados, los historiales de cambios, los equipos dados de baja y las actividades retiradas.',
        'Desde la aplicación no se elimina ningún registro técnico: se anula o se versiona.',
      ],
      notas: ['El tiempo de conservación lo fija el procedimiento de registros del laboratorio.'],
      accion: 'Definir en el procedimiento de registros cuánto se conservan estos registros y quién autoriza su eliminación.',
      prioridad: 'MEDIA',
    }),
  },
  {
    id: '8.4.2-acceso',
    clausula: '8.4.2',
    titulo: 'Acceso y disponibilidad',
    requisito: 'El acceso a los registros respeta la confidencialidad y los registros están disponibles cuando se necesitan.',
    evaluar: () => ({
      estado: 'CUMPLE',
      origen: 'DISENO',
      evidencias: [
        'Solo usuarios con sesión consultan los registros y solo el área Calibración y el nivel 3 los modifican.',
        'Están disponibles al instante desde la ficha de cada equipo.',
      ],
      notas: ['La forma en que se guardan las contraseñas también afecta este punto (ver 7.11.3 a).'],
    }),
  },
];

function missingMigration(numero, que) {
  return {
    estado: 'NO_CUMPLE',
    brechas: [`Falta la migración ${numero} en esta base: sin ella no ${que}.`],
    accion: `Aplicar la migración ${numero} («pnpm migrate» en backend).`,
    prioridad: 'ALTA',
  };
}

function noData(fuente) {
  return {
    estado: 'PARCIAL',
    origen: 'DISENO',
    brechas: [`No se pudo consultar ${fuente} para comprobarlo.`],
    accion: 'Revisar la conexión y los permisos de la aplicación sobre la base de datos.',
    prioridad: 'MEDIA',
  };
}

const compact = (list) => (list || []).filter(Boolean);

const runRequirement = (requisito, facts) => {
  let outcome;
  try {
    outcome = requisito.evaluar(facts);
  } catch (error) {
    outcome = {
      estado: 'PARCIAL',
      origen: 'DISENO',
      brechas: [`No se pudo evaluar: ${error.message}`],
      prioridad: 'MEDIA',
    };
  }
  const brechas = compact(outcome.brechas);
  return {
    id: requisito.id,
    clausula: requisito.clausula,
    titulo: requisito.titulo,
    requisito: requisito.requisito,
    estado: ESTADOS.includes(outcome.estado) ? outcome.estado : 'PARCIAL',
    origen: outcome.origen || 'DATOS',
    evidencias: compact(outcome.evidencias),
    brechas,
    notas: compact(outcome.notas),
    accion: outcome.accion || null,
    prioridad: outcome.accion && PRIORIDADES.includes(outcome.prioridad) ? outcome.prioridad : null,
    datos: compact(outcome.datos),
  };
};

const tally = (requisitos) => {
  const resumen = Object.fromEntries(ESTADOS.map(estado => [estado, 0]));
  for (const requisito of requisitos) resumen[requisito.estado] += 1;
  return { ...resumen, total: requisitos.length };
};

const clauseOf = (clausula) => clausula.split('.').slice(0, 2).join('.').split(' ')[0];

/** Evalúa cada requisito con los datos reunidos. Pura: no toca la base. */
const evaluateCompliance = (facts) => {
  const requisitos = REQUISITOS.map(requisito => runRequirement(requisito, facts));
  const clausulas = CLAUSULAS.map(clausula => {
    const propios = requisitos.filter(requisito => clauseOf(requisito.clausula) === clausula.id);
    return { ...clausula, resumen: tally(propios), requisitos: propios };
  });
  const acciones = requisitos
    .filter(requisito => requisito.accion && requisito.estado !== 'CUMPLE')
    .map(({ id, clausula, titulo, estado, accion, prioridad }) => ({ id, clausula, titulo, estado, accion, prioridad }))
    .sort((a, b) => PRIORIDADES.indexOf(a.prioridad) - PRIORIDADES.indexOf(b.prioridad));

  return {
    norma: {
      codigo: 'NB/ISO/IEC 17025:2018',
      equivalente: 'ISO/IEC 17025:2017',
      organismo: 'DTA-IBMETRO',
      puntos: CLAUSULAS.map(clausula => clausula.id),
    },
    evaluadoEn: facts.evaluadoEn,
    contexto: {
      baseDatos: facts.baseDatos?.nombre || null,
      modo: facts.entorno.modo,
    },
    resumen: tally(requisitos),
    clausulas,
    acciones,
  };
};

const getCompliance = async ({ version = null } = {}) => evaluateCompliance(await gatherFacts({ version }));

module.exports = {
  ESTADOS,
  PRIORIDADES,
  REQUISITOS,
  evaluateCompliance,
  formatDuration,
  getCompliance,
};
