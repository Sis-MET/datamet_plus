-- ========================================================================
-- MIGRACIÓN 005: GESTIÓN DE EQUIPOS DE CALIBRACIÓN
-- ========================================================================
-- DATA_EQUIPOS_CAL sigue siendo la fuente del certificado vigente de cada
-- equipo (una fila por equipo, sin clave primaria). Esta migración no la
-- modifica: agrega lo que esa tabla no guarda.
--
-- CAL_CERTIFICADOS      : historial de certificados. Al renovar se conserva
--                         el anterior; anular el último restaura el previo.
-- CAL_EQUIPOS_HISTORIAL : bitácora de altas, ediciones, certificados, bajas
--                         y reactivaciones de cada equipo.
--
-- Siembra el historial con el certificado vigente de cada equipo. Es
-- idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.CAL_CERTIFICADOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_CERTIFICADOS (
    id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_CERTIFICADOS PRIMARY KEY,
    equipo_id         INT           NOT NULL,
    certificado       NVARCHAR(100) NULL,
    cert_fecha        DATE          NOT NULL,
    cert_periodo      INT           NULL,
    cert_fechaven     DATE          NULL,
    ente_calibrador   NVARCHAR(50)  NULL,
    observaciones     NVARCHAR(300) NULL,
    -- MIGRACION: sembrado desde DATA_EQUIPOS_CAL; MODULO: registrado aquí;
    -- EXTERNO: hallado en DATA_EQUIPOS_CAL al registrar otro (lo cambió
    -- otro sistema).
    origen            VARCHAR(10)   NOT NULL CONSTRAINT DF_CAL_CERTIFICADOS_ORIGEN DEFAULT 'MODULO',
    anulado           BIT           NOT NULL CONSTRAINT DF_CAL_CERTIFICADOS_ANULADO DEFAULT 0,
    motivo_anulacion  NVARCHAR(300) NULL,
    anulado_por       NVARCHAR(50)  NULL,
    anulado_en        DATETIME2     NULL,
    registrado_por    NVARCHAR(50)  NULL,
    registrado_en     DATETIME2     NOT NULL CONSTRAINT DF_CAL_CERTIFICADOS_REGISTRADO DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_CERTIFICADOS_ORIGEN CHECK (origen IN ('MIGRACION', 'MODULO', 'EXTERNO')),
    CONSTRAINT CK_CAL_CERTIFICADOS_PERIODO CHECK (cert_periodo IS NULL OR cert_periodo >= 0)
  );
END;

-- Dinámico: la tabla recién creada no existe al compilar este lote.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_CERTIFICADOS') AND name = 'IX_CAL_CERTIFICADOS_Equipo'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_CERTIFICADOS_Equipo
    ON dbo.CAL_CERTIFICADOS (equipo_id, cert_fecha DESC)
    INCLUDE (certificado, anulado);');
END;

IF OBJECT_ID('dbo.CAL_EQUIPOS_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_EQUIPOS_HISTORIAL (
    id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_EQUIPOS_HISTORIAL PRIMARY KEY,
    equipo_id  INT           NOT NULL,
    accion     VARCHAR(20)   NOT NULL,
    detalle    NVARCHAR(400) NULL,
    usuario    NVARCHAR(50)  NULL,
    fecha      DATETIME2     NOT NULL CONSTRAINT DF_CAL_EQUIPOS_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_EQUIPOS_HISTORIAL_ACCION CHECK (accion IN (
      'ALTA', 'EDICION', 'CERTIFICADO', 'CORRECCION', 'ANULACION', 'BAJA', 'REACTIVACION'
    ))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_EQUIPOS_HISTORIAL') AND name = 'IX_CAL_EQUIPOS_HISTORIAL_Equipo'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_EQUIPOS_HISTORIAL_Equipo
    ON dbo.CAL_EQUIPOS_HISTORIAL (equipo_id, fecha DESC);');
END;

-- El certificado vigente de cada equipo inicia su historial. Algunos textos
-- traen espacios de no separación (U+00A0) que RTRIM no quita.
EXEC('
  INSERT INTO dbo.CAL_CERTIFICADOS
    (equipo_id, certificado, cert_fecha, cert_periodo, cert_fechaven, ente_calibrador,
     origen, registrado_por, registrado_en)
  SELECT
    e.id,
    NULLIF(LTRIM(RTRIM(REPLACE(e.certificado, NCHAR(160), N'' ''))), ''''),
    e.cert_fecha,
    e.cert_periodo,
    CASE WHEN e.cert_periodo > 0 THEN DATEADD(day, e.cert_periodo, e.cert_fecha) END,
    NULLIF(LTRIM(RTRIM(REPLACE(e.ente_calibrador, NCHAR(160), N'' ''))), ''''),
    ''MIGRACION'',
    NULLIF(LTRIM(RTRIM(REPLACE(e.reg_usuario, NCHAR(160), N'' ''))), ''''),
    CAST(COALESCE(e.reg_fecha, e.cert_fecha) AS DATETIME2)
  FROM dbo.DATA_EQUIPOS_CAL e
  WHERE e.id IS NOT NULL
    AND e.cert_fecha IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM dbo.CAL_CERTIFICADOS c
      WHERE c.equipo_id = e.id
        AND c.cert_fecha = e.cert_fecha
        AND ISNULL(c.certificado, '''') = ISNULL(NULLIF(LTRIM(RTRIM(REPLACE(e.certificado, NCHAR(160), N'' ''))), ''''), '''')
    );
');
