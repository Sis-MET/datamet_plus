-- ========================================================================
-- MIGRACIÓN 027: TOLERANCIAS, SUSTITUCIÓN Y GRÁFICO (VERSIÓN 2.18.2)
-- ========================================================================
-- Registra en Control de cambios (NB/ISO/IEC 17025, 7.11.2) lo que el
-- personal de Calibración pidió después de la migración 026, en la misma
-- versión 2.18.2, que aún no se despliega. Quedan REGISTRADOS: Sistemas los
-- valida y el jefe de área de Calibración los aprueba.
--
-- No cambia tablas: la unidad de la tolerancia del cliente («en») se guarda
-- en los datos del registro. Es idempotente: no repite un título.
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
    (1, N'Calibración: tolerancia del cliente en divisiones y regla de decisión sin tolerancia', 'MEJORA', N'Calibración',
     N'En «Criterio y cierre», cada fila de «Tolerancia del cliente por rango» se escribe en la unidad de la balanza o en divisiones d del rango de la carga: por ejemplo, Lab Delta pide 1 d en todo el rango, una sola fila «en adelante» con ± 1 d. Admite hasta 5 rangos y la regla simple o conservadora. Si el cliente pidió una regla de decisión y algún punto queda sin tolerancia, el certificado no se puede emitir hasta definirla (antes salía «NO APLICA»).',
     N'Agrega la unidad («en») a las tolerancias del registro; las guardadas quedan en la unidad de la balanza. Un registro con regla de decisión y sin tolerancia queda bloqueado para emitir.',
     N'motor/tolerancia.js (toleranciaDeCarga), calibration.registros.js, calibration.certificado.js, SeccionesRegistro.jsx.', '2026-11-12'),
    (2, N'Calibración: cargas de sustitución con material (ΣΔI)', 'CORRECCION', N'Calibración',
     N'Las cargas mayores que el total de las pesas, cuando el resto no se forma con piezas, no se calculaban («La carga no se forma con las piezas») y no salían en el certificado; por ejemplo, 1 057,6 kg y 1 482,8 kg con 500 kg en pesas (ANDEAN VALLEY, 0004-11-022) o 1 007,6 kg y 1 567 kg (MONOPOL, 0103-11-056). Ahora el resto es el material de sustitución: L = n·mref + ΣΔI (EURAMET 4.3.3-5a), con n las veces que se pone la carga patrón y ΣΔI = carga declarada − n·nominal, porque ServiceMET no registra las diferencias de indicación; su incertidumbre, con 7.1.2-15a. Si el resto supera un 25 % de la carga patrón por paso, no se toma como sustitución.',
     N'Esos puntos se calculan y salen en el certificado y en el gráfico. Su U puede diferir de la planilla, que calcula la sustitución a su manera; DataMET+ sigue EURAMET 7.1.2-15a. Rige para los registros que se recalculan.',
     N'motor/servicio.js (referenciaSustitucion); pruebas en motor.servicio.test.js.', '2026-11-12'),
    (3, N'Calibración: alcance hasta Max′ con la carga mayor calculada', 'CORRECCION', N'Calibración',
     N'El alcance decía «hasta Max» si la carga mayor llegaba al 98 % de Max (1 482,8 kg en una balanza de 1 500 kg salía «Max: 1500 kg») y contaba puntos que no se calculaban. Ahora dice «Max» solo si la carga mayor que sale en el certificado llega a Max (dentro de media d); si no, «Max′» con esa carga tal cual, como la planilla.',
     N'Solo el texto del alcance del certificado.',
     N'calibration.certificado.js.', '2026-11-12'),
    (4, N'Calibración: gráfico de errores con barras de U y tolerancia en cono', 'CORRECCION', N'Calibración',
     N'El gráfico de errores del certificado dibuja la incertidumbre ±U de cada punto en barras, como la planilla. La tolerancia se dibuja con la misma función que decide la conformidad: si es un % de la carga (MONOPOL, 0,5 %), como un cono desde el origen; si no, en escalones justo donde cambia el valor (múltiplos de e, rangos del instrumento o límites de la tabla del cliente), y no en las cargas medidas.',
     N'Solo presentación del certificado. Sin cambios en los datos ni en el cálculo.',
     N'calibration.certificado.js (curvaTolerancia), GraficosCertificado.jsx.', '2026-11-12');

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
      SELECT 'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.18.2',
        titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
        'REGISTRADO', 0, N'migración 027'
      FROM @cambios WHERE orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 027 (versión 2.18.2)', N'migración 027');
    END;
    SET @orden += 1;
  END;
END;
