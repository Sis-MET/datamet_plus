-- ========================================================================
-- MIGRACIÓN 021: CONFIGURACIÓN DEL MÉTODO DE CALIBRACIÓN
-- ========================================================================
-- Fase 6 (docs/calibracion-plan-implementacion.md). Los parámetros, tablas y
-- textos del certificado que el laboratorio ajusta sin tocar las fórmulas
-- (empuje, deriva, convección, densidades por material, avisos, información
-- en uso, pesada mínima y textos) se guardan por versión. Cada versión nueva
-- se redacta como borrador y la aprueba el jefe de Calibración; quien la
-- redactó o la editó no la aprueba (NB/ISO/IEC 17025, 7.11.2).
--
-- Rige la versión vigente: los registros que aún no se aprueban se calculan
-- con ella; los aprobados, autorizados y emitidos conservan la suya
-- (CAL_REGISTROS.configuracion). Ninguna versión se borra (8.4).
--
-- La versión 1 (configuración inicial del sistema) la crea DataMET+ la
-- primera vez que se abre la pantalla, con los valores de la fase 0, y el
-- jefe la aprueba ahí.
-- ========================================================================

SET NOCOUNT ON;

IF OBJECT_ID('dbo.CAL_METODO_VERSIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_METODO_VERSIONES (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_METODO_VERSIONES PRIMARY KEY,
    version          INT            NOT NULL,
    -- BORRADOR → VIGENTE → REEMPLAZADA; DESCARTADA si el borrador no se aprueba.
    estado           VARCHAR(12)    NOT NULL,
    -- Versión de la que partió el borrador (para mostrar sus diferencias).
    base             INT            NULL,
    -- Parámetros y textos (JSON).
    contenido        NVARCHAR(MAX)  NOT NULL,
    -- Sube con cada guardado del borrador: evita pisar lo que guardó otra persona.
    revision         INT            NOT NULL CONSTRAINT DF_CAL_METODO_REVISION DEFAULT 1,
    -- Por qué se cambia (lo escribe quien crea el borrador).
    motivo           NVARCHAR(500)  NULL,
    creado_por       NVARCHAR(50)   NOT NULL,
    creado_nombre    NVARCHAR(120)  NULL,
    creado_en        DATETIME2      NOT NULL CONSTRAINT DF_CAL_METODO_CREADO DEFAULT SYSUTCDATETIME(),
    modificado_por   NVARCHAR(50)   NULL,
    modificado_en    DATETIME2      NULL,
    aprobado_por     NVARCHAR(50)   NULL,
    aprobado_nombre  NVARCHAR(120)  NULL,
    aprobado_en      DATETIME2      NULL,
    -- Desde y hasta cuándo rigió (la 1 rige desde el inicio: sin fecha).
    vigente_desde    DATETIME2      NULL,
    vigente_hasta    DATETIME2      NULL,
    CONSTRAINT UX_CAL_METODO_VERSION UNIQUE (version),
    CONSTRAINT CK_CAL_METODO_ESTADO CHECK (estado IN ('BORRADOR', 'VIGENTE', 'REEMPLAZADA', 'DESCARTADA')),
    CONSTRAINT CK_CAL_METODO_CONTENIDO CHECK (ISJSON(contenido) = 1),
    CONSTRAINT CK_CAL_METODO_NUMERO CHECK (version >= 1),
    -- Desde la 2, solo rige una versión aprobada; la 1 es la inicial del sistema.
    CONSTRAINT CK_CAL_METODO_APROBADA CHECK (
      estado NOT IN ('VIGENTE', 'REEMPLAZADA') OR version = 1 OR (aprobado_por IS NOT NULL AND aprobado_en IS NOT NULL)
    )
  );
END;

-- Una sola versión vigente y un solo borrador a la vez.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CAL_METODO_VIGENTE')
  EXEC(N'CREATE UNIQUE INDEX UX_CAL_METODO_VIGENTE ON dbo.CAL_METODO_VERSIONES (estado) WHERE estado = ''VIGENTE''');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CAL_METODO_BORRADOR')
  EXEC(N'CREATE UNIQUE INDEX UX_CAL_METODO_BORRADOR ON dbo.CAL_METODO_VERSIONES (estado) WHERE estado = ''BORRADOR''');

IF OBJECT_ID('dbo.CAL_METODO_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_METODO_HISTORIAL (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_METODO_HISTORIAL PRIMARY KEY,
    version_id      INT            NOT NULL CONSTRAINT FK_CAL_METODO_HISTORIAL_Version REFERENCES dbo.CAL_METODO_VERSIONES (id),
    accion          VARCHAR(12)    NOT NULL,
    -- En una edición: los cambios [{ ruta, antes, despues }] (JSON).
    detalle         NVARCHAR(MAX)  NULL,
    motivo          NVARCHAR(500)  NULL,
    usuario         NVARCHAR(50)   NOT NULL,
    usuario_nombre  NVARCHAR(120)  NULL,
    fecha           DATETIME2      NOT NULL CONSTRAINT DF_CAL_METODO_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_METODO_HISTORIAL_ACCION CHECK (accion IN ('CREACION', 'EDICION', 'APROBACION', 'DESCARTE')),
    CONSTRAINT CK_CAL_METODO_HISTORIAL_DETALLE CHECK (detalle IS NULL OR ISJSON(detalle) = 1)
  );
  CREATE INDEX IX_CAL_METODO_HISTORIAL_Version ON dbo.CAL_METODO_HISTORIAL (version_id);
END;

-- Control de cambios (7.11.2).
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: configuración del método por versiones, con aprobación del jefe';
  IF NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE titulo = @titulo)
  BEGIN
    DECLARE @anio CHAR(4) = CONVERT(char(4), YEAR(DATEADD(hour, -4, SYSUTCDATETIME())));
    DECLARE @ultimo INT;
    SELECT @ultimo = ISNULL(MAX(CAST(RIGHT(codigo, 3) AS INT)), 0)
    FROM dbo.APP_CAMBIOS WITH (UPDLOCK, HOLDLOCK)
    WHERE codigo LIKE 'CC-' + @anio + '-[0-9][0-9][0-9]';

    INSERT INTO dbo.APP_CAMBIOS
      (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
       estado, a_posteriori, registrado_por)
    VALUES (
      'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.16.0', @titulo, 'MEJORA', N'Calibración',
      N'Los parámetros del cálculo de los certificados de balanzas (incertidumbre del empuje, factor de deriva, convección, densidades por material, umbrales de avisos, información en uso y pesada mínima) y los textos del certificado se editan en Calibración > Método como una versión en borrador. La aprueba el jefe de Calibración, que no puede haberla redactado; queda el historial con las diferencias. Los registros sin aprobar se calculan con la versión vigente; los aprobados, autorizados y emitidos conservan la suya. Las fórmulas, la probabilidad de cobertura y el redondeo siguen fijos en el código.',
      N'Crea CAL_METODO_VERSIONES y CAL_METODO_HISTORIAL (migración 021). La versión 1 se crea con los valores de la fase 0 al abrir la pantalla por primera vez. No cambia ningún certificado emitido.',
      N'Migración 021; calibration.metodo.js; calibration.calculo.js; calibration.certificado.js; docs/calibracion-plan-implementacion.md (fase 6).',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 021'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 021', N'migración 021');
  END;
END;
