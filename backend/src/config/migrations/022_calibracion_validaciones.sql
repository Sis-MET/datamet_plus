-- ========================================================================
-- MIGRACIÓN 022: EVIDENCIA DE LA VALIDACIÓN DEL MOTOR DE CÁLCULO
-- ========================================================================
-- Calibración › Certificados › Validación corre en el servidor los ejemplos
-- publicados (EURAMET cg-18 v4.0 Anexo H, Guía SIM Apéndice G, GUM tabla
-- G.2) con el motor de cálculo y compara cada valor con el de la guía. El
-- personal de Calibración registra esa corrida como evidencia de la versión
-- de la aplicación en uso (NB/ISO/IEC 17025, 7.11.2): queda con sus
-- resultados, su huella SHA-256, quién y cuándo. No se edita ni se borra
-- (8.4).
-- ========================================================================

SET NOCOUNT ON;

IF OBJECT_ID('dbo.CAL_VALIDACIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_VALIDACIONES (
    id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_VALIDACIONES PRIMARY KEY,
    -- Versión de la aplicación (package.json) que se validó.
    version_app        NVARCHAR(20)   NOT NULL,
    -- Casos con cada valor de la guía, el del motor y el criterio (JSON) y su huella.
    resultados         NVARCHAR(MAX)  NOT NULL,
    huella             VARCHAR(64)    NOT NULL,
    casos              INT            NOT NULL,
    valores            INT            NOT NULL,
    aprobados          INT            NOT NULL,
    observacion        NVARCHAR(500)  NULL,
    registrado_por     NVARCHAR(50)   NOT NULL,
    registrado_nombre  NVARCHAR(120)  NULL,
    registrado_en      DATETIME2      NOT NULL CONSTRAINT DF_CAL_VALIDACIONES_EN DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_VALIDACIONES_RESULTADOS CHECK (ISJSON(resultados) = 1),
    CONSTRAINT CK_CAL_VALIDACIONES_CUENTAS CHECK (casos > 0 AND valores > 0 AND aprobados BETWEEN 0 AND valores)
  );
  CREATE INDEX IX_CAL_VALIDACIONES_Version ON dbo.CAL_VALIDACIONES (version_app, registrado_en);
END;

-- Control de cambios (7.11.2).
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: validación del motor de cálculo con los ejemplos publicados';
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
      'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.17.0', @titulo, 'MEJORA', N'Calibración',
      N'Calibración › Certificados › Validación recalcula en el servidor los ejemplos de EURAMET cg-18 v4.0 (Anexo H), de la Guía SIM (Apéndice G) y la tabla G.2 de la GUM con el motor de cálculo y muestra cada valor de la guía junto al del sistema, con su criterio. La corrida se puede registrar como evidencia de la versión de la aplicación (resultados, huella SHA-256, quién y cuándo). También están Registros, Emitidos y Patrones (en Equipos) y la explicación «Cómo se calcula» del registro.',
      N'Crea CAL_VALIDACIONES (migración 022). Solo agrega registros de evidencia; no cambia ningún cálculo ni certificado.',
      N'Migración 022; calibracion/validacion.js; calibration.validacion.js; docs/calibracion-plan-implementacion.md (fase 7).',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 022'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 022', N'migración 022');
  END;
END;
