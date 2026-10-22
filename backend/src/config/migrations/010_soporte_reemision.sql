-- ========================================================================
-- MIGRACIÓN 010: REEMISIÓN DE INFORMES DE SOPORTE TÉCNICO
-- ========================================================================
-- Un informe emitido ya no se corrige en el acto: se abre una revisión con
-- su motivo, los cambios se guardan como borrador de la revisión siguiente
-- (la vigente sigue siendo la que se imprime) y al reemitir pasa a ser la
-- nueva revisión, con quién y cuándo (NB/ISO/IEC 17025, 7.5.2 y 7.8.8).
--
-- ST_INFORMES             : estado EN_REVISION y los datos de la revisión
--                           abierta (motivo, quién y cuándo la abrió).
-- ST_INFORMES_HISTORIAL   : acciones REVISION_ABIERTA, REEMISION y
--                           REVISION_CANCELADA.
-- ST_INFORMES_REVISIONES  : copia de cada revisión emitida (datos del
--                           servicio, correcciones y fotos) para volver a
--                           imprimirla tal como se entregó. Solo inserción.
--
-- Registra el cambio en el Control de cambios (APP_CAMBIOS, migración 007).
-- Es idempotente. Las sentencias que usan columnas nuevas van en EXEC: el
-- lote se compila entero antes de ejecutarse.
-- ========================================================================

SET XACT_ABORT ON;

IF COL_LENGTH('dbo.ST_INFORMES', 'revision_motivo') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD revision_motivo NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.ST_INFORMES', 'revision_abierta_por') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD revision_abierta_por NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.ST_INFORMES', 'revision_abierta_en') IS NULL
  ALTER TABLE dbo.ST_INFORMES ADD revision_abierta_en DATETIME2 NULL;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ST_INFORMES_ESTADO')
  ALTER TABLE dbo.ST_INFORMES DROP CONSTRAINT CK_ST_INFORMES_ESTADO;
ALTER TABLE dbo.ST_INFORMES ADD CONSTRAINT CK_ST_INFORMES_ESTADO
  CHECK (estado IN ('BORRADOR', 'EMITIDO', 'EN_REVISION'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ST_INFORMES_REVISION_ABIERTA')
  EXEC('ALTER TABLE dbo.ST_INFORMES ADD CONSTRAINT CK_ST_INFORMES_REVISION_ABIERTA CHECK (
    estado <> ''EN_REVISION''
    OR (revision_motivo IS NOT NULL AND revision_abierta_por IS NOT NULL AND revision_abierta_en IS NOT NULL)
  );');

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ST_INFORMES_HISTORIAL_ACCION')
  ALTER TABLE dbo.ST_INFORMES_HISTORIAL DROP CONSTRAINT CK_ST_INFORMES_HISTORIAL_ACCION;
ALTER TABLE dbo.ST_INFORMES_HISTORIAL ADD CONSTRAINT CK_ST_INFORMES_HISTORIAL_ACCION CHECK (accion IN (
  'EDICION', 'CORRECCION', 'EMISION', 'FOTO_AGREGADA', 'FOTO_EDITADA', 'FOTO_QUITADA', 'FOTOS_ORDEN',
  'REVISION_ABIERTA', 'REEMISION', 'REVISION_CANCELADA'
));

IF OBJECT_ID('dbo.ST_INFORMES_REVISIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ST_INFORMES_REVISIONES (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ST_INFORMES_REVISIONES PRIMARY KEY,
    informe_id      INT            NOT NULL CONSTRAINT FK_ST_INFORMES_REVISIONES_Informe REFERENCES dbo.ST_INFORMES (id),
    revision        INT            NOT NULL,
    -- Fila del servicio en ServiceMET, ya normalizada, al emitir.
    fuente          NVARCHAR(MAX)  NOT NULL,
    -- Correcciones del área (campo -> valor) al emitir.
    datos           NVARCHAR(MAX)  NOT NULL,
    -- [{ "id": n, "orden": n, "descripcion": "..." }]: las fotos no se borran.
    fotos           NVARCHAR(MAX)  NOT NULL,
    -- Motivo de la revisión (nulo en la emisión original).
    motivo          NVARCHAR(500)  NULL,
    emitido_por     NVARCHAR(50)   NOT NULL,
    emitido_nombre  NVARCHAR(120)  NULL,
    emitido_en      DATETIME2      NOT NULL,
    -- 1: copia tomada después (al abrir la primera revisión de un informe
    -- emitido antes de esta migración), con el estado que tenía entonces.
    posterior       BIT            NOT NULL CONSTRAINT DF_ST_INFORMES_REVISIONES_POSTERIOR DEFAULT 0,
    registrado_en   DATETIME2      NOT NULL CONSTRAINT DF_ST_INFORMES_REVISIONES_EN DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ST_INFORMES_REVISIONES UNIQUE (informe_id, revision),
    CONSTRAINT CK_ST_INFORMES_REVISIONES_FUENTE CHECK (ISJSON(fuente) = 1),
    CONSTRAINT CK_ST_INFORMES_REVISIONES_DATOS CHECK (ISJSON(datos) = 1),
    CONSTRAINT CK_ST_INFORMES_REVISIONES_FOTOS CHECK (ISJSON(fotos) = 1)
  );
END;

-- Control de cambios (7.11.2).
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE codigo = 'CC-2026-021')
BEGIN
  INSERT INTO dbo.APP_CAMBIOS
    (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
     estado, a_posteriori, registrado_por)
  VALUES
    ('CC-2026-021', N'2.10.0', N'Soporte técnico: reemisión de informes', 'MEJORA', N'Soporte técnico',
     N'Un informe emitido se cambia abriendo una revisión con su motivo: los cambios (datos y fotos) se guardan como borrador de la revisión siguiente sin pedir motivo en cada guardado ni subir la revisión, mientras la vigente sigue siendo la que se imprime. Al reemitir queda la nueva revisión con quién y cuándo; también se puede cancelar la revisión, que vuelve a la vigente. El pie del informe dice qué revisión reemplaza, el informe cierra con el motivo de cada revisión, y cada revisión emitida se guarda completa para volver a imprimirla o guardarla en PDF (migración 010).',
     N'Agrega el estado EN_REVISION y sus columnas a ST_INFORMES, nuevas acciones en ST_INFORMES_HISTORIAL y crea ST_INFORMES_REVISIONES (solo inserción). Un informe emitido ya no se corrige directamente. Los informes emitidos antes guardan su copia al abrir su primera revisión.',
     N'Migración 010; backend/src/services/soporte.informes.js, soporte.revisiones.js; src/features/soporte.', '2026-10-22', 'REGISTRADO', 0, N'migración 010');

  INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
  SELECT id, 'REGISTRO', N'Registrado al agregar la reemisión de informes de Soporte técnico', N'migración 010'
  FROM dbo.APP_CAMBIOS
  WHERE codigo = 'CC-2026-021';
END;
