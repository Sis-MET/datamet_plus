-- ========================================================================
-- MIGRACIÓN 008: INFORMES DE SOPORTE TÉCNICO
-- ========================================================================
-- Los datos de cada servicio llegan de ServiceMET a las tablas
-- DATA_SERVICIOS_DATOS_{DIG, IBM, INT, MCR, MPA_STAC, MPR_STIL, RVD, VFI} y
-- NO se modifican: son las observaciones originales del técnico.
--
-- ST_INFORMES           : el informe de cada servicio (tipo + codigo_registro)
--                         con los datos que el área corrigió o completó
--                         (JSON campo -> valor), su estado (borrador o
--                         emitido), revisión y versión para concurrencia.
-- ST_INFORMES_HISTORIAL : cada cambio con el valor anterior y el nuevo,
--                         quién, cuándo y, en un informe emitido, el motivo
--                         (NB/ISO/IEC 17025, 7.5.2).
-- ST_INFORMES_FOTOS     : el registro fotográfico del informe. Una foto no
--                         se borra: se quita con fecha, usuario y motivo.
--
-- Registra el cambio en el Control de cambios (APP_CAMBIOS, migración 007).
-- Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.ST_INFORMES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_INFORMES (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_INFORMES PRIMARY KEY,
    tipo             VARCHAR(10)    NOT NULL,
    codigo_registro  NVARCHAR(100)  NOT NULL,
    numero           NVARCHAR(80)   NOT NULL,
    datos            NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_ST_INFORMES_DATOS DEFAULT N'{}',
    estado           VARCHAR(20)    NOT NULL CONSTRAINT DF_ST_INFORMES_ESTADO DEFAULT 'BORRADOR',
    revision         INT            NOT NULL CONSTRAINT DF_ST_INFORMES_REVISION DEFAULT 0,
    version          INT            NOT NULL CONSTRAINT DF_ST_INFORMES_VERSION DEFAULT 1,
    creado_por       NVARCHAR(50)   NOT NULL,
    creado_en        DATETIME2      NOT NULL CONSTRAINT DF_ST_INFORMES_CREADO DEFAULT SYSUTCDATETIME(),
    actualizado_por  NVARCHAR(50)   NULL,
    actualizado_en   DATETIME2      NULL,
    emitido_por      NVARCHAR(50)   NULL,
    emitido_en       DATETIME2      NULL,
    CONSTRAINT UQ_ST_INFORMES_Registro UNIQUE (tipo, codigo_registro),
    CONSTRAINT CK_ST_INFORMES_TIPO CHECK (tipo IN ('DIG', 'IBM', 'INT', 'MCR', 'MPA', 'MPR', 'RVD', 'VFI')),
    CONSTRAINT CK_ST_INFORMES_ESTADO CHECK (estado IN ('BORRADOR', 'EMITIDO')),
    CONSTRAINT CK_ST_INFORMES_DATOS CHECK (ISJSON(datos) = 1),
    CONSTRAINT CK_ST_INFORMES_EMISION CHECK (estado = 'BORRADOR' OR (emitido_por IS NOT NULL AND emitido_en IS NOT NULL))
  );
END;

IF OBJECT_ID('dbo.ST_INFORMES_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_INFORMES_HISTORIAL (
    id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_INFORMES_HISTORIAL PRIMARY KEY,
    informe_id      INT            NOT NULL CONSTRAINT FK_ST_INFORMES_HISTORIAL_Informe REFERENCES dbo.ST_INFORMES (id),
    accion          VARCHAR(20)    NOT NULL,
    detalle         NVARCHAR(400)  NULL,
    motivo          NVARCHAR(500)  NULL,
    -- [{ "campo": "...", "antes": ..., "despues": ... }]
    cambios         NVARCHAR(MAX)  NULL,
    revision        INT            NOT NULL,
    usuario         NVARCHAR(50)   NOT NULL,
    usuario_nombre  NVARCHAR(120)  NULL,
    fecha           DATETIME2      NOT NULL CONSTRAINT DF_ST_INFORMES_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ST_INFORMES_HISTORIAL_ACCION CHECK (accion IN (
      'EDICION', 'CORRECCION', 'EMISION', 'FOTO_AGREGADA', 'FOTO_EDITADA', 'FOTO_QUITADA', 'FOTOS_ORDEN'
    )),
    CONSTRAINT CK_ST_INFORMES_HISTORIAL_CAMBIOS CHECK (cambios IS NULL OR ISJSON(cambios) = 1)
  );

  CREATE INDEX IX_ST_INFORMES_HISTORIAL_Informe ON dbo.ST_INFORMES_HISTORIAL (informe_id, id);
END;

IF OBJECT_ID('dbo.ST_INFORMES_FOTOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_INFORMES_FOTOS (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_INFORMES_FOTOS PRIMARY KEY,
    informe_id      INT             NOT NULL CONSTRAINT FK_ST_INFORMES_FOTOS_Informe REFERENCES dbo.ST_INFORMES (id),
    orden           INT             NOT NULL,
    descripcion     NVARCHAR(300)   NULL,
    nombre          NVARCHAR(255)   NULL,
    tipo            NVARCHAR(50)    NOT NULL,
    contenido       VARBINARY(MAX)  NOT NULL,
    subido_por      NVARCHAR(50)    NOT NULL,
    subido_en       DATETIME2       NOT NULL CONSTRAINT DF_ST_INFORMES_FOTOS_SUBIDO DEFAULT SYSUTCDATETIME(),
    quitada_por     NVARCHAR(50)    NULL,
    quitada_en      DATETIME2       NULL,
    quitada_motivo  NVARCHAR(500)   NULL,
    CONSTRAINT CK_ST_INFORMES_FOTOS_TIPO CHECK (tipo IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT CK_ST_INFORMES_FOTOS_QUITADA CHECK (
      (quitada_en IS NULL AND quitada_por IS NULL) OR (quitada_en IS NOT NULL AND quitada_por IS NOT NULL)
    )
  );

  CREATE INDEX IX_ST_INFORMES_FOTOS_Informe ON dbo.ST_INFORMES_FOTOS (informe_id, orden);
END;

-- Control de cambios (7.11.2): el módulo queda registrado para validarse y
-- aprobarse antes de su puesta en producción.
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-019')
BEGIN
  INSERT INTO dbo.APP_CAMBIOS
    (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
     estado, a_posteriori, registrado_por)
  VALUES
    ('CC-2026-019', N'2.8.0', N'Módulo Soporte técnico: informes de servicio', 'MODULO', N'Soporte técnico',
     N'Informes de los 8 servicios de soporte (diagnóstico, verificación con IBMETRO, instalación, mantenimiento correctivo, preventivo avanzado y regular, relevamiento de datos y verificaciones internas) a partir de los datos de ServiceMET, con el diseño de las plantillas Excel, símbolos de valoración, cálculos de excentricidad, repetibilidad y linealidad, registro fotográfico, edición con historial, emisión y PDF (migración 008). Incluye avisos antes de emitir (datos faltantes y lecturas que parecen mal transcritas), diagramas de excentricidad y la mejora de redacción con Google Gemini, marcada como IA en el historial.',
     N'Lee DATA_SERVICIOS_DATOS_* sin modificarlas; crea ST_INFORMES, ST_INFORMES_HISTORIAL y ST_INFORMES_FOTOS. La mejora de redacción envía a Google Gemini (servicio externo, 7.11.4) solo el texto que el usuario pide mejorar, sin cliente ni instrumento; requiere GEMINI_API_KEY en el backend.',
     N'Migración 008; backend/src/services/soporte.*.js; src/features/soporte.', '2026-10-21', 'REGISTRADO', 0, N'migración 008');

  INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
  SELECT id, 'REGISTRO', N'Registrado al documentar el módulo Soporte técnico', N'migración 008'
  FROM dbo.APP_CAMBIOS
  WHERE codigo = 'CC-2026-019';
END;
