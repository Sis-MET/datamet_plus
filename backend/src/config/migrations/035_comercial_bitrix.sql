-- ========================================================================
-- MIGRACIÓN 035: COMERCIAL, FASE 2 — COPIA DE BITRIX24
-- ========================================================================
-- DataMET+ lee Bitrix24 (solo lectura) cada 15 minutos y guarda una copia de
-- las negociaciones para que Comercial no dependa de que Bitrix24 responda
-- (docs/comercial-analisis-facturacion.md, §6.3).
--
-- COM_BITRIX_NEGOCIACIONES  una fila por negociación: embudo, etapa (y su
--                           fase: por facturar, en cobro, ganada, perdida),
--                           monto, responsable, empresa, cotización,
--                           regional, técnicos, cantidad de equipos y nota
--                           de salida. Es una copia: se reemplaza en cada
--                           sincronización.
-- COM_BITRIX_EMPRESAS       empresas de Bitrix24 con su «Codigo cliente»
--                           (casi siempre el de la planta, 0458-11) y su NIT.
-- COM_BITRIX_COTIZACIONES   los códigos de cotización de cada negociación con
--                           su clave normalizada (sin revisión ni ceros).
-- COM_BITRIX_ENLACES        qué negociación corresponde a qué factura: por la
--                           cotización o por la referencia «Negociación de
--                           Bitrix24» de la factura. Se recalcula.
-- COM_BITRIX_USUARIOS       responsables de Bitrix24 y su persona en
--                           DATA_USERS (sugerida por las facturas, confirmada
--                           por Comercial).
-- COM_BITRIX_SINCRONIZACIONES  cada sincronización, su resultado y su error.
--
-- No modifica nada de Bitrix24. Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.COM_BITRIX_NEGOCIACIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_BITRIX_NEGOCIACIONES (
    deal_id          INT            NOT NULL CONSTRAINT PK_COM_BITRIX_NEGOCIACIONES PRIMARY KEY,
    embudo_id        INT            NOT NULL,
    embudo           NVARCHAR(100)  NULL,
    etapa_id         VARCHAR(50)    NOT NULL,
    etapa            NVARCHAR(100)  NULL,
    -- FACTURAR (Para facturar, Pre-factura…), COBRO (Facturado, Pendiente de
    -- pago…), GANADA, PERDIDA o PROCESO.
    etapa_fase       VARCHAR(10)    NOT NULL CONSTRAINT CK_COM_BITRIX_NEGOCIACIONES_FASE
                                    CHECK (etapa_fase IN ('PROCESO', 'FACTURAR', 'COBRO', 'GANADA', 'PERDIDA')),
    titulo           NVARCHAR(255)  NULL,
    monto            DECIMAL(14, 2) NULL,
    moneda           VARCHAR(3)     NULL,
    responsable_id   INT            NULL,
    empresa_id       INT            NULL,
    cotizacion       NVARCHAR(400)  NULL,
    regional         VARCHAR(3)     NULL CONSTRAINT CK_COM_BITRIX_NEGOCIACIONES_REGIONAL CHECK (regional IN ('LPZ', 'SCZ')),
    ciudad           NVARCHAR(120)  NULL,
    num_balanzas     INT            NULL,
    num_pesas        INT            NULL,
    sub_area         VARCHAR(10)    NULL,
    tipos_servicio   NVARCHAR(400)  NULL,
    tecnico          NVARCHAR(120)  NULL,
    apoyo            NVARCHAR(400)  NULL,
    nota_salida      NVARCHAR(200)  NULL,
    orden_compra     NVARCHAR(200)  NULL,
    condiciones      NVARCHAR(400)  NULL,
    mes_facturar     NVARCHAR(60)   NULL,
    facturado        BIT            NULL,
    creada           DATETIME2      NULL,
    modificada       DATETIME2      NULL,
    cierre           DATE           NULL,
    sincronizada_en  DATETIME2      NOT NULL CONSTRAINT DF_COM_BITRIX_NEGOCIACIONES_SINC DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_COM_BITRIX_NEGOCIACIONES_FASE ON dbo.COM_BITRIX_NEGOCIACIONES (etapa_fase, modificada DESC);
  CREATE INDEX IX_COM_BITRIX_NEGOCIACIONES_EMPRESA ON dbo.COM_BITRIX_NEGOCIACIONES (empresa_id);
END;

IF OBJECT_ID('dbo.COM_BITRIX_EMPRESAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_BITRIX_EMPRESAS (
    empresa_id       INT            NOT NULL CONSTRAINT PK_COM_BITRIX_EMPRESAS PRIMARY KEY,
    titulo           NVARCHAR(255)  NULL,
    codigo           NVARCHAR(50)   NULL,
    nit              NVARCHAR(20)   NULL,
    sincronizada_en  DATETIME2      NOT NULL CONSTRAINT DF_COM_BITRIX_EMPRESAS_SINC DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID('dbo.COM_BITRIX_COTIZACIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_BITRIX_COTIZACIONES (
    id       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_BITRIX_COTIZACIONES PRIMARY KEY,
    deal_id  INT           NOT NULL,
    codigo   NVARCHAR(60)  NOT NULL,
    clave    NVARCHAR(60)  NOT NULL,
    -- De qué campo salió: cotizacion, cotizacionCalibracion, cotizacionInstalacion
    -- o titulo (si los campos no traen ninguna).
    campo    VARCHAR(25)   NULL
  );
  CREATE INDEX IX_COM_BITRIX_COTIZACIONES_CLAVE ON dbo.COM_BITRIX_COTIZACIONES (clave);
  CREATE INDEX IX_COM_BITRIX_COTIZACIONES_DEAL ON dbo.COM_BITRIX_COTIZACIONES (deal_id);
END;

IF OBJECT_ID('dbo.COM_BITRIX_ENLACES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_BITRIX_ENLACES (
    deal_id     INT          NOT NULL,
    factura_id  INT          NOT NULL CONSTRAINT FK_COM_BITRIX_ENLACES_FACTURA REFERENCES dbo.COM_FACTURAS (id),
    por         VARCHAR(12)  NOT NULL CONSTRAINT CK_COM_BITRIX_ENLACES_POR CHECK (por IN ('COTIZACION', 'REFERENCIA')),
    CONSTRAINT PK_COM_BITRIX_ENLACES PRIMARY KEY (deal_id, factura_id)
  );
  CREATE INDEX IX_COM_BITRIX_ENLACES_FACTURA ON dbo.COM_BITRIX_ENLACES (factura_id);
END;

IF OBJECT_ID('dbo.COM_BITRIX_USUARIOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_BITRIX_USUARIOS (
    bitrix_id          INT            NOT NULL CONSTRAINT PK_COM_BITRIX_USUARIOS PRIMARY KEY,
    -- Nombre en Bitrix24, si el webhook puede leer usuarios (permiso «user»).
    nombre             NVARCHAR(120)  NULL,
    -- DATA_USERS.id confirmado por Comercial; null mientras no se confirma.
    usuario_id         INT            NULL,
    sugerido_id        INT            NULL,
    sugerencia         NVARCHAR(200)  NULL,
    confirmado_por     NVARCHAR(50)   NULL,
    confirmado_en      DATETIME2      NULL
  );
END;

IF OBJECT_ID('dbo.COM_BITRIX_SINCRONIZACIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_BITRIX_SINCRONIZACIONES (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_BITRIX_SINCRONIZACIONES PRIMARY KEY,
    tipo            VARCHAR(10)     NOT NULL CONSTRAINT CK_COM_BITRIX_SINC_TIPO CHECK (tipo IN ('COMPLETA', 'CAMBIOS')),
    -- Lo modificado desde esta fecha (null en la completa).
    desde           DATETIME2       NULL,
    inicio          DATETIME2       NOT NULL CONSTRAINT DF_COM_BITRIX_SINC_INICIO DEFAULT SYSUTCDATETIME(),
    fin             DATETIME2       NULL,
    estado          VARCHAR(10)     NOT NULL CONSTRAINT CK_COM_BITRIX_SINC_ESTADO CHECK (estado IN ('EN_CURSO', 'OK', 'ERROR')),
    negociaciones   INT             NULL,
    empresas        INT             NULL,
    enlaces         INT             NULL,
    error           NVARCHAR(1000)  NULL,
    por             NVARCHAR(50)    NOT NULL
  );
  CREATE INDEX IX_COM_BITRIX_SINC_FIN ON dbo.COM_BITRIX_SINCRONIZACIONES (estado, id DESC);
END;

-- El historial de Comercial también registra las equivalencias de responsables.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_COM_HISTORIAL_ENTIDAD'
           AND definition NOT LIKE '%BITRIX%')
BEGIN
  ALTER TABLE dbo.COM_HISTORIAL DROP CONSTRAINT CK_COM_HISTORIAL_ENTIDAD;
  ALTER TABLE dbo.COM_HISTORIAL ADD CONSTRAINT CK_COM_HISTORIAL_ENTIDAD
    CHECK (entidad IN ('FACTURA', 'PAGO', 'CLIENTE', 'BITRIX'));
END;
