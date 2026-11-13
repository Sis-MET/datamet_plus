-- ========================================================================
-- MIGRACIÓN 030: GESTIÓN DE PERMISOS (VERSIÓN 2.19.0)
-- ========================================================================
-- Registra en Control de cambios (NB/ISO/IEC 17025, 7.11.2) lo que agrega la
-- versión 2.19.0: Sistema › Gestión de permisos (migración 029) y los tiempos
-- de servicio de Soporte técnico y de Calibración para los jefes de área de
-- todas las áreas. Quedan REGISTRADOS: Sistemas los valida y el jefe de área
-- de Calibración los aprueba antes de desplegar la versión.
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
    (1, N'Sistema: Gestión de permisos por persona o por grupo, con historial que no se borra', 'MODULO', N'Sistema',
     N'Hasta la 2.18.3 cada acceso especial estaba escrito en el código (el nivel 3, el área y el cargo «Jefe de Area» de DATA_USERS) y cambiarlo exigía una versión nueva. Sistema › Gestión de permisos concede permisos con nombre (por ahora tiempos.soporte.ver y tiempos.calibracion.ver) a una persona o a un grupo: un área, un cargo o un cargo de un área. Muestra el personal con su área, cargo, nivel y permisos, con búsqueda y filtros; la ficha de cada persona dice de dónde le viene cada permiso; conceder y revocar exigen el motivo y muestran a quiénes alcanza. La abren y modifican solo Sistemas (nivel 3) y el jefe de Sistemas (Richard Dorado, por su id en DATA_USERS), fijo en el código. El backend lo comprueba con una sola función (tienePermiso), que lee en cada petición la fila vigente de DATA_USERS; el menú solo oculta.',
     N'Crea APP_PERMISOS_CONCESIONES y APP_PERMISOS_HISTORIAL (migración 029). Las concesiones no se borran: revocar guarda quién, cuándo y por qué; el historial guarda quién, cuándo, qué, a quién y quiénes tenían el permiso antes y después, y triggers de la base rechazan modificarlo o borrarlo (8.4). Sistemas conserva todos los permisos. El jefe de Sistemas va por su id porque DATA_USERS no tiene un área Sistemas; si cambia de puesto, se cambia en permisos.catalogo.js con una versión nueva. Los demás accesos (aprobadores, Control de cambios, Cronograma, RIM) siguen en el código y pueden pasarse al modelo después.',
     N'Migraciones 029 y 030; permisos.js, permisos.catalogo.js, permiso.middleware.js, system.routes.js; PermisosPage.jsx y sus fichas; navigation.js; pruebas en permisos.test.js, permisos.http.test.js, permisos.test.js (frontend), navigation.test.js y e2e/permisos.spec.js.', '2026-11-13'),
    (2, N'Tiempos de servicio: los ven los jefes de área de todas las áreas', 'MEJORA', N'Soporte técnico, Calibración',
     N'Los tiempos de servicio de Soporte técnico y de Calibración los veían solo el jefe de cada área y Sistemas. A pedido de Sistemas, ahora los ve todo jefe de área (cargo «Jefe de Area», de cualquier área), con los permisos tiempos.soporte.ver y tiempos.calibracion.ver que siembra la migración 029. Quien no es del área entra a ese apartado solo a sus tiempos de servicio, sin abrir los informes ni los registros, que siguen siendo del área; el jefe de Comercial los ve junto a su consulta de Soporte técnico. Las rutas de los tiempos se comprueban con el permiso antes de la regla del área.',
     N'Los jefes de Administración, Comercial y las demás áreas ven los tiempos de servicio del personal de Soporte técnico y de Calibración (horas, servicios, clientes y técnicos). Se puede quitar o dar a otros desde Gestión de permisos sin otra versión. Los demás apartados de cada área siguen cerrados a quien no es del área.',
     N'soporte.permisos.js, calibration.tiempos.js, soporte.routes.js, calibration.routes.js, TiemposPage.jsx, SoportePage.jsx, Sidebar.jsx; pruebas en permisos.http.test.js, soporte.flujo.test.js y e2e/tiempos.spec.js.', '2026-11-13');

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
      SELECT 'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.19.0',
        titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
        'REGISTRADO', 0, N'migración 030'
      FROM @cambios WHERE orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 030 (versión 2.19.0)', N'migración 030');
    END;
    SET @orden += 1;
  END;
END;
