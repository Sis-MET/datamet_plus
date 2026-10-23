-- Referencias a los PDF guardados en una carpeta elegida del archivo del área.
-- El contenido permanece en disco; cada guardado registra su revisión y huella.
IF OBJECT_ID('dbo.ST_INFORMES_DOCUMENTOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_INFORMES_DOCUMENTOS (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ST_INFORMES_DOCUMENTOS PRIMARY KEY,
    tipo VARCHAR(10) NOT NULL,
    codigo_registro NVARCHAR(100) NOT NULL,
    revision INT NOT NULL,
    borrador BIT NOT NULL,
    version_informe INT NULL,
    nombre NVARCHAR(220) NOT NULL,
    carpeta NVARCHAR(1200) NOT NULL,
    raiz_huella CHAR(64) NOT NULL,
    ubicacion_huella CHAR(64) NOT NULL,
    contenido_huella CHAR(64) NOT NULL,
    bytes INT NOT NULL,
    guardado_por NVARCHAR(50) NOT NULL,
    guardado_nombre NVARCHAR(120) NULL,
    guardado_en DATETIME2 NOT NULL CONSTRAINT DF_ST_DOCUMENTOS_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ST_DOCUMENTOS_UBICACION UNIQUE (ubicacion_huella),
    CONSTRAINT CK_ST_DOCUMENTOS_REVISION CHECK (revision >= 0),
    CONSTRAINT CK_ST_DOCUMENTOS_BYTES CHECK (bytes > 0 AND bytes <= 31457280)
  );
  CREATE INDEX IX_ST_DOCUMENTOS_INFORME ON dbo.ST_INFORMES_DOCUMENTOS(tipo, codigo_registro, guardado_en DESC);
END;

IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-023')
BEGIN
  INSERT INTO dbo.APP_CAMBIOS
    (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
     estado, a_posteriori, registrado_por)
  VALUES
    ('CC-2026-023', N'2.12.0', N'Soporte: guardar y consultar PDF en la carpeta elegida', 'MEJORA', N'Soporte técnico',
     N'El técnico navega por las carpetas del archivo del área y elige el destino de cada PDF. Se registra el archivo, su revisión, autor y huella para abrir el documento guardado desde el panel.',
     N'Requiere migración 012, ST_DOCUMENTOS_DIR y permisos de lectura/escritura de la cuenta del backend. No sobrescribe archivos existentes. OneDrive gestiona su sincronización de forma independiente.',
     N'docs/soporte-documentos.md; migración 012.', '2026-10-23', 'REGISTRADO', 0, N'migración 012');
  INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    SELECT id, 'REGISTRO', N'Registrado al implementar el archivo PDF del área', N'migración 012'
    FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-023';
END;
