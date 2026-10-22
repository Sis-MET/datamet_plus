-- ========================================================================
-- MIGRACIÓN 009: PRÓXIMOS SERVICIOS DE SOPORTE TÉCNICO
-- ========================================================================
-- La fecha del próximo servicio de cada equipo se calcula de los servicios
-- de ServiceMET (DATA_SERVICIOS_DATOS_*, sin modificarlas) y de las
-- correcciones de los informes (ST_INFORMES). Esta migración solo agrega lo
-- que hace el área a partir de esas fechas:
--
-- ST_PROXIMOS_SEGUIMIENTO : cada gestión de un próximo servicio (contacto con
--                           el cliente, visita coordinada, reprogramación,
--                           descarte y reactivación) con su nota o motivo,
--                           quién y cuándo. Solo se agregan filas: el estado
--                           vigente es la suma de las gestiones (7.5.2).
-- ST_AVISOS_AJUSTES       : anticipación, repetición, correo y hora de envío
--                           de los avisos (una sola fila).
-- ST_AVISOS_CONTACTOS     : quiénes reciben los correos de aviso.
-- ST_AVISOS_HISTORIAL     : cada cambio de los ajustes y los destinatarios,
--                           con antes, después, quién y cuándo (7.11.2).
-- ST_AVISOS_ENVIOS        : bitácora de correos enviados; marca la
--                           frecuencia de repetición.
--
-- Registra el cambio en el Control de cambios (APP_CAMBIOS, migración 007).
-- Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.ST_PROXIMOS_SEGUIMIENTO', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_PROXIMOS_SEGUIMIENTO (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_PROXIMOS_SEGUIMIENTO PRIMARY KEY,
    cod_metrica     NVARCHAR(50)   NOT NULL,
    -- Servicio que sugirió la fecha: el seguimiento es de esa sugerencia.
    origen_tipo     VARCHAR(10)    NOT NULL,
    origen_codigo   NVARCHAR(100)  NOT NULL,
    -- Fecha vigente de la sugerencia al registrar la gestión.
    fecha_sugerida  DATE           NULL,
    accion          VARCHAR(20)    NOT NULL,
    -- Fecha acordada (coordinación) o nueva fecha (reprogramación).
    fecha_nueva     DATE           NULL,
    nota            NVARCHAR(500)  NOT NULL,
    usuario         NVARCHAR(50)   NOT NULL,
    usuario_nombre  NVARCHAR(120)  NULL,
    registrado_en   DATETIME2      NOT NULL CONSTRAINT DF_ST_PROXIMOS_SEGUIMIENTO_EN DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ST_PROXIMOS_SEGUIMIENTO_TIPO CHECK (origen_tipo IN ('DIG', 'IBM', 'INT', 'MCR', 'MPA', 'MPR', 'RVD', 'VFI')),
    CONSTRAINT CK_ST_PROXIMOS_SEGUIMIENTO_ACCION CHECK (accion IN ('CONTACTO', 'COORDINACION', 'REPROGRAMACION', 'DESCARTE', 'REACTIVACION')),
    CONSTRAINT CK_ST_PROXIMOS_SEGUIMIENTO_FECHA CHECK (
      (accion IN ('COORDINACION', 'REPROGRAMACION') AND fecha_nueva IS NOT NULL)
      OR (accion NOT IN ('COORDINACION', 'REPROGRAMACION') AND fecha_nueva IS NULL)
    ),
    CONSTRAINT CK_ST_PROXIMOS_SEGUIMIENTO_NOTA CHECK (LEN(LTRIM(RTRIM(nota))) > 0)
  );

  CREATE INDEX IX_ST_PROXIMOS_SEGUIMIENTO_Origen ON dbo.ST_PROXIMOS_SEGUIMIENTO (origen_tipo, origen_codigo, id);
  CREATE INDEX IX_ST_PROXIMOS_SEGUIMIENTO_Equipo ON dbo.ST_PROXIMOS_SEGUIMIENTO (cod_metrica, id);
END;

IF OBJECT_ID('dbo.ST_AVISOS_AJUSTES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_AVISOS_AJUSTES (
    id                INT          NOT NULL CONSTRAINT PK_ST_AVISOS_AJUSTES PRIMARY KEY,
    alerta_dias       INT          NOT NULL CONSTRAINT DF_ST_AVISOS_AJUSTES_DIAS DEFAULT 30,
    alerta_frecuencia VARCHAR(10)  NOT NULL CONSTRAINT DF_ST_AVISOS_AJUSTES_FREC DEFAULT 'SEMANAL',
    alerta_correo     BIT          NOT NULL CONSTRAINT DF_ST_AVISOS_AJUSTES_CORREO DEFAULT 1,
    hora_envio        CHAR(5)      NOT NULL CONSTRAINT DF_ST_AVISOS_AJUSTES_HORA DEFAULT '08:00',
    ultima_revision   DATE         NULL,
    actualizado_por   NVARCHAR(50) NULL,
    actualizado_en    DATETIME2    NULL,
    CONSTRAINT CK_ST_AVISOS_AJUSTES_UNICA CHECK (id = 1),
    CONSTRAINT CK_ST_AVISOS_AJUSTES_DIAS CHECK (alerta_dias BETWEEN 0 AND 365),
    CONSTRAINT CK_ST_AVISOS_AJUSTES_FREC CHECK (alerta_frecuencia IN ('UNICA', 'SEMANAL', 'DIARIA', 'NINGUNA')),
    CONSTRAINT CK_ST_AVISOS_AJUSTES_HORA CHECK (hora_envio LIKE '[0-2][0-9]:[0-5][0-9]')
  );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ST_AVISOS_AJUSTES WHERE id = 1)
  INSERT INTO dbo.ST_AVISOS_AJUSTES (id) VALUES (1);

IF OBJECT_ID('dbo.ST_AVISOS_CONTACTOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_AVISOS_CONTACTOS (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_AVISOS_CONTACTOS PRIMARY KEY,
    usuario_id      INT           NULL,
    nombre          NVARCHAR(100) NOT NULL,
    email           NVARCHAR(150) NOT NULL,
    activo          BIT           NOT NULL CONSTRAINT DF_ST_AVISOS_CONTACTOS_ACTIVO DEFAULT 1,
    creado_por      NVARCHAR(50)  NOT NULL,
    creado_en       DATETIME2     NOT NULL CONSTRAINT DF_ST_AVISOS_CONTACTOS_CREADO DEFAULT SYSUTCDATETIME(),
    actualizado_por NVARCHAR(50)  NULL,
    actualizado_en  DATETIME2     NULL,
    CONSTRAINT UQ_ST_AVISOS_CONTACTOS_Email UNIQUE (email)
  );

  CREATE UNIQUE NONCLUSTERED INDEX UX_ST_AVISOS_CONTACTOS_Usuario
    ON dbo.ST_AVISOS_CONTACTOS (usuario_id)
    WHERE usuario_id IS NOT NULL;
END;

IF OBJECT_ID('dbo.ST_AVISOS_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_AVISOS_HISTORIAL (
    id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_AVISOS_HISTORIAL PRIMARY KEY,
    entidad     VARCHAR(20)    NOT NULL,
    entidad_id  INT            NULL,
    accion      VARCHAR(20)    NOT NULL,
    detalle     NVARCHAR(400)  NULL,
    antes       NVARCHAR(MAX)  NULL,
    despues     NVARCHAR(MAX)  NULL,
    usuario     NVARCHAR(50)   NOT NULL,
    fecha       DATETIME2      NOT NULL CONSTRAINT DF_ST_AVISOS_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ST_AVISOS_HISTORIAL_ENTIDAD CHECK (entidad IN ('AJUSTES', 'CONTACTO')),
    CONSTRAINT CK_ST_AVISOS_HISTORIAL_ACCION CHECK (accion IN ('ALTA', 'EDICION', 'BAJA')),
    CONSTRAINT CK_ST_AVISOS_HISTORIAL_ANTES CHECK (antes IS NULL OR ISJSON(antes) = 1),
    CONSTRAINT CK_ST_AVISOS_HISTORIAL_DESPUES CHECK (despues IS NULL OR ISJSON(despues) = 1)
  );
END;

IF OBJECT_ID('dbo.ST_AVISOS_ENVIOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_AVISOS_ENVIOS (
    id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_AVISOS_ENVIOS PRIMARY KEY,
    cod_metrica    NVARCHAR(50)   NOT NULL,
    origen_tipo    VARCHAR(10)    NOT NULL,
    origen_codigo  NVARCHAR(100)  NOT NULL,
    -- Fecha del próximo servicio avisada: si se reprograma, el aviso empieza de nuevo.
    fecha_aviso    DATE           NOT NULL,
    email          NVARCHAR(150)  NOT NULL,
    motivo         VARCHAR(10)    NOT NULL,
    estado         VARCHAR(10)    NOT NULL,
    error          NVARCHAR(400)  NULL,
    fecha_local    DATE           NOT NULL,
    enviado_en     DATETIME2      NOT NULL CONSTRAINT DF_ST_AVISOS_ENVIOS_EN DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ST_AVISOS_ENVIOS_MOTIVO CHECK (motivo IN ('PREVIO', 'HOY', 'VENCIDO')),
    CONSTRAINT CK_ST_AVISOS_ENVIOS_ESTADO CHECK (estado IN ('ENVIADO', 'ERROR'))
  );

  CREATE INDEX IX_ST_AVISOS_ENVIOS_Origen ON dbo.ST_AVISOS_ENVIOS (origen_tipo, origen_codigo, fecha_aviso, email)
    INCLUDE (motivo, estado, fecha_local);
END;

-- Control de cambios (7.11.2): queda registrado para validarse y aprobarse
-- antes de su puesta en producción.
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-020')
BEGIN
  INSERT INTO dbo.APP_CAMBIOS
    (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
     estado, a_posteriori, registrado_por)
  VALUES
    ('CC-2026-020', N'2.9.0', N'Soporte técnico: próximos servicios y avisos', 'MODULO', N'Soporte técnico',
     N'Pestaña «Próximos servicios»: la fecha del próximo servicio de cada equipo (Código Métrica) sale del último mantenimiento, instalación o verificación que la sugirió; el diagnóstico y el relevamiento no la cambian. Muestra lo vencido y lo que está por vencer en «Requieren atención» y en las vistas de mes y agenda (agrupado por cliente y planta, con la OTST del servicio anterior como referencia), una línea de tiempo anual por cliente y equipo y el contador en la barra lateral. Pestaña «Avisos»: anticipación, repetición, hora y destinatarios de un correo diario con lo vencido y lo próximo. El seguimiento de cada fecha (contacto, visita coordinada, reprogramación, descarte y reactivación, con nota o motivo e historial) queda listo en el backend pero oculto en la interfaz hasta que el área defina su procedimiento (migración 009).',
     N'Lee DATA_SERVICIOS_DATOS_* y ST_INFORMES sin modificarlos; crea ST_PROXIMOS_SEGUIMIENTO (solo inserción), ST_AVISOS_AJUSTES, ST_AVISOS_CONTACTOS, ST_AVISOS_HISTORIAL y ST_AVISOS_ENVIOS. El correo usa el mismo servidor SMTP que las alertas de calibración; se apaga con ST_ALERTS_ENABLED=false.',
     N'Migración 009; backend/src/services/soporte.proximos*.js, soporte.scheduler.js; src/features/soporte/components/proximos.', '2026-10-22', 'REGISTRADO', 0, N'migración 009');

  INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
  SELECT id, 'REGISTRO', N'Registrado al agregar los próximos servicios de Soporte técnico', N'migración 009'
  FROM dbo.APP_CAMBIOS
  WHERE codigo = 'CC-2026-020';
END;
