-- ========================================================================
-- MIGRACIÓN 017: PUNTOS DE ENSAYO ACORDADOS DE LOS INSTRUMENTOS DE CLIENTES
-- ========================================================================
-- Fase 2 de los certificados de calibración en DataMET+
-- (docs/calibracion-plan-implementacion.md). Las cargas de ensayo acordadas
-- para cada balanza de un cliente (excentricidad, repetibilidad y error de
-- indicación) estaban en Access (tabla ICLI) y en DATA_SERVICIOS_LEC. Pasan
-- a SQL y las mantiene Calibración en DataMET+. Son una referencia: DataMET+
-- avisa si el técnico usó otras cargas; el certificado usa lo medido.
--
-- CAL_PUNTOS_ACORDADOS           : una fila por instrumento (código Métrica
--                                  de DATA_EQUIPOS), con la unidad de las
--                                  cargas y de dónde salieron.
-- CAL_PUNTOS_ACORDADOS_CARGAS    : cada carga acordada por ensayo (EXC, REP,
--                                  ERR) y orden.
-- CAL_PUNTOS_ACORDADOS_HISTORIAL : versiones completas antes/después, con
--                                  quién, cuándo y motivo (NB/ISO/IEC 17025,
--                                  7.5.2).
--
-- Las tablas nuevas se usan dentro de EXEC: el lote se compila completo antes
-- de ejecutarse y en ese momento todavía no existen.
-- ========================================================================

SET NOCOUNT ON;

IF OBJECT_ID('dbo.CAL_PUNTOS_ACORDADOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_PUNTOS_ACORDADOS (
    cod_metrica     NVARCHAR(30)   NOT NULL CONSTRAINT PK_CAL_PUNTOS_ACORDADOS PRIMARY KEY,
    unidad          NVARCHAR(10)   NULL,
    origen          VARCHAR(10)    NOT NULL,
    origen_ref      NVARCHAR(50)   NULL,
    origen_fecha    DATE           NULL,
    observaciones   NVARCHAR(500)  NULL,
    version         INT            NOT NULL CONSTRAINT DF_CAL_PUNTOS_ACORDADOS_VERSION DEFAULT 1,
    registrado_por  NVARCHAR(50)   NOT NULL,
    registrado_en   DATETIME2      NOT NULL CONSTRAINT DF_CAL_PUNTOS_ACORDADOS_REGISTRADO DEFAULT SYSUTCDATETIME(),
    actualizado_por NVARCHAR(50)   NULL,
    actualizado_en  DATETIME2      NULL,
    CONSTRAINT CK_CAL_PUNTOS_ACORDADOS_UNIDAD CHECK (unidad IS NULL OR unidad IN ('mg', 'g', 'kg', 't')),
    CONSTRAINT CK_CAL_PUNTOS_ACORDADOS_ORIGEN CHECK (origen IN ('ICLI', 'LEC', 'DATAMET'))
  );
END;

IF OBJECT_ID('dbo.CAL_PUNTOS_ACORDADOS_CARGAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_PUNTOS_ACORDADOS_CARGAS (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_PUNTOS_ACORDADOS_CARGAS PRIMARY KEY,
    cod_metrica NVARCHAR(30)      NOT NULL CONSTRAINT FK_CAL_PUNTOS_ACORDADOS_CARGAS_Instrumento
                                  REFERENCES dbo.CAL_PUNTOS_ACORDADOS (cod_metrica),
    ensayo      VARCHAR(3)        NOT NULL,
    orden       INT               NOT NULL,
    carga       DECIMAL(18, 8)    NOT NULL,
    CONSTRAINT CK_CAL_PUNTOS_ACORDADOS_CARGAS_ENSAYO CHECK (ensayo IN ('EXC', 'REP', 'ERR')),
    CONSTRAINT CK_CAL_PUNTOS_ACORDADOS_CARGAS_CARGA CHECK (carga > 0),
    CONSTRAINT UQ_CAL_PUNTOS_ACORDADOS_CARGAS UNIQUE (cod_metrica, ensayo, orden)
  );
END;

IF OBJECT_ID('dbo.CAL_PUNTOS_ACORDADOS_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_PUNTOS_ACORDADOS_HISTORIAL (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_PUNTOS_ACORDADOS_HISTORIAL PRIMARY KEY,
    cod_metrica NVARCHAR(30)      NOT NULL,
    accion      VARCHAR(20)       NOT NULL,
    antes       NVARCHAR(MAX)     NULL,
    despues     NVARCHAR(MAX)     NULL,
    motivo      NVARCHAR(500)     NULL,
    usuario     NVARCHAR(50)      NOT NULL,
    fecha       DATETIME2         NOT NULL CONSTRAINT DF_CAL_PUNTOS_ACORDADOS_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_PUNTOS_ACORDADOS_HISTORIAL_ACCION CHECK (accion IN ('CARGA_INICIAL', 'EDICION'))
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CAL_PUNTOS_ACORDADOS_HISTORIAL_Instrumento')
  EXEC(N'CREATE INDEX IX_CAL_PUNTOS_ACORDADOS_HISTORIAL_Instrumento ON dbo.CAL_PUNTOS_ACORDADOS_HISTORIAL (cod_metrica, fecha DESC)');

-- Control de cambios (7.11.2).
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: lectura de los servicios de ServiceMET y puntos acordados';
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
      N'DataMET+ lee los servicios de calibración que sube ServiceMET y los convierte en un modelo estructurado con avisos de calidad de datos (técnico sin identificar, patrones sin certificado vigente o sin valores verificados, ensayos incompletos, condiciones fuera de rango, cargas distintas de las acordadas). Los puntos de ensayo acordados de cada instrumento pasan de Access (ICLI) y DATA_SERVICIOS_LEC a SQL y los mantiene Calibración. Es la fase 2 de los certificados de calibración en DataMET+.',
      N'Crea CAL_PUNTOS_ACORDADOS, CAL_PUNTOS_ACORDADOS_CARGAS y CAL_PUNTOS_ACORDADOS_HISTORIAL (migración 017). Solo lee DATA_SERVICIOS_DATOS_CALIBRACION: la fila de ServiceMET no se modifica (7.5).',
      N'Migración 017; calibration.fuente.js; calibration.servicios.js; calibration.puntos.js; docs/calibracion-plan-implementacion.md (fase 2).',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 017'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 017', N'migración 017');
  END;
END;
