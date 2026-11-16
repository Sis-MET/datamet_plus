-- ========================================================================
-- MIGRACIÓN 031: DECIMALES DEL GRÁFICO DE LA DESVIACIÓN (VERSIÓN 2.19.1)
-- ========================================================================
-- Registra en Control de cambios (NB/ISO/IEC 17025, 7.11.2) lo que corrige
-- la versión 2.19.1 en el gráfico de la desviación estándar del certificado
-- de calibración, a pedido del personal de Calibración. Queda REGISTRADO:
-- Sistemas lo valida y el jefe de área de Calibración lo aprueba antes de
-- desplegar la versión.
--
-- No cambia tablas. Es idempotente: no repite un título.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @cambios TABLE (
    orden         INT,
    titulo        NVARCHAR(150),
    tipo          VARCHAR(20),
    modulos       NVARCHAR(200),
    descripcion   NVARCHAR(MAX),
    impacto       NVARCHAR(1000),
    referencias   NVARCHAR(1000),
    fecha_cambio  DATE
  );

  INSERT INTO @cambios VALUES
    (1, N'Calibración: el eje y del gráfico de la desviación estándar lleva los decimales de la tabla', 'CORRECCION', N'Calibración',
     N'El personal de Calibración pidió que el eje y del gráfico de la desviación estándar lleve los mismos decimales que la desviación estándar en la tabla de repetibilidad, que es un decimal más que d. Hasta la 2.19.0 el eje tomaba los decimales del paso entre marcas: con d = 0,1 g la tabla decía 0,11 / 0,08 / 0,26 g y el eje 0,0 / 0,1 / 0,2 / 0,3. Ahora el eje dice 0,00 / 0,10 / 0,20 / 0,30. El paso del eje se elige para que cada marca se lea exacta con esos decimales (con 2 decimales, 0,05 en vez de 0,025).',
     N'Cambia solo el texto de las marcas del eje y (y a veces su paso) en el gráfico de la desviación estándar de la vista previa y de los certificados que se emitan. Los valores calculados y las tablas no cambian. Los certificados ya emitidos guardan su contenido sin estos decimales y su gráfico sigue igual.',
     N'calibration.certificado.js (repetibilidad.decimales), GraficosCertificado.jsx (GraficoDesviacion), CertificadoDocumento.jsx, domain/certificado.js (escalaBonita, marcasDe); pruebas en certificado.test.js y calibration.certificado.test.js.', '2026-11-16');

  DECLARE @anio CHAR(4) = CONVERT(char(4), YEAR(DATEADD(hour, -4, SYSUTCDATETIME())));
  DECLARE @orden INT = 1;
  DECLARE @total INT = (SELECT MAX(orden) FROM @cambios);
  DECLARE @titulo NVARCHAR(150);
  DECLARE @ultimo INT;

  WHILE @orden <= @total
  BEGIN
    SELECT @titulo = titulo FROM @cambios WHERE orden = @orden;
    IF NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE titulo = @titulo)
    BEGIN
      SELECT @ultimo = ISNULL(MAX(CAST(RIGHT(codigo, 3) AS INT)), 0)
      FROM dbo.APP_CAMBIOS WITH (UPDLOCK, HOLDLOCK)
      WHERE codigo LIKE 'CC-' + @anio + '-[0-9][0-9][0-9]';

      INSERT INTO dbo.APP_CAMBIOS
        (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
         estado, a_posteriori, registrado_por)
      SELECT 'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.19.1',
        titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
        'REGISTRADO', 0, N'migración 031'
      FROM @cambios WHERE orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 031 (versión 2.19.1)', N'migración 031');
    END;
    SET @orden += 1;
  END;
END;
