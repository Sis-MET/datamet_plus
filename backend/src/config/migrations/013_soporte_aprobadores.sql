-- Delegación de revisión por el jefe de área; el cargo conserva su autorización.
IF OBJECT_ID('dbo.ST_APROBADORES_AJUSTES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_APROBADORES_AJUSTES (
    id INT NOT NULL CONSTRAINT PK_ST_APROBADORES_AJUSTES PRIMARY KEY,
    version INT NOT NULL CONSTRAINT DF_ST_APROBADORES_VERSION DEFAULT 1,
    actualizado_por NVARCHAR(50) NULL,
    actualizado_en DATETIME2 NULL,
    CONSTRAINT CK_ST_APROBADORES_UNICO CHECK (id = 1)
  );
END;
IF NOT EXISTS (SELECT 1 FROM dbo.ST_APROBADORES_AJUSTES WHERE id = 1)
  INSERT INTO dbo.ST_APROBADORES_AJUSTES (id, version) VALUES (1, 1);

IF OBJECT_ID('dbo.ST_APROBADORES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_APROBADORES (
    usuario_id INT NOT NULL CONSTRAINT PK_ST_APROBADORES PRIMARY KEY,
    autorizado_por NVARCHAR(50) NOT NULL,
    autorizado_en DATETIME2 NOT NULL CONSTRAINT DF_ST_APROBADORES_FECHA DEFAULT SYSUTCDATETIME()
  );
END;
IF OBJECT_ID('dbo.ST_APROBADORES_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_APROBADORES_HISTORIAL (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_APROBADORES_HISTORIAL PRIMARY KEY,
    version INT NOT NULL,
    anteriores NVARCHAR(MAX) NOT NULL,
    nuevos NVARCHAR(MAX) NOT NULL,
    usuario NVARCHAR(50) NOT NULL,
    nombre NVARCHAR(120) NULL,
    fecha DATETIME2 NOT NULL CONSTRAINT DF_ST_APROBADORES_HIST_FECHA DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-024')
BEGIN
  INSERT INTO dbo.APP_CAMBIOS
    (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
     estado, a_posteriori, registrado_por)
  VALUES
    ('CC-2026-024', N'2.13.0', N'Soporte: aprobadores configurables y PDF al emitir', 'MEJORA', N'Soporte técnico',
     N'El jefe de área designa varios aprobadores activos con historial y control de concurrencia. Emitir o reemitir abre el selector de destino del PDF; se bloquea archivar borradores.',
     N'Requiere migración 013. El jefe conserva su autorización por cargo; los cambios de delegación se aplican en cada solicitud.',
     N'docs/soporte-documentos.md; migración 013.', '2026-10-23', 'REGISTRADO', 0, N'migración 013');
  INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    SELECT id, 'REGISTRO', N'Registrado al implementar delegación y guardado tras emitir', N'migración 013'
    FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-024';
END;
