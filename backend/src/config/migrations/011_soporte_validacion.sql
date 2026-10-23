-- Validación por el jefe de área antes de cada emisión o reemisión.
-- Los informes ya emitidos conservan su vigencia; sus nuevas revisiones
-- requieren aprobación. Idempotente y compatible con las migraciones 008-010.
SET XACT_ABORT ON;

IF COL_LENGTH('dbo.ST_INFORMES', 'validacion_estado') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD validacion_estado VARCHAR(20) NOT NULL
    CONSTRAINT DF_ST_INFORMES_VALIDACION DEFAULT 'BORRADOR' WITH VALUES;
IF COL_LENGTH('dbo.ST_INFORMES', 'validacion_huella') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD validacion_huella VARCHAR(64) NULL;
IF COL_LENGTH('dbo.ST_INFORMES', 'validacion_enviada_por') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD validacion_enviada_por NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.ST_INFORMES', 'validacion_enviada_en') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD validacion_enviada_en DATETIME2 NULL;
IF COL_LENGTH('dbo.ST_INFORMES', 'validacion_resuelta_por') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD validacion_resuelta_por NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.ST_INFORMES', 'validacion_resuelta_en') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD validacion_resuelta_en DATETIME2 NULL;
IF COL_LENGTH('dbo.ST_INFORMES', 'validacion_observacion') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD validacion_observacion NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ST_INFORMES_VALIDACION')
  EXEC('ALTER TABLE dbo.ST_INFORMES ADD CONSTRAINT CK_ST_INFORMES_VALIDACION CHECK (
    validacion_estado IN (''BORRADOR'', ''PENDIENTE'', ''APROBADO'', ''OBSERVADO'')
    AND (validacion_estado NOT IN (''PENDIENTE'', ''APROBADO'', ''OBSERVADO'')
      OR (validacion_huella IS NOT NULL AND validacion_enviada_por IS NOT NULL AND validacion_enviada_en IS NOT NULL))
    AND (validacion_estado NOT IN (''APROBADO'', ''OBSERVADO'')
      OR (validacion_resuelta_por IS NOT NULL AND validacion_resuelta_en IS NOT NULL))
    AND (validacion_estado <> ''OBSERVADO'' OR validacion_observacion IS NOT NULL)
  );');

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ST_INFORMES_HISTORIAL_ACCION')
  ALTER TABLE dbo.ST_INFORMES_HISTORIAL DROP CONSTRAINT CK_ST_INFORMES_HISTORIAL_ACCION;
ALTER TABLE dbo.ST_INFORMES_HISTORIAL ADD CONSTRAINT CK_ST_INFORMES_HISTORIAL_ACCION CHECK (accion IN (
  'EDICION', 'CORRECCION', 'EMISION', 'FOTO_AGREGADA', 'FOTO_EDITADA', 'FOTO_QUITADA', 'FOTOS_ORDEN',
  'REVISION_ABIERTA', 'REEMISION', 'REVISION_CANCELADA',
  'VALIDACION_ENVIADA', 'VALIDACION_APROBADA', 'VALIDACION_OBSERVADA', 'VALIDACION_RETIRADA'
));

IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-022')
BEGIN
  INSERT INTO dbo.APP_CAMBIOS
    (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
     estado, a_posteriori, registrado_por)
  VALUES
    ('CC-2026-022', N'2.11.0', N'Soporte técnico: validación, redacción contextual y plan PDF', 'MEJORA', N'Soporte técnico',
     N'El técnico envía el informe al jefe de área, que aprueba o devuelve con observaciones antes de emitir o reemitir. La validación queda vinculada a los datos y fotos; retirarla exige un nuevo envío. La IA usa la ficha efectiva y la prerredacción. Próximos servicios muestra capacidades, divisiones y rangos y exporta PDF por mes, intervalo o año.',
     N'Aplica a nuevas emisiones y reemisiones. Solo el personal activo de Soporte Técnico con cargo Jefe de Area puede aprobar. Los informes ya emitidos conservan su vigencia. Requiere migración 011 antes de desplegar la aplicación.',
     N'Migración 011; docs/soporte-validacion.md; backend/src/services/soporte.*; src/features/soporte.',
     '2026-10-23', 'REGISTRADO', 0, N'migración 011');
  INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    SELECT id, 'REGISTRO', N'Registrado al implementar validación de informes y exportación del plan de servicios', N'migración 011'
    FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-022';
END;
