-- ========================================================================
-- MIGRACIÓN 006: TRAZABILIDAD DE LOS REGISTROS DE CALIBRACIÓN
-- ========================================================================
-- NB/ISO/IEC 17025:2018, 7.5 (registros técnicos):
--
-- CAL_EVENTOS            : referencia a la hoja de datos de cada verificación
--                          (registro_ref) y revisión por un segundo usuario.
-- CAL_EVENTOS_HISTORIAL  : cada versión de una fecha del plan (estado,
--                          resultado, reprogramación) con el valor anterior y
--                          el nuevo completos, quién, cuándo y por qué.
-- CAL_CERTIFICADOS       : revisión por un segundo usuario y quién corrigió.
-- CAL_EQUIPOS_HISTORIAL  : versión completa antes/después y motivo; acción
--                          REVISION.
-- CAL_PLAN_HISTORIAL     : cambios de la configuración del plan (series de
--                          equipos, actividades y ajustes de avisos).
--
-- Los historiales arrancan con el estado actual de cada registro. Es
-- idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF COL_LENGTH('dbo.CAL_EVENTOS', 'registro_ref') IS NULL
  ALTER TABLE dbo.CAL_EVENTOS ADD registro_ref NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.CAL_EVENTOS', 'revisado_por') IS NULL
  ALTER TABLE dbo.CAL_EVENTOS ADD revisado_por NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.CAL_EVENTOS', 'revisado_en') IS NULL
  ALTER TABLE dbo.CAL_EVENTOS ADD revisado_en DATETIME2 NULL;

IF COL_LENGTH('dbo.CAL_CERTIFICADOS', 'revisado_por') IS NULL
  ALTER TABLE dbo.CAL_CERTIFICADOS ADD revisado_por NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.CAL_CERTIFICADOS', 'revisado_en') IS NULL
  ALTER TABLE dbo.CAL_CERTIFICADOS ADD revisado_en DATETIME2 NULL;
IF COL_LENGTH('dbo.CAL_CERTIFICADOS', 'revision_obs') IS NULL
  ALTER TABLE dbo.CAL_CERTIFICADOS ADD revision_obs NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.CAL_CERTIFICADOS', 'corregido_por') IS NULL
  ALTER TABLE dbo.CAL_CERTIFICADOS ADD corregido_por NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.CAL_CERTIFICADOS', 'corregido_en') IS NULL
  ALTER TABLE dbo.CAL_CERTIFICADOS ADD corregido_en DATETIME2 NULL;

IF COL_LENGTH('dbo.CAL_EQUIPOS_HISTORIAL', 'antes') IS NULL
  ALTER TABLE dbo.CAL_EQUIPOS_HISTORIAL ADD antes NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.CAL_EQUIPOS_HISTORIAL', 'despues') IS NULL
  ALTER TABLE dbo.CAL_EQUIPOS_HISTORIAL ADD despues NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.CAL_EQUIPOS_HISTORIAL', 'motivo') IS NULL
  ALTER TABLE dbo.CAL_EQUIPOS_HISTORIAL ADD motivo NVARCHAR(300) NULL;

-- La revisión de un certificado queda en el historial del equipo.
IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = 'CK_CAL_EQUIPOS_HISTORIAL_ACCION' AND definition NOT LIKE '%REVISION%'
)
  ALTER TABLE dbo.CAL_EQUIPOS_HISTORIAL DROP CONSTRAINT CK_CAL_EQUIPOS_HISTORIAL_ACCION;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_EQUIPOS_HISTORIAL_ACCION')
  EXEC('ALTER TABLE dbo.CAL_EQUIPOS_HISTORIAL ADD CONSTRAINT CK_CAL_EQUIPOS_HISTORIAL_ACCION CHECK (accion IN (
    ''ALTA'', ''EDICION'', ''CERTIFICADO'', ''CORRECCION'', ''ANULACION'', ''BAJA'', ''REACTIVACION'', ''REVISION''
  ))');

IF OBJECT_ID('dbo.CAL_EVENTOS_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_EVENTOS_HISTORIAL (
    id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_EVENTOS_HISTORIAL PRIMARY KEY,
    serie            VARCHAR(30)   NOT NULL,
    tipo             VARCHAR(20)   NOT NULL,
    equipo_id        INT           NULL,
    programa_id      INT           NULL,
    fecha_programada DATE          NOT NULL,
    -- INICIAL: estado al empezar el historial; REGISTRO: primera vez que se
    -- guarda; MODIFICACION: cambio posterior; RESTABLECIMIENTO: vuelve a su
    -- programación original; REVISION: un segundo usuario confirma los datos.
    accion           VARCHAR(20)   NOT NULL,
    detalle          NVARCHAR(400) NULL,
    antes            NVARCHAR(MAX) NULL,
    despues          NVARCHAR(MAX) NULL,
    motivo           NVARCHAR(300) NULL,
    usuario          NVARCHAR(50)  NULL,
    fecha            DATETIME2     NOT NULL CONSTRAINT DF_CAL_EVENTOS_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_EVENTOS_HISTORIAL_ACCION CHECK (accion IN (
      'INICIAL', 'REGISTRO', 'MODIFICACION', 'RESTABLECIMIENTO', 'REVISION'
    ))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_EVENTOS_HISTORIAL') AND name = 'IX_CAL_EVENTOS_HISTORIAL_Fecha'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_EVENTOS_HISTORIAL_Fecha
    ON dbo.CAL_EVENTOS_HISTORIAL (serie, fecha_programada, fecha DESC);');
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_EVENTOS_HISTORIAL') AND name = 'IX_CAL_EVENTOS_HISTORIAL_Equipo'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_EVENTOS_HISTORIAL_Equipo
    ON dbo.CAL_EVENTOS_HISTORIAL (equipo_id, fecha DESC)
    WHERE equipo_id IS NOT NULL;');
END;

IF OBJECT_ID('dbo.CAL_PLAN_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_PLAN_HISTORIAL (
    id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_PLAN_HISTORIAL PRIMARY KEY,
    -- PROGRAMA: una serie de CAL_PROGRAMAS; AJUSTES: avisos generales.
    entidad      VARCHAR(10)   NOT NULL,
    programa_id  INT           NULL,
    tipo         VARCHAR(20)   NULL,
    equipo_id    INT           NULL,
    accion       VARCHAR(20)   NOT NULL,
    detalle      NVARCHAR(400) NULL,
    antes        NVARCHAR(MAX) NULL,
    despues      NVARCHAR(MAX) NULL,
    usuario      NVARCHAR(50)  NULL,
    fecha        DATETIME2     NOT NULL CONSTRAINT DF_CAL_PLAN_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_PLAN_HISTORIAL_ENTIDAD CHECK (entidad IN ('PROGRAMA', 'AJUSTES')),
    CONSTRAINT CK_CAL_PLAN_HISTORIAL_ACCION CHECK (accion IN ('INICIAL', 'CREACION', 'EDICION', 'RETIRO'))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_PLAN_HISTORIAL') AND name = 'IX_CAL_PLAN_HISTORIAL_Programa'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_PLAN_HISTORIAL_Programa
    ON dbo.CAL_PLAN_HISTORIAL (programa_id, fecha DESC);');
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_PLAN_HISTORIAL') AND name = 'IX_CAL_PLAN_HISTORIAL_Equipo'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_PLAN_HISTORIAL_Equipo
    ON dbo.CAL_PLAN_HISTORIAL (equipo_id, fecha DESC)
    WHERE equipo_id IS NOT NULL;');
END;

-- Punto de partida de los historiales: lo que ya estaba guardado. Dinámico
-- porque las tablas y columnas recién creadas no existen al compilar el lote.
EXEC(N'
  INSERT INTO dbo.CAL_EVENTOS_HISTORIAL
    (serie, tipo, equipo_id, programa_id, fecha_programada, accion, detalle, despues, usuario, fecha)
  SELECT e.serie, e.tipo, e.equipo_id, e.programa_id, e.fecha_programada, ''INICIAL'',
    N''Estado al iniciar el historial'',
    (SELECT e.estado,
        CONVERT(varchar(10), e.fecha_reprogramada, 23) AS fechaReprogramada,
        CONVERT(varchar(10), e.fecha_realizada, 23) AS fechaRealizada,
        e.resultado, e.observaciones, e.registro_ref AS registroRef
     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    e.actualizado_por, e.actualizado_en
  FROM dbo.CAL_EVENTOS e
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CAL_EVENTOS_HISTORIAL h
    WHERE h.serie = e.serie AND h.fecha_programada = e.fecha_programada
  );
');

EXEC(N'
  INSERT INTO dbo.CAL_PLAN_HISTORIAL
    (entidad, programa_id, tipo, equipo_id, accion, detalle, despues, usuario, fecha)
  SELECT ''PROGRAMA'', p.id, p.tipo, p.equipo_id, ''INICIAL'',
    N''Configuración al iniciar el historial'',
    (SELECT p.activo, p.titulo, p.frecuencia_meses AS frecuenciaMeses,
        CONVERT(varchar(10), p.fecha_inicio, 23) AS fechaInicio,
        p.responsable_nombre AS responsable, p.alerta_dias AS alertaDias,
        p.alerta_frecuencia AS alertaFrecuencia, p.alerta_correo AS alertaCorreo
     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    COALESCE(p.actualizado_por, p.creado_por), COALESCE(p.actualizado_en, p.creado_en)
  FROM dbo.CAL_PROGRAMAS p
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CAL_PLAN_HISTORIAL h WHERE h.entidad = ''PROGRAMA'' AND h.programa_id = p.id
  );
');
