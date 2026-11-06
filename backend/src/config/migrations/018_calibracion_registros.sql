-- ========================================================================
-- MIGRACIÓN 018: REGISTROS DE CALIBRACIÓN DE BALANZAS
-- ========================================================================
-- Fase 4 de los certificados de calibración en DataMET+
-- (docs/calibracion-plan-implementacion.md). Un registro por servicio de
-- ServiceMET (codigo_registro de DATA_SERVICIOS_DATOS_CALIBRACION), que
-- elabora el personal de Calibración y revisa el jefe de Calibración.
--
-- La fila de ServiceMET es la observación original y no se toca (NB/ISO/IEC
-- 17025, 7.5): las correcciones van por columna en `datos`, con la clase del
-- instrumento y su origen. Cada guardado queda en el historial con su valor
-- anterior y nuevo (7.5.2).
--
-- Estados: BORRADOR → EN_REVISION → APROBADO, u OBSERVADO (vuelve al
-- borrador). Al enviar se guarda la huella SHA-256 de la fila y de las
-- correcciones: si cambian, no se puede aprobar sin volver a enviar. Al
-- aprobar se guarda el resultado del cálculo y la versión de la configuración
-- del método con que se calculó.
--
-- Las tablas nuevas se usan dentro de EXEC: el lote se compila completo antes
-- de ejecutarse y en ese momento todavía no existen.
-- ========================================================================

SET NOCOUNT ON;

IF OBJECT_ID('dbo.CAL_REGISTROS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_REGISTROS (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_REGISTROS PRIMARY KEY,
    codigo_registro  NVARCHAR(100)  NOT NULL,
    -- { "columnas": { columna: valor }, "clase": { "valor", "origen" } | null }
    datos            NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_CAL_REGISTROS_DATOS DEFAULT N'{}',
    estado           VARCHAR(20)    NOT NULL CONSTRAINT DF_CAL_REGISTROS_ESTADO DEFAULT 'BORRADOR',
    huella           VARCHAR(64)    NULL,
    version          INT            NOT NULL CONSTRAINT DF_CAL_REGISTROS_VERSION DEFAULT 1,
    creado_por       NVARCHAR(50)   NOT NULL,
    creado_en        DATETIME2      NOT NULL CONSTRAINT DF_CAL_REGISTROS_CREADO DEFAULT SYSUTCDATETIME(),
    actualizado_por  NVARCHAR(50)   NULL,
    actualizado_en   DATETIME2      NULL,
    enviado_por      NVARCHAR(50)   NULL,
    enviado_en       DATETIME2      NULL,
    revisado_por     NVARCHAR(50)   NULL,
    revisado_en      DATETIME2      NULL,
    observacion      NVARCHAR(500)  NULL,
    configuracion    INT            NULL,
    resultado        NVARCHAR(MAX)  NULL,
    CONSTRAINT UQ_CAL_REGISTROS_Codigo UNIQUE (codigo_registro),
    CONSTRAINT CK_CAL_REGISTROS_ESTADO CHECK (estado IN ('BORRADOR', 'EN_REVISION', 'OBSERVADO', 'APROBADO')),
    CONSTRAINT CK_CAL_REGISTROS_DATOS CHECK (ISJSON(datos) = 1),
    CONSTRAINT CK_CAL_REGISTROS_RESULTADO CHECK (resultado IS NULL OR ISJSON(resultado) = 1),
    CONSTRAINT CK_CAL_REGISTROS_ENVIO CHECK (
      estado = 'BORRADOR' OR (huella IS NOT NULL AND enviado_por IS NOT NULL AND enviado_en IS NOT NULL)
    ),
    CONSTRAINT CK_CAL_REGISTROS_REVISION CHECK (
      estado NOT IN ('APROBADO', 'OBSERVADO') OR (revisado_por IS NOT NULL AND revisado_en IS NOT NULL)
    ),
    CONSTRAINT CK_CAL_REGISTROS_APROBADO CHECK (estado <> 'APROBADO' OR resultado IS NOT NULL)
  );
END;

IF OBJECT_ID('dbo.CAL_REGISTROS_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_REGISTROS_HISTORIAL (
    id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_REGISTROS_HISTORIAL PRIMARY KEY,
    registro_id     INT            NOT NULL CONSTRAINT FK_CAL_REGISTROS_HISTORIAL_Registro REFERENCES dbo.CAL_REGISTROS (id),
    accion          VARCHAR(20)    NOT NULL,
    detalle         NVARCHAR(400)  NULL,
    motivo          NVARCHAR(500)  NULL,
    -- [{ "campo": "...", "antes": ..., "despues": ... }]
    cambios         NVARCHAR(MAX)  NULL,
    usuario         NVARCHAR(50)   NOT NULL,
    usuario_nombre  NVARCHAR(120)  NULL,
    fecha           DATETIME2      NOT NULL CONSTRAINT DF_CAL_REGISTROS_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_REGISTROS_HISTORIAL_ACCION CHECK (accion IN (
      'CREACION', 'EDICION', 'ENVIO', 'RETIRO', 'APROBACION', 'OBSERVACION', 'REAPERTURA'
    )),
    CONSTRAINT CK_CAL_REGISTROS_HISTORIAL_CAMBIOS CHECK (cambios IS NULL OR ISJSON(cambios) = 1)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CAL_REGISTROS_HISTORIAL_Registro')
  EXEC(N'CREATE INDEX IX_CAL_REGISTROS_HISTORIAL_Registro ON dbo.CAL_REGISTROS_HISTORIAL (registro_id, fecha DESC)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CAL_REGISTROS_Estado')
  EXEC(N'CREATE INDEX IX_CAL_REGISTROS_Estado ON dbo.CAL_REGISTROS (estado)');

-- Control de cambios (7.11.2).
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: registros de calibración con revisión del jefe';
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
      'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.15.0', @titulo, 'MEJORA', N'Calibración',
      N'Cada servicio de calibración de ServiceMET tiene su registro en DataMET+: el personal de Calibración corrige sus datos (por columna, sin tocar la fila original), registra la clase del instrumento con su origen, lo calcula con el motor y lo envía a revisión; el jefe de Calibración lo aprueba u observa. Es la fase 4 de los certificados de calibración.',
      N'Crea CAL_REGISTROS y CAL_REGISTROS_HISTORIAL (migración 018). DATA_SERVICIOS_DATOS_CALIBRACION solo se lee (7.5). Cada guardado queda con su valor anterior y nuevo (7.5.2); al enviar se guarda la huella de los datos y al aprobar, el resultado del cálculo (7.11.6).',
      N'Migración 018; calibration.registros.js; docs/calibracion-plan-implementacion.md (fase 4).',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 018'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 018', N'migración 018');
  END;
END;
