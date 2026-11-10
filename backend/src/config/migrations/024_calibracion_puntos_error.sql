-- ========================================================================
-- MIGRACIÓN 024: ERROR O CORRECCIÓN EN LOS CERTIFICADOS DE LOS TERMOHIGRÓMETROS
-- ========================================================================
-- Unos certificados dan la corrección de cada punto y otros el error de
-- indicación (los de presión, por ejemplo). El personal transcribe el valor
-- tal como lo da el certificado y elige cuál es; el cálculo usa siempre la
-- corrección, que es el error con el signo cambiado.
--
-- CAL_CERT_PUNTOS.expresado_como : CORRECCION o ERROR, lo que da el
--                                  certificado. La columna «correccion» sigue
--                                  siendo la corrección que usa el cálculo.
--
-- Registra el cambio en Control de cambios. Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF COL_LENGTH('dbo.CAL_CERT_PUNTOS', 'expresado_como') IS NULL
  ALTER TABLE dbo.CAL_CERT_PUNTOS ADD expresado_como VARCHAR(10) NOT NULL
    CONSTRAINT DF_CAL_CERT_PUNTOS_EXPRESADO DEFAULT 'CORRECCION';

-- Dinámico: la columna recién agregada no existe al compilar este lote.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_CERT_PUNTOS_EXPRESADO')
  EXEC('ALTER TABLE dbo.CAL_CERT_PUNTOS ADD CONSTRAINT CK_CAL_CERT_PUNTOS_EXPRESADO CHECK (expresado_como IN (''CORRECCION'', ''ERROR''));');

-- ─── Control de cambios (NB/ISO/IEC 17025, 7.11.2) ─────────────────────────
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: error o corrección en los certificados de los termohigrómetros';
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
      'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.18.1', @titulo, 'MEJORA', N'Calibración',
      N'En la ficha de un termohigrómetro, cada magnitud indica si su certificado da la corrección o el error de cada punto, y el valor se transcribe tal como está en el certificado. El cálculo usa la corrección (el error con el signo cambiado), así que ya no hace falta cambiar el signo a mano.',
      N'Agrega expresado_como a CAL_CERT_PUNTOS (migración 024). Los puntos ya transcritos quedan como corrección, que es lo que se pedía antes. No cambia el cálculo.',
      N'Migración 024; calibration.patrones.js; PatronModal.jsx.',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 024'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 024', N'migración 024');
  END;
END;
