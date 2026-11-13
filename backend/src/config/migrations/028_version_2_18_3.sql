-- ========================================================================
-- MIGRACIÓN 028: CARGAS DE SUSTITUCIÓN, MÉTODOS 1 Y 2 (VERSIÓN 2.18.3)
-- ========================================================================
-- Registra en Control de cambios (NB/ISO/IEC 17025, 7.11.2) lo que corrige
-- la versión 2.18.3 en las cargas de sustitución, tras revisar en producción
-- los certificados de MONOPOL (0103-11-056) y ANDEAN VALLEY (0004-11-022) y
-- la explicación de los métodos 1 y 2 que dio el personal de Calibración. Quedan
-- REGISTRADOS: Sistemas los valida y el jefe de área de Calibración los
-- aprueba antes de desplegar la versión.
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
    (1, N'Calibración: la carga patrón de la sustitución es la mayor carga armada solo con pesas', 'CORRECCION', N'Calibración',
     N'En la 2.18.2 la carga patrón que se repite en la sustitución era siempre el total de las pesas llevadas. En MONOPOL (0103-11-056), con 600 kg en pesas y el técnico armando hasta 500 kg, 1 567 kg salía como 3 × 600 − 233 y 1 007,6 kg no se calculaba. Ahora el paso es la mayor carga del ensayo armada solo con pesas (500 kg) o el total de las pesas, el que deja la suma de diferencias ΣΔI más chica: 1 007,6 = 2 × 500 + 7,6 y 1 567 = 3 × 500 + 67. Sigue el límite de un 25 % del paso por paso.',
     N'Esos puntos se calculan con la carga patrón que usó el técnico y salen en el certificado y en el gráfico. Rige para los registros que se recalculan.',
     N'motor/servicio.js (referenciaSustitucion); pruebas en motor.servicio.test.js.', '2026-11-13'),
    (2, N'Calibración: el «Método 1» de sustitución es la cadena con la carga de pesas validada', 'CORRECCION', N'Calibración',
     N'El personal de Calibración explicó el «Método 1»: el técnico valida una carga con pesas (por ejemplo 500 kg, E = +0,5), la reemplaza por material hasta la misma indicación, vuelve a poner las pesas y así sigue. Cada carga vale n × 500 más la suma de las diferencias de indicación (EURAMET cg-18 4.3.3-5a; incertidumbre con 7.1.2-15a). En los servicios marcados «Método 1» en ServiceMET, DataMET+ usa siempre esa cadena con la mayor carga del ensayo armada solo con pesas, aunque la carga no supere el total de las pesas o el resto se pudiera armar con piezas. Con el ejemplo del personal: 994,5 kg = 2 × 500 − 5,5 (E = +1) y 1 500 kg = 3 × 500 (E = +2). La pantalla del cálculo dice de dónde sale la ΣΔI.',
     N'Cambia la carga de referencia y la U de los puntos de sustitución de los servicios con «Método 1»; los demás no cambian. Su U puede diferir de la planilla, que suma las incertidumbres a su manera. Rige para los registros que se recalculan.',
     N'motor/servicio.js (referenciaSustitucion), CalculoServicio.jsx, ComoSeCalcula.jsx; prueba con el ejemplo 2 del personal en motor.servicio.test.js.', '2026-11-13'),
    (3, N'Calibración: el «Método 2» de sustitución pesa cada carga sustitutiva y la sube con las pesas', 'CORRECCION', N'Calibración',
     N'El personal de Calibración explicó el «Método 2»: con pesas se valida hasta 500 kg (500 lee 499,5: E = −0,5); cada carga sustitutiva se pesa sola y su masa es su indicación menos ese error (495 → 495,5; 502 → 502,5; 490 → 490,5); luego se suben una por una junto con las pesas: 995,5 lee 996 (E = +0,5), 1 498 lee 1 499 (+1) y 1 988,5 lee 1 990 (+1,5). Antes DataMET+ lo trataba como la cadena del Método 1, y puntos como 830,4 kg = 500 + 330,4 no se calculaban. Ahora la carga de referencia es la de las pesas más la masa declarada de las cargas sustitutivas, repartida en las menos cargas de hasta 500 kg, iguales entre sí, porque ServiceMET no guarda cada una. Ninguna de las guías describe este método; su incertidumbre sale del modelo LT = mref + Σ (Is − E) (GUM): las pesas y la lectura con que se halló E se repiten en cada carga sustitutiva y se suman linealmente; la lectura de cada carga sustitutiva, en cuadratura.',
     N'Se calculan y salen en el certificado los puntos de sustitución de los servicios con «Método 2»; los demás no cambian. Como el mismo E(500) corrige todas las cargas, la U suele ser algo mayor que con la cadena del Método 1, y es distinta de la planilla, que sumaba todas las incertidumbres linealmente. El procedimiento P-VMET-02-7.2 debe describir el Método 2 (NB/ISO/IEC 17025 7.2.2). Rige para los registros que se recalculan.',
     N'motor/sustitucion.js (cargaMetodo2), motor/servicio.js, CalculoServicio.jsx, ComoSeCalcula.jsx, explicacion.js; pruebas con el ejemplo del personal y el caso 0103-11-013 en motor.servicio.test.js.', '2026-11-13');

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
      SELECT 'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.18.3',
        titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
        'REGISTRADO', 0, N'migración 028'
      FROM @cambios WHERE orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 028 (versión 2.18.3)', N'migración 028');
    END;
    SET @orden += 1;
  END;
END;
