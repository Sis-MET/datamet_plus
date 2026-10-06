-- ========================================================================
-- MIGRACIÓN 004: CRONOGRAMA DE CALIBRACIÓN
-- ========================================================================
-- Módulo independiente del cronograma del personal. Lee los equipos de
-- DATA_EQUIPOS_CAL (que no se modifica) y guarda aquí su planificación.
--
-- CAL_PROGRAMAS        : configuración de cada serie del plan. Una fila por
--                        equipo y tipo (CALIBRACION, VERIFICACION) o por
--                        actividad del área (ACTIVIDAD). La calibración de un
--                        equipo existe aunque no tenga fila: sale del
--                        certificado (cert_fecha + cert_periodo días).
-- CAL_EVENTOS          : estado de una fecha concreta de una serie
--                        (realizada, reprogramada, cancelada...). Las fechas
--                        se calculan; solo se guarda lo que el personal cambia.
-- CAL_AJUSTES          : valores por defecto de las alertas (fila única).
-- CAL_CONTACTOS        : correos que reciben las alertas.
-- CAL_ALERTAS_ENVIOS   : bitácora de correos enviados; marca la frecuencia.
-- Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.CAL_PROGRAMAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_PROGRAMAS (
    id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_PROGRAMAS PRIMARY KEY,
    tipo               VARCHAR(20)   NOT NULL,
    equipo_id          INT           NULL,
    titulo             NVARCHAR(150) NULL,
    categoria          NVARCHAR(60)  NULL,
    descripcion        NVARCHAR(500) NULL,
    frecuencia_meses   INT           NULL,
    fecha_inicio       DATE          NULL,
    responsable_id     INT           NULL,
    responsable_nombre NVARCHAR(100) NULL,
    alerta_dias        INT           NULL,
    alerta_frecuencia  VARCHAR(10)   NULL,
    alerta_correo      BIT           NULL,
    activo             BIT           NOT NULL CONSTRAINT DF_CAL_PROGRAMAS_ACTIVO DEFAULT 1,
    creado_por         NVARCHAR(50)  NULL,
    creado_en          DATETIME2     NOT NULL CONSTRAINT DF_CAL_PROGRAMAS_CREADO DEFAULT SYSUTCDATETIME(),
    actualizado_por    NVARCHAR(50)  NULL,
    actualizado_en     DATETIME2     NULL,
    CONSTRAINT CK_CAL_PROGRAMAS_TIPO CHECK (tipo IN ('CALIBRACION', 'VERIFICACION', 'ACTIVIDAD')),
    CONSTRAINT CK_CAL_PROGRAMAS_FRECUENCIA CHECK (frecuencia_meses IS NULL OR frecuencia_meses BETWEEN 0 AND 120),
    CONSTRAINT CK_CAL_PROGRAMAS_ALERTA_DIAS CHECK (alerta_dias IS NULL OR alerta_dias BETWEEN 0 AND 365),
    CONSTRAINT CK_CAL_PROGRAMAS_ALERTA_FREC CHECK (alerta_frecuencia IS NULL OR alerta_frecuencia IN ('UNICA', 'SEMANAL', 'DIARIA', 'NINGUNA')),
    CONSTRAINT CK_CAL_PROGRAMAS_EQUIPO CHECK (
      (tipo = 'ACTIVIDAD' AND equipo_id IS NULL) OR (tipo <> 'ACTIVIDAD' AND equipo_id IS NOT NULL)
    )
  );
END;

-- Dinámico: la tabla recién creada no existe al compilar este lote.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_PROGRAMAS') AND name = 'UX_CAL_PROGRAMAS_Equipo'
)
BEGIN
  EXEC('CREATE UNIQUE NONCLUSTERED INDEX UX_CAL_PROGRAMAS_Equipo
    ON dbo.CAL_PROGRAMAS (tipo, equipo_id)
    WHERE equipo_id IS NOT NULL;');
END;

IF OBJECT_ID('dbo.CAL_EVENTOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_EVENTOS (
    id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_EVENTOS PRIMARY KEY,
    serie              VARCHAR(30)   NOT NULL,
    tipo               VARCHAR(20)   NOT NULL,
    equipo_id          INT           NULL,
    programa_id        INT           NULL,
    fecha_programada   DATE          NOT NULL,
    fecha_reprogramada DATE          NULL,
    estado             VARCHAR(20)   NOT NULL CONSTRAINT DF_CAL_EVENTOS_ESTADO DEFAULT 'PROGRAMADO',
    fecha_realizada    DATE          NULL,
    resultado          VARCHAR(20)   NULL,
    observaciones      NVARCHAR(500) NULL,
    actualizado_por    NVARCHAR(50)  NULL,
    actualizado_en     DATETIME2     NOT NULL CONSTRAINT DF_CAL_EVENTOS_ACTUALIZADO DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_CAL_EVENTOS_Serie_Fecha UNIQUE (serie, fecha_programada),
    CONSTRAINT CK_CAL_EVENTOS_ESTADO CHECK (estado IN ('PROGRAMADO', 'EN_PROCESO', 'REALIZADO', 'CANCELADO')),
    CONSTRAINT CK_CAL_EVENTOS_RESULTADO CHECK (resultado IS NULL OR resultado IN ('CONFORME', 'NO_CONFORME'))
  );
END;

IF OBJECT_ID('dbo.CAL_AJUSTES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_AJUSTES (
    id                INT          NOT NULL CONSTRAINT PK_CAL_AJUSTES PRIMARY KEY,
    alerta_dias       INT          NOT NULL CONSTRAINT DF_CAL_AJUSTES_DIAS DEFAULT 30,
    alerta_frecuencia VARCHAR(10)  NOT NULL CONSTRAINT DF_CAL_AJUSTES_FREC DEFAULT 'SEMANAL',
    alerta_correo     BIT          NOT NULL CONSTRAINT DF_CAL_AJUSTES_CORREO DEFAULT 1,
    hora_envio        CHAR(5)      NOT NULL CONSTRAINT DF_CAL_AJUSTES_HORA DEFAULT '08:00',
    ultima_revision   DATE         NULL,
    actualizado_por   NVARCHAR(50) NULL,
    actualizado_en    DATETIME2    NULL,
    CONSTRAINT CK_CAL_AJUSTES_UNICA CHECK (id = 1),
    CONSTRAINT CK_CAL_AJUSTES_DIAS CHECK (alerta_dias BETWEEN 0 AND 365),
    CONSTRAINT CK_CAL_AJUSTES_FREC CHECK (alerta_frecuencia IN ('UNICA', 'SEMANAL', 'DIARIA', 'NINGUNA'))
  );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.CAL_AJUSTES WHERE id = 1)
  INSERT INTO dbo.CAL_AJUSTES (id) VALUES (1);

IF OBJECT_ID('dbo.CAL_CONTACTOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_CONTACTOS (
    id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_CONTACTOS PRIMARY KEY,
    usuario_id     INT           NULL,
    nombre         NVARCHAR(100) NOT NULL,
    email          NVARCHAR(150) NOT NULL,
    recibe_todas   BIT           NOT NULL CONSTRAINT DF_CAL_CONTACTOS_TODAS DEFAULT 0,
    activo         BIT           NOT NULL CONSTRAINT DF_CAL_CONTACTOS_ACTIVO DEFAULT 1,
    creado_en      DATETIME2     NOT NULL CONSTRAINT DF_CAL_CONTACTOS_CREADO DEFAULT SYSUTCDATETIME(),
    actualizado_en DATETIME2     NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_CONTACTOS') AND name = 'UX_CAL_CONTACTOS_Usuario'
)
BEGIN
  EXEC('CREATE UNIQUE NONCLUSTERED INDEX UX_CAL_CONTACTOS_Usuario
    ON dbo.CAL_CONTACTOS (usuario_id)
    WHERE usuario_id IS NOT NULL;');
END;

IF OBJECT_ID('dbo.CAL_ALERTAS_ENVIOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_ALERTAS_ENVIOS (
    id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_ALERTAS_ENVIOS PRIMARY KEY,
    serie            VARCHAR(30)   NOT NULL,
    fecha_programada DATE          NOT NULL,
    email            NVARCHAR(150) NOT NULL,
    motivo           VARCHAR(10)   NOT NULL,
    estado           VARCHAR(10)   NOT NULL,
    error            NVARCHAR(400) NULL,
    fecha_local      DATE          NOT NULL,
    enviado_en       DATETIME2     NOT NULL CONSTRAINT DF_CAL_ALERTAS_ENVIOS_EN DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_ALERTAS_ENVIOS_MOTIVO CHECK (motivo IN ('PREVIO', 'HOY', 'VENCIDO')),
    CONSTRAINT CK_CAL_ALERTAS_ENVIOS_ESTADO CHECK (estado IN ('ENVIADO', 'ERROR'))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_ALERTAS_ENVIOS') AND name = 'IX_CAL_ALERTAS_ENVIOS_Serie'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_ALERTAS_ENVIOS_Serie
    ON dbo.CAL_ALERTAS_ENVIOS (serie, fecha_programada, email)
    INCLUDE (motivo, estado, fecha_local);');
END;
