-- ========================================================================
-- MIGRACIÓN 026: MÁS CAMBIOS DE LA VERSIÓN 2.18.2 (CALIBRACIÓN)
-- ========================================================================
-- Registra en Control de cambios (NB/ISO/IEC 17025, 7.11.2) lo que el
-- personal de Calibración pidió después de la migración 025, en la misma
-- versión 2.18.2, que aún no se despliega. Quedan REGISTRADOS: Sistemas los
-- valida y el jefe de área de Calibración los aprueba.
--
-- No cambia tablas. Es idempotente: no repite un cambio con el mismo título.
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
    (1, N'Calibración: la revisión solo se bloquea a quien hizo el último cambio', 'CORRECCION', N'Calibración',
     N'Antes, en el certificado de un patrón quedaban fuera de la verificación quien lo registró, quien lo corrigió y quien transcribió sus valores, todos a la vez; y una versión del método no la podía aprobar nadie que la hubiera redactado o editado. Si una persona llenaba los datos y otra los completaba, ninguna de las dos podía revisar. Ahora solo queda fuera quien hizo el último cambio, según su fecha; quien lo completó antes sí puede revisar lo que agregó otro. Los registros de calibración ya funcionaban así (solo queda fuera quien envía a revisión).',
     N'Cambia quién puede verificar los valores de los patrones y aprobar las versiones del método. Sin cambios en la base.',
     N'calibration.history.js (ultimoAutor), calibration.equipment.js, calibration.patrones.js, calibration.metodo.js. Probado contra DataMET_prueba (E2-005) en una transacción revertida.', '2026-11-12'),
    (2, N'Calibración: decimales del error y de U, factor k y riesgo asociado como la planilla del laboratorio', 'MEJORA', N'Calibración',
     N'Nuevas reglas en Método de cálculo. Decimales: «por el rango de la carga» escribe el error con los decimales del rango al que corresponde la carga (los que declara ServiceMET) y U con un decimal más. Factor de cobertura: «sin decimales» (2; con los suyos si k no es entero). Riesgo asociado: «como la planilla», 1 − Φ((T − |E|) / U) con el error y la U que se informan; por ejemplo, con E = 0,0 kg, U = 0,08 kg y EMP = 0,1 kg da 10,56 %, como el libro. Para que U salga como en la planilla (0,08 y no 0,09) se elige además el redondeo de U al más cercano.',
     N'Las versiones anteriores del método quedan como antes (U con dos cifras hacia arriba, error a los mismos decimales, k con dos decimales y riesgo con u = U/k a dos colas): los certificados ya emitidos no cambian. Rige cuando el jefe de Calibración aprueba una versión del método que lo elija. La decisión de conformidad no cambia.',
     N'motor/error.js, motor/tolerancia.js, motor/servicio.js, calibration.metodo.js, calibration.certificado.js, MetodoPagina.jsx. Caso: INBOLPACK, CAS 200 kg (0060-11-003).', '2026-11-12'),
    (3, N'Calibración: AS FOUND en el gráfico del certificado con las precargas', 'CORRECCION', N'Calibración',
     N'El gráfico de errores del certificado dibujaba AS FOUND solo cuando hubo ajuste. Ahora lo dibuja siempre que el servicio tenga precargas (lecturas antes del ajuste), como la planilla del laboratorio. La tabla «Errores antes del ajuste» sigue saliendo solo si hubo ajuste.',
     N'Solo presentación del certificado. Sin cambios en los datos ni en el cálculo.',
     N'calibration.certificado.js. Caso: INBOLPACK, CAS 200 kg (0060-11-003), sin ajuste y con cinco precargas.', '2026-11-12'),
    (4, N'Calibración: zoom en la vista previa del certificado', 'MEJORA', N'Calibración',
     N'La vista previa del certificado se puede acercar o alejar con Ctrl + rueda del mouse (o pellizcando en el touchpad) y con los botones − y +; el porcentaje vuelve a ajustarla al ancho del panel. Cada navegador recuerda el zoom elegido y, si la hoja queda más ancha que el panel, se recorre con la barra horizontal.',
     N'Solo pantalla. Sin cambios en los datos ni en el PDF.',
     N'PreviaCertificado.jsx.', '2026-11-12');

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
        'REGISTRADO', 0, N'migración 026'
      FROM @cambios WHERE orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 026 (versión 2.18.2)', N'migración 026');
    END;
    SET @orden += 1;
  END;
END;
