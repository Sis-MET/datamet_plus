-- ========================================================================
-- MIGRACIÓN 023: MÁS DATOS DE LOS CERTIFICADOS DE LOS PATRONES
-- ========================================================================
-- Lo que pidió el personal de Calibración al transcribir los certificados
-- (fase 1, migración 016):
--
-- CAL_CERT_PUNTOS        : «temperatura», la temperatura a la que se calibró
--                          cada punto de humedad relativa. Un mismo valor de
--                          humedad puede repetirse a otra temperatura, así que
--                          la clave única pasa a ser (certificado, magnitud,
--                          temperatura, punto).
-- CAL_CERT_TRANSCRIPCION : la incertidumbre expandida de la temperatura, la
--                          humedad y la presión durante la calibración del
--                          juego de pesas, con su k si el certificado lo da.
--
-- CAL_CERT_VALORES.conforme deja de escribirse a mano: DataMET+ guarda si la
-- pieza es apta para su clase según la OIML R111 (U con k = 2 ≤ emp/3, 5.2;
-- |corrección| ≤ emp − U, 5.3) calculada con los valores del certificado.
--
-- Registra el cambio en Control de cambios. Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF COL_LENGTH('dbo.CAL_CERT_PUNTOS', 'temperatura') IS NULL
  ALTER TABLE dbo.CAL_CERT_PUNTOS ADD temperatura DECIMAL(6, 2) NULL;

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_CAL_CERT_PUNTOS_Punto' AND parent_object_id = OBJECT_ID('dbo.CAL_CERT_PUNTOS'))
  ALTER TABLE dbo.CAL_CERT_PUNTOS DROP CONSTRAINT UQ_CAL_CERT_PUNTOS_Punto;

-- Dinámico: la columna recién agregada no existe al compilar este lote.
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_CAL_CERT_PUNTOS_TemperaturaPunto')
  EXEC('ALTER TABLE dbo.CAL_CERT_PUNTOS ADD CONSTRAINT UQ_CAL_CERT_PUNTOS_TemperaturaPunto UNIQUE (certificado_id, magnitud, temperatura, punto);');

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_CERT_PUNTOS_TEMPERATURA')
  EXEC('ALTER TABLE dbo.CAL_CERT_PUNTOS ADD CONSTRAINT CK_CAL_CERT_PUNTOS_TEMPERATURA CHECK (temperatura IS NULL OR magnitud = ''HR'');');

IF COL_LENGTH('dbo.CAL_CERT_TRANSCRIPCION', 'temperatura_u') IS NULL
  ALTER TABLE dbo.CAL_CERT_TRANSCRIPCION ADD
    temperatura_u    DECIMAL(6, 2)  NULL,
    humedad_u        DECIMAL(6, 2)  NULL,
    presion_u        DECIMAL(8, 2)  NULL,
    condiciones_k    DECIMAL(5, 2)  NULL;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_CERT_TRANSCRIPCION_U')
  EXEC('ALTER TABLE dbo.CAL_CERT_TRANSCRIPCION ADD CONSTRAINT CK_CAL_CERT_TRANSCRIPCION_U CHECK (
    (temperatura_u IS NULL OR temperatura_u >= 0) AND (humedad_u IS NULL OR humedad_u >= 0)
    AND (presion_u IS NULL OR presion_u >= 0) AND (condiciones_k IS NULL OR condiciones_k > 0)
  );');

-- ─── Control de cambios (NB/ISO/IEC 17025, 7.11.2) ─────────────────────────
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: material, aptitud, humedad por temperatura e incertidumbre de las condiciones de los patrones';
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
      'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.19.0', @titulo, 'MEJORA', N'Calibración',
      N'En la ficha del patrón, el material de cada pieza se elige de la tabla de densidades del método de cálculo y llena la densidad supuesta con su incertidumbre (k = 2). «Apta» ya no se escribe: se calcula con la clase del juego y la corrección y la U de cada pieza (OIML R111 5.2 y 5.3). Se registra la incertidumbre de las condiciones de calibración del juego y la temperatura de cada punto de humedad del termohigrómetro, que el cálculo usa para corregir la humedad a la temperatura medida.',
      N'Agrega temperatura a CAL_CERT_PUNTOS (con su clave única) y las incertidumbres de las condiciones a CAL_CERT_TRANSCRIPCION (migración 023). La corrección de la humedad interpola entre las temperaturas calibradas; sin temperaturas, calcula igual que antes. No cambia los valores ya transcritos.',
      N'Migración 023; calibration.patrones.js; motor/aire.js; PatronModal.jsx.',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 023'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 023', N'migración 023');
  END;
END;
