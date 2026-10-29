-- ========================================================================
-- MIGRACIÓN 015: CAMBIO DE OTST EN LOS INFORMES DE SOPORTE TÉCNICO
-- ========================================================================
-- La OTST que subió ServiceMET no se modifica. Si está mal o la orden se
-- reasignó, el área la cambia en el informe con su motivo: la nueva va en
-- ST_INFORMES.datos (como las demás correcciones), el número del informe se
-- recalcula y el historial guarda la anterior y la nueva (NB/ISO/IEC 17025,
-- 7.5.2). En un informe emitido se cambia dentro de una revisión.
--
-- - ST_INFORMES_HISTORIAL admite la acción OTST_CAMBIADA.
-- - ST_INFORMES_REVISIONES.numero: el número con que se emitió cada
--   revisión, para volver a imprimirla igual aunque la OTST cambie después.
--   Las copias existentes toman el número actual del informe (hasta ahora
--   la OTST no se podía cambiar).
-- - Registra en el Control de cambios (APP_CAMBIOS) los cambios de la
--   versión 2.15.0 que acompañan a esta migración.
--
-- Es idempotente. Aplicarla antes de desplegar el backend.
-- ========================================================================

SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ST_INFORMES_HISTORIAL_ACCION')
  ALTER TABLE dbo.ST_INFORMES_HISTORIAL DROP CONSTRAINT CK_ST_INFORMES_HISTORIAL_ACCION;
ALTER TABLE dbo.ST_INFORMES_HISTORIAL ADD CONSTRAINT CK_ST_INFORMES_HISTORIAL_ACCION CHECK (accion IN (
  'EDICION', 'CORRECCION', 'EMISION', 'FOTO_AGREGADA', 'FOTO_EDITADA', 'FOTO_QUITADA', 'FOTOS_ORDEN',
  'REVISION_ABIERTA', 'REEMISION', 'REVISION_CANCELADA',
  'VALIDACION_ENVIADA', 'VALIDACION_APROBADA', 'VALIDACION_OBSERVADA', 'VALIDACION_RETIRADA',
  'OTST_CAMBIADA'
));

IF COL_LENGTH('dbo.ST_INFORMES_REVISIONES', 'numero') IS NULL
  ALTER TABLE dbo.ST_INFORMES_REVISIONES ADD numero NVARCHAR(80) NULL;

EXEC('
  UPDATE r SET numero = i.numero
  FROM dbo.ST_INFORMES_REVISIONES r
  JOIN dbo.ST_INFORMES i ON i.id = r.informe_id
  WHERE r.numero IS NULL;');

-- ─── Control de cambios de DataMET+ ────────────────────────────────────────
-- El código sigue al último del año, sea cual sea la base; cada cambio se
-- reconoce por su título para no duplicarlo.
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @cambios TABLE (
    orden        INT,
    titulo       NVARCHAR(150),
    tipo         VARCHAR(20),
    modulos      NVARCHAR(200),
    descripcion  NVARCHAR(MAX),
    impacto      NVARCHAR(1000),
    referencias  NVARCHAR(1000)
  );
  INSERT INTO @cambios VALUES
    (1, N'Cronograma: los jefes de área editan todas las actividades', 'MEJORA', N'Cronograma',
     N'Los jefes de área editan, mueven, cambian de estado y eliminan cualquier actividad del cronograma, también las que reservan un vehículo a nombre de otra persona (antes solo su creador o Sistemas). Ya editaban las fechas pasadas. El cargo se reconoce sin importar tildes, mayúsculas ni espacios.',
     N'Sin cambios en la base. El servidor sigue registrando quién modifica cada fila (actualizado_por).',
     N'vehicleReservation.policy.js, access.areas.js, auth.middleware.js; useCalendarPage.jsx y vehicleAvailability.js.'),
    (2, N'Soporte técnico: decimales al corregir las pruebas metrológicas', 'CORRECCION', N'Soporte técnico',
     N'Al corregir un número de un informe ya no se borra el punto o la coma mientras se escribe (pasar de 50 a 50.01 dejaba «50»). La carga de repetibilidad, que algunas tablas de ServiceMET guardan como entero, acepta decimales en la corrección.',
     N'Sin cambios en la base: la corrección se sigue guardando en ST_INFORMES.datos con su historial.',
     N'informe.js (sinCambios), InformeEditor.jsx, soporte.columnas.js.'),
    (3, N'Soporte técnico: cambio de OTST con motivo', 'MEJORA', N'Soporte técnico',
     N'El área cambia la OTST de un informe indicando el motivo. La fila de ServiceMET no se modifica; el número del informe se recalcula con la nueva OTST, la lista y los próximos servicios la usan, y el historial guarda la anterior, la nueva, quién, cuándo y el motivo. En un informe emitido se cambia abriendo una revisión, y cada revisión emitida conserva su número. No se admite un número que ya use otro servicio del mismo tipo.',
     N'Migración 015: acción OTST_CAMBIADA en ST_INFORMES_HISTORIAL y número de cada revisión en ST_INFORMES_REVISIONES (las copias existentes toman el número actual).',
     N'Migración 015; soporte.informes.js (cambiarOtst), soporte.lista.js, soporte.detalle.js, soporte.revisiones.js; OtstModal.jsx.');

  DECLARE @anio CHAR(4) = CONVERT(char(4), YEAR(DATEADD(hour, -4, SYSUTCDATETIME())));
  DECLARE @orden INT = 1;
  DECLARE @ultimo INT;
  WHILE @orden <= 3
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM dbo.APP_CAMBIOS a JOIN @cambios c ON c.titulo = a.titulo WHERE c.orden = @orden
    )
    BEGIN
      SELECT @ultimo = ISNULL(MAX(CAST(RIGHT(codigo, 3) AS INT)), 0)
      FROM dbo.APP_CAMBIOS WITH (UPDLOCK, HOLDLOCK)
      WHERE codigo LIKE 'CC-' + @anio + '-[0-9][0-9][0-9]';

      INSERT INTO dbo.APP_CAMBIOS
        (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
         estado, a_posteriori, registrado_por)
      SELECT 'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.15.0',
        c.titulo, c.tipo, c.modulos, c.descripcion, c.impacto, c.referencias,
        CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 015'
      FROM @cambios c WHERE c.orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 015', N'migración 015');
    END;
    SET @orden += 1;
  END;
END;
