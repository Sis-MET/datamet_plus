-- ========================================================================
-- MIGRACIÓN 025: CAMBIOS DE LA VERSIÓN 2.18.2
-- ========================================================================
-- Registra en Control de cambios (NB/ISO/IEC 17025, 7.11.2) lo que trae la
-- versión 2.18.2: lo desarrollado después de 2.18.1 que aún no estaba
-- registrado y las correcciones pedidas por el personal de Calibración.
-- Quedan REGISTRADOS: Sistemas los valida y el jefe de área de Calibración
-- los aprueba antes de desplegar la versión.
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
    (1, N'Soporte técnico: Comercial consulta los informes emitidos y los próximos servicios', 'MEJORA', N'Soporte técnico',
     N'Comercial abre Soporte técnico en modo consulta, con dos secciones: «Informes emitidos» y «Próximos servicios». Ve, imprime y descarga los informes emitidos en la revisión que tiene el cliente, nunca un borrador, y consulta los próximos servicios sin registrar seguimiento. No ve Avisos ni Configuración. El backend lo hace cumplir con el nivel de acceso «consulta»: una ruta nueva queda cerrada a Comercial por omisión.',
     N'Comercial no modifica nada. La lista, el detalle y los PDF responden 404 a lo que no está emitido. Sin cambios en la base.',
     N'Commit a501a1e; access.areas.js, soporte.routes.js.', '2026-11-11'),
    (2, N'Tiempos de servicio del personal de Soporte técnico y Calibración', 'MEJORA', N'Soporte técnico, Calibración',
     N'Sección «Tiempos de servicio» en Soporte técnico y en Calibración: duración de cada servicio según las horas que registra el técnico en ServiceMET, indicadores del período comparados con el anterior, horas por mes y por tipo de servicio, una tarjeta por técnico, la lista de servicios y su exportación a CSV. Los servicios sin horas o con horas inconsistentes quedan en «Horas por revisar» y no entran en los promedios.',
     N'Solo lectura. Lo ven el jefe de cada área y Sistemas. Sin cambios en la base.',
     N'Commits 897ecf2 y 914edfc; GET /api/soporte/tiempos y /api/calibracion/tiempos.', '2026-11-11'),
    (3, N'Calibración: aptitud de las pesas patrón por la R111 o por el criterio del laboratorio', 'MEJORA', N'Calibración',
     N'En la ficha del patrón, «Apta» muestra por separado las condiciones 5.2 (U ≤ emp/3) y 5.3 (|corrección| ≤ emp − U) de la OIML R111. El método de cálculo permite elegir el criterio de aptitud: la R111 o el del laboratorio (|corrección| + U ≤ emp, con la 5.2 como dato). «Clase que cumple» muestra la clase del juego, la reportada en su certificado, cuando la pieza es apta, y nunca una más exacta: por procedimiento el laboratorio no declara clases mejores que la reportada. Si la pieza no es apta, muestra la siguiente clase menor que respalda su certificado.',
     N'No cambia el cálculo: las pesas se usan con su corrección y su U del certificado (EURAMET 7.1.2). Las versiones anteriores del método quedan con la R111; para usar el criterio del laboratorio, el jefe de Calibración aprueba una versión del método que lo elija.',
     N'Commits 91f0c01, 55cace8 y 2f2fbe0, y la corrección de «Clase que cumple» de esta versión; patrones.js, PatronModal.jsx.', '2026-11-12'),
    (4, N'Calibración: corregir el valor nominal o la identificación de una pieza con valores', 'CORRECCION', N'Calibración',
     N'Antes no se podía corregir el valor nominal ni la identificación de una pieza que ya tenía valores de un certificado. Ahora se permite escribiendo el motivo: el cambio queda en el historial con la versión anterior, la nueva, el motivo y quién lo hizo; si la pieza tiene valores en el certificado vigente, este vuelve a quedar por verificar y quien corrigió no puede verificarlo. También se puede pasar la identificación «*» de una pieza a otra del mismo valor. Guardar solo las piezas ya no crea una transcripción vacía del certificado vigente.',
     N'Modifica CAL_PATRON_PIEZAS al corregir; los valores de los certificados siguen ligados a la misma pieza. Sin cambios en la estructura de la base.',
     N'calibration.patrones.js, PatronModal.jsx. Probado contra DataMET_prueba (E2-005) en transacciones revertidas.', '2026-11-12'),
    (5, N'Calibración: unidades del SI con sus minúsculas en las tablas', 'CORRECCION', N'Calibración',
     N'Los encabezados de tabla con mayúsculas automáticas mostraban «KG/M³», «K» o «U (KG)». Ahora se ven como se escriben: mg, g, kg, kg/m³, hPa, °C, %, y el factor de cobertura k. La presión de las condiciones del patrón se indica en hPa.',
     N'Solo presentación. Sin cambios en los datos ni en los cálculos.',
     N'PatronModal.jsx, CalculoServicio.jsx, SeccionesRegistro.jsx, ComoSeCalcula.jsx, calibration.css.', '2026-11-12'),
    (6, N'Control de cambios: el jefe de área de Calibración aprueba los cambios', 'SEGURIDAD', N'Sistema',
     N'El jefe de área de Calibración entra a Control de cambios (no a Registro de fallas) y aprueba o rechaza cada cambio con validación conforme, como las versiones de ServiceMET. Sistemas registra, edita, valida e implementa, y ya no aprueba. Nunca aprueba quien validó. El servidor comprueba cada paso.',
     N'Cambia quién aprueba: los cambios pendientes, de esta versión y de las anteriores, los aprueba el jefe de área de Calibración. Sin cambios en la base.',
     N'system.changes.js, system.routes.js, navigation.js; migración 025.', '2026-11-12');

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
        'REGISTRADO', 0, N'migración 025'
      FROM @cambios WHERE orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 025 (versión 2.18.2)', N'migración 025');
    END;
    SET @orden += 1;
  END;
END;
