-- ========================================================================
-- MIGRACIÓN 029: GESTIÓN DE PERMISOS (NB/ISO/IEC 17025, 7.11.3 a y 8.4)
-- ========================================================================
-- Sistema › Gestión de permisos: los permisos con nombre del catálogo
-- (backend/src/services/permisos.catalogo.js) se conceden a una persona o a
-- un grupo (un área, un cargo o un cargo de un área) sin tocar el código.
-- Sistemas (nivel 3) los tiene todos; gestionan Sistemas y el jefe de
-- Sistemas (fijo en el código).
--
-- APP_PERMISOS_CONCESIONES: una fila por concesión. No se borra: revocar
--   llena revocado_por, revocado_en y motivo_revocacion; después la fila ya
--   no cambia. Una sola concesión vigente por permiso y sujeto.
-- APP_PERMISOS_HISTORIAL: cada cambio con quién, cuándo, qué y quiénes tenían
--   el permiso antes y después. Solo se agregan filas.
--
-- Siembra: todos los jefes de área (cargo «Jefe de Area», de cualquier área)
-- ven los tiempos de servicio de Soporte técnico y de Calibración. Hasta la
-- 2.18.3 los veía solo el jefe de cada área (regla fija en el código).
--
-- Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.APP_PERMISOS_CONCESIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.APP_PERMISOS_CONCESIONES (
    id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_APP_PERMISOS_CONCESIONES PRIMARY KEY,
    permiso            VARCHAR(60)   NOT NULL,
    -- Una persona (DATA_USERS.id) o un grupo: área y/o cargo normalizados
    -- (sin tildes, en minúsculas); el que falta vale para todos.
    usuario_id         INT           NULL,
    area               NVARCHAR(60)  NULL,
    cargo              NVARCHAR(60)  NULL,
    motivo             NVARCHAR(300) NULL,
    concedido_por      NVARCHAR(50)  NOT NULL,
    concedido_en       DATETIME2     NOT NULL CONSTRAINT DF_APP_PERMISOS_CONCESIONES_EN DEFAULT SYSUTCDATETIME(),
    revocado_por       NVARCHAR(50)  NULL,
    revocado_en        DATETIME2     NULL,
    motivo_revocacion  NVARCHAR(300) NULL,
    CONSTRAINT CK_APP_PERMISOS_CONCESIONES_SUJETO CHECK (
      (usuario_id IS NOT NULL AND area IS NULL AND cargo IS NULL)
      OR (usuario_id IS NULL AND (area IS NOT NULL OR cargo IS NOT NULL))
    ),
    CONSTRAINT CK_APP_PERMISOS_CONCESIONES_REVOCACION CHECK (
      (revocado_en IS NULL AND revocado_por IS NULL)
      OR (revocado_en IS NOT NULL AND revocado_por IS NOT NULL)
    )
  );
END;

-- Una concesión vigente por permiso y sujeto (en un índice único, NULL = NULL).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_APP_PERMISOS_CONCESIONES_VIGENTE')
  EXEC(N'CREATE UNIQUE INDEX UX_APP_PERMISOS_CONCESIONES_VIGENTE
    ON dbo.APP_PERMISOS_CONCESIONES (permiso, usuario_id, area, cargo) WHERE revocado_en IS NULL');

IF OBJECT_ID('dbo.APP_PERMISOS_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.APP_PERMISOS_HISTORIAL (
    id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_APP_PERMISOS_HISTORIAL PRIMARY KEY,
    accion        VARCHAR(20)    NOT NULL CONSTRAINT CK_APP_PERMISOS_HISTORIAL_ACCION CHECK (accion IN ('CONCEDER', 'REVOCAR')),
    permiso       VARCHAR(60)    NOT NULL,
    concesion_id  INT            NULL,
    -- A quién se concedió o revocó, en palabras, tal como era en ese momento.
    sujeto        NVARCHAR(200)  NOT NULL,
    -- Quiénes tenían el permiso antes y después del cambio (JSON, lista de sujetos).
    anteriores    NVARCHAR(MAX)  NOT NULL,
    nuevos        NVARCHAR(MAX)  NOT NULL,
    motivo        NVARCHAR(300)  NULL,
    usuario       NVARCHAR(50)   NOT NULL,
    nombre        NVARCHAR(120)  NULL,
    fecha         DATETIME2      NOT NULL CONSTRAINT DF_APP_PERMISOS_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_APP_PERMISOS_HISTORIAL_PERMISO ON dbo.APP_PERMISOS_HISTORIAL (permiso, id);
END;

-- El historial solo crece: la base rechaza modificar o borrar sus filas.
IF OBJECT_ID('dbo.TR_APP_PERMISOS_HISTORIAL_SOLO_AGREGAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_APP_PERMISOS_HISTORIAL_SOLO_AGREGAR
    ON dbo.APP_PERMISOS_HISTORIAL INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51029, N''El historial de permisos no se modifica ni se borra (NB/ISO/IEC 17025, 8.4).'', 1;
    END');

-- Las concesiones no se borran; de una vigente solo se registra la revocación,
-- una vez, y una revocada ya no cambia.
IF OBJECT_ID('dbo.TR_APP_PERMISOS_CONCESIONES_SIN_BORRAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_APP_PERMISOS_CONCESIONES_SIN_BORRAR
    ON dbo.APP_PERMISOS_CONCESIONES INSTEAD OF DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51029, N''Las concesiones de permisos no se borran: se revocan con su motivo.'', 1;
    END');

IF OBJECT_ID('dbo.TR_APP_PERMISOS_CONCESIONES_SOLO_REVOCAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_APP_PERMISOS_CONCESIONES_SOLO_REVOCAR
    ON dbo.APP_PERMISOS_CONCESIONES AFTER UPDATE
    AS
    BEGIN
      SET NOCOUNT ON;
      IF UPDATE(permiso) OR UPDATE(usuario_id) OR UPDATE(area) OR UPDATE(cargo) OR UPDATE(motivo)
        OR UPDATE(concedido_por) OR UPDATE(concedido_en)
        OR EXISTS (SELECT 1 FROM deleted WHERE revocado_en IS NOT NULL)
        THROW 51029, N''De una concesión de permiso solo se registra su revocación, una vez.'', 1;
    END');

-- Siembra: los jefes de área de todas las áreas ven los tiempos de servicio.
DECLARE @semilla TABLE (permiso VARCHAR(60), anterior NVARCHAR(200));
INSERT INTO @semilla VALUES
  ('tiempos.soporte.ver', N'Jefe de Area de Soporte Técnico (regla fija en el código hasta la 2.18.3)'),
  ('tiempos.calibracion.ver', N'Jefe de Area de Calibración (regla fija en el código hasta la 2.18.3)');

DECLARE @motivo NVARCHAR(300) = N'Pedido de Sistemas: los jefes de área de todas las áreas ven los tiempos de servicio de Soporte técnico y de Calibración.';

INSERT INTO dbo.APP_PERMISOS_CONCESIONES (permiso, usuario_id, area, cargo, motivo, concedido_por)
SELECT s.permiso, NULL, NULL, N'jefe de area', @motivo, N'migración 029'
FROM @semilla s
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.APP_PERMISOS_CONCESIONES c
  WHERE c.permiso = s.permiso AND c.usuario_id IS NULL AND c.area IS NULL AND c.cargo = N'jefe de area'
);

INSERT INTO dbo.APP_PERMISOS_HISTORIAL (accion, permiso, concesion_id, sujeto, anteriores, nuevos, motivo, usuario, nombre)
SELECT 'CONCEDER', s.permiso, c.id, N'Jefes de área de todas las áreas',
  N'["' + s.anterior + N'"]', N'["Jefes de área de todas las áreas"]', @motivo, N'migración 029', N'Migración 029 (versión 2.19.0)'
FROM @semilla s
JOIN dbo.APP_PERMISOS_CONCESIONES c
  ON c.permiso = s.permiso AND c.usuario_id IS NULL AND c.area IS NULL AND c.cargo = N'jefe de area' AND c.revocado_en IS NULL
WHERE NOT EXISTS (SELECT 1 FROM dbo.APP_PERMISOS_HISTORIAL h WHERE h.permiso = s.permiso AND h.usuario = N'migración 029');
