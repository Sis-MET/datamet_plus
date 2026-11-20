-- ========================================================================
-- MIGRACIÓN 037: COMERCIAL, FASE 4 — COMISIONES CON CIERRE MENSUAL
-- ========================================================================
-- Decisiones de Comercial (2026-11-20, docs/comercial-analisis-facturacion.md
-- §7.3): la comisión se gana al facturar (mes de emisión); las reglas son
-- configurables, con las del Excel por omisión; cada responsable comercial
-- comisiona según su porcentaje en la factura.
--
-- COM_COMISION_REGLAS         versiones de las reglas, cada una con su fecha
--                             de vigencia: tramos de margen y su tasa, sobre
--                             qué se calcula (monto o neto), qué categorías
--                             comisionan y si una venta sin costo comisiona.
--                             No se modifican: un cambio es otra versión.
-- COM_COMISION_CIERRES        el cierre de un mes: lo que se calculó, congelado.
--                             Solo se puede anular (con motivo) para volver a
--                             cerrarlo; nunca se borra.
-- COM_COMISION_CIERRE_LINEAS  el detalle de un cierre: cada línea de factura y
--                             cada responsable con su base, margen, tasa,
--                             porcentaje y comisión. No se modifica.
--
-- Permisos (Sistema › Gestión de permisos): comisiones.comercial.ver (ver
-- las de todos) y comisiones.comercial.gestionar (cambiar las reglas y
-- cerrar meses). Se conceden al jefe de área de Comercial y al área
-- Administración; cada responsable comercial ve las suyas sin permiso.
--
-- Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.COM_COMISION_REGLAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_COMISION_REGLAS (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_COMISION_REGLAS PRIMARY KEY,
    vigente_desde   DATE           NOT NULL CONSTRAINT UX_COM_COMISION_REGLAS_DESDE UNIQUE,
    -- Sobre qué se aplica la tasa: el monto de la línea o su neto de impuestos.
    base            VARCHAR(5)     NOT NULL CONSTRAINT CK_COM_COMISION_REGLAS_BASE CHECK (base IN ('MONTO', 'NETO')),
    -- [{ "desde": 20, "tasa": 0.6 }, …]: margen % desde el que rige cada tasa %.
    tramos          NVARCHAR(2000) NOT NULL,
    -- [3, 4, …]: ids de COM_CATEGORIAS que comisionan.
    categorias      NVARCHAR(4000) NOT NULL,
    -- 1: una venta sin costo comisiona como si su margen fuera el neto (84 %).
    venta_sin_costo BIT            NOT NULL CONSTRAINT DF_COM_COMISION_REGLAS_SIN_COSTO DEFAULT 0,
    nota            NVARCHAR(300)  NOT NULL,
    creado_por      NVARCHAR(50)   NOT NULL,
    creado_nombre   NVARCHAR(120)  NULL,
    creado_en       DATETIME2(0)   NOT NULL CONSTRAINT DF_COM_COMISION_REGLAS_EN DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID('dbo.TR_COM_COMISION_REGLAS_FIJAS', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_COMISION_REGLAS_FIJAS
    ON dbo.COM_COMISION_REGLAS INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51037, N''Las reglas de comisión no se modifican ni se borran: un cambio es otra versión con su fecha de vigencia.'', 1;
    END');

-- Reglas del Excel de facturación 2026, vigentes desde antes de la primera factura.
IF NOT EXISTS (SELECT 1 FROM dbo.COM_COMISION_REGLAS)
BEGIN
  DECLARE @categorias NVARCHAR(4000) = N'[' + ISNULL(STUFF((
    SELECT N',' + CAST(id AS NVARCHAR(12)) FROM dbo.COM_CATEGORIAS WHERE comisiona = 1 ORDER BY orden, id
    FOR XML PATH('')), 1, 1, N''), N'') + N']';
  INSERT INTO dbo.COM_COMISION_REGLAS (vigente_desde, base, tramos, categorias, venta_sin_costo, nota, creado_por, creado_nombre)
  VALUES ('2020-01-01', 'MONTO', N'[{"desde":0,"tasa":0},{"desde":20,"tasa":0.6},{"desde":30.01,"tasa":1}]', @categorias, 0,
    N'Reglas del Excel de facturación 2026: menos de 20 % no comisiona; de 20 % a 30 %, 0,6 %; más de 30 %, 1 %, sobre el monto de la línea.',
    N'migración 037', N'Migración 037');
END;

IF OBJECT_ID('dbo.COM_COMISION_CIERRES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_COMISION_CIERRES (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_COMISION_CIERRES PRIMARY KEY,
    gestion         SMALLINT       NOT NULL,
    mes             TINYINT        NOT NULL CONSTRAINT CK_COM_COMISION_CIERRES_MES CHECK (mes BETWEEN 1 AND 12),
    estado          VARCHAR(8)     NOT NULL CONSTRAINT CK_COM_COMISION_CIERRES_ESTADO CHECK (estado IN ('CERRADO', 'ANULADO')),
    base_total      DECIMAL(14, 2) NOT NULL,
    comision_total  DECIMAL(14, 2) NOT NULL,
    -- Por responsable y lo que quedó sin comisionar (JSON).
    resumen         NVARCHAR(MAX)  NOT NULL,
    -- Versiones de las reglas que se aplicaron (JSON de ids).
    reglas          NVARCHAR(200)  NOT NULL,
    cerrado_por     NVARCHAR(50)   NOT NULL,
    cerrado_nombre  NVARCHAR(120)  NULL,
    cerrado_en      DATETIME2(0)   NOT NULL CONSTRAINT DF_COM_COMISION_CIERRES_EN DEFAULT SYSUTCDATETIME(),
    anulado_motivo  NVARCHAR(300)  NULL,
    anulado_por     NVARCHAR(50)   NULL,
    anulado_nombre  NVARCHAR(120)  NULL,
    anulado_en      DATETIME2(0)   NULL,
    CONSTRAINT CK_COM_COMISION_CIERRES_ANULACION CHECK (
      (estado = 'CERRADO' AND anulado_en IS NULL) OR (estado = 'ANULADO' AND anulado_en IS NOT NULL AND anulado_motivo IS NOT NULL)
    )
  );
END;

-- Un solo cierre vigente por mes (los anulados quedan en el historial).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_COM_COMISION_CIERRES_VIGENTE')
  EXEC(N'CREATE UNIQUE INDEX UX_COM_COMISION_CIERRES_VIGENTE ON dbo.COM_COMISION_CIERRES (gestion, mes) WHERE estado = ''CERRADO''');

IF OBJECT_ID('dbo.TR_COM_COMISION_CIERRES_SIN_BORRAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_COMISION_CIERRES_SIN_BORRAR
    ON dbo.COM_COMISION_CIERRES INSTEAD OF DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51037, N''Los cierres de comisiones no se borran: se anulan con su motivo.'', 1;
    END');

IF OBJECT_ID('dbo.TR_COM_COMISION_CIERRES_SOLO_ANULAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_COMISION_CIERRES_SOLO_ANULAR
    ON dbo.COM_COMISION_CIERRES AFTER UPDATE
    AS
    BEGIN
      SET NOCOUNT ON;
      IF UPDATE(gestion) OR UPDATE(mes) OR UPDATE(base_total) OR UPDATE(comision_total) OR UPDATE(resumen) OR UPDATE(reglas)
        OR UPDATE(cerrado_por) OR UPDATE(cerrado_nombre) OR UPDATE(cerrado_en)
        OR EXISTS (SELECT 1 FROM deleted WHERE estado = ''ANULADO'')
        THROW 51037, N''De un cierre de comisiones solo se registra su anulación, una vez.'', 1;
    END');

IF OBJECT_ID('dbo.COM_COMISION_CIERRE_LINEAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_COMISION_CIERRE_LINEAS (
    id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_COMISION_CIERRE_LINEAS PRIMARY KEY,
    cierre_id      INT            NOT NULL CONSTRAINT FK_COM_COMISION_CIERRE_LINEAS_CIERRE REFERENCES dbo.COM_COMISION_CIERRES (id),
    usuario_id     INT            NULL,
    nombre         NVARCHAR(120)  NOT NULL,
    factura_id     INT            NOT NULL,
    gestion        SMALLINT       NOT NULL,
    numero         INT            NOT NULL,
    fecha          DATE           NOT NULL,
    razon_social   NVARCHAR(255)  NOT NULL,
    categoria      NVARCHAR(160)  NOT NULL,
    monto_linea    DECIMAL(14, 2) NOT NULL,
    base           DECIMAL(14, 2) NOT NULL,
    margen         DECIMAL(7, 2)  NULL,
    tasa           DECIMAL(6, 3)  NOT NULL,
    porcentaje     DECIMAL(6, 2)  NOT NULL,
    comision       DECIMAL(14, 2) NOT NULL,
    regla_id       INT            NOT NULL
  );
  CREATE INDEX IX_COM_COMISION_CIERRE_LINEAS_CIERRE ON dbo.COM_COMISION_CIERRE_LINEAS (cierre_id, usuario_id);
END;

IF OBJECT_ID('dbo.TR_COM_COMISION_CIERRE_LINEAS_FIJAS', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_COMISION_CIERRE_LINEAS_FIJAS
    ON dbo.COM_COMISION_CIERRE_LINEAS INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51037, N''El detalle de un cierre de comisiones no se modifica ni se borra.'', 1;
    END');

-- El historial de Comercial también anota las reglas y los cierres.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_COM_HISTORIAL_ENTIDAD'
           AND definition NOT LIKE '%COMISION%')
BEGIN
  ALTER TABLE dbo.COM_HISTORIAL DROP CONSTRAINT CK_COM_HISTORIAL_ENTIDAD;
  ALTER TABLE dbo.COM_HISTORIAL ADD CONSTRAINT CK_COM_HISTORIAL_ENTIDAD
    CHECK (entidad IN ('FACTURA', 'PAGO', 'CLIENTE', 'BITRIX', 'COMISION'));
END;

-- Permisos de comisiones: jefe de área de Comercial y área Administración.
IF OBJECT_ID('dbo.APP_PERMISOS_CONCESIONES', 'U') IS NOT NULL
BEGIN
  DECLARE @motivo NVARCHAR(300) = N'Comercial (2026-11-20): las reglas y los cierres de comisiones los manejan Comercial y Administración.';
  DECLARE @semilla TABLE (permiso VARCHAR(60), area NVARCHAR(60), cargo NVARCHAR(60), sujeto NVARCHAR(200));
  INSERT INTO @semilla VALUES
    ('comisiones.comercial.ver', N'comercial', N'jefe de area', N'Jefe de área de Comercial'),
    ('comisiones.comercial.ver', N'administracion', NULL, N'Área Administración'),
    ('comisiones.comercial.gestionar', N'comercial', N'jefe de area', N'Jefe de área de Comercial'),
    ('comisiones.comercial.gestionar', N'administracion', NULL, N'Área Administración');

  INSERT INTO dbo.APP_PERMISOS_CONCESIONES (permiso, usuario_id, area, cargo, motivo, concedido_por)
  SELECT s.permiso, NULL, s.area, s.cargo, @motivo, N'migración 037'
  FROM @semilla s
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.APP_PERMISOS_CONCESIONES c
    WHERE c.permiso = s.permiso AND c.usuario_id IS NULL AND c.area = s.area AND ISNULL(c.cargo, N'') = ISNULL(s.cargo, N'') AND c.revocado_en IS NULL
  );

  IF NOT EXISTS (SELECT 1 FROM dbo.APP_PERMISOS_HISTORIAL WHERE usuario = N'migración 037')
    INSERT INTO dbo.APP_PERMISOS_HISTORIAL (accion, permiso, concesion_id, sujeto, anteriores, nuevos, motivo, usuario, nombre)
    SELECT 'CONCEDER', s.permiso, c.id, s.sujeto, N'[]', N'["Jefe de área de Comercial","Área Administración"]',
      @motivo, N'migración 037', N'Migración 037'
    FROM @semilla s
    JOIN dbo.APP_PERMISOS_CONCESIONES c
      ON c.permiso = s.permiso AND c.usuario_id IS NULL AND c.area = s.area AND ISNULL(c.cargo, N'') = ISNULL(s.cargo, N'') AND c.revocado_en IS NULL;
END;
