-- ========================================================================
-- MIGRACIÓN 036: COMERCIAL, FASE 3 — ACTUALIZAR BITRIX24 DESDE DATAMET+
-- ========================================================================
-- Con una factura registrada, DataMET+ propone actualizar su negociación en
-- Bitrix24 y Comercial lo confirma (docs/comercial-analisis-facturacion.md,
-- §6.3 «Escribir de vuelta»):
--
--   * «¿Está facturado?» = Sí.
--   * La etapa de cobro de su embudo (Pendiente de pago, Facturado…).
--   * «Cerrado Ganado» cuando sus facturas quedan pagadas.
--   * El N.º de factura, en el campo que Comercial cree en Bitrix24.
--
-- COM_BITRIX_ETAPAS        etapas de cada embudo, en su orden y con su fase,
--                          para saber a cuál se avanza (nunca se retrocede).
-- COM_BITRIX_NEGOCIACIONES numero_factura: lo que dice ese campo en Bitrix24;
--                          pendiente: qué le falta a Bitrix24 (JSON de los
--                          cambios), o NULL si está al día. Se recalcula.
-- COM_BITRIX_SINCRONIZACIONES  campos: códigos de los campos del portal que
--                          encontró la sincronización (JSON).
--
-- Cada escritura queda en COM_HISTORIAL (entidad BITRIX) con antes y después.
-- Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.COM_BITRIX_ETAPAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_BITRIX_ETAPAS (
    etapa_id        VARCHAR(50)   NOT NULL CONSTRAINT PK_COM_BITRIX_ETAPAS PRIMARY KEY,
    embudo_id       INT           NOT NULL,
    nombre          NVARCHAR(100) NOT NULL,
    semantica       VARCHAR(10)   NOT NULL,
    fase            VARCHAR(10)   NOT NULL
      CONSTRAINT CK_COM_BITRIX_ETAPAS_FASE CHECK (fase IN ('PROCESO', 'FACTURAR', 'COBRO', 'GANADA', 'PERDIDA')),
    orden           INT           NOT NULL,
    sincronizada_en DATETIME2(0)  NOT NULL CONSTRAINT DF_COM_BITRIX_ETAPAS_SINC DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_COM_BITRIX_ETAPAS_EMBUDO ON dbo.COM_BITRIX_ETAPAS (embudo_id, orden);
END;

IF COL_LENGTH('dbo.COM_BITRIX_NEGOCIACIONES', 'numero_factura') IS NULL
  ALTER TABLE dbo.COM_BITRIX_NEGOCIACIONES ADD numero_factura NVARCHAR(200) NULL;

IF COL_LENGTH('dbo.COM_BITRIX_NEGOCIACIONES', 'pendiente') IS NULL
  ALTER TABLE dbo.COM_BITRIX_NEGOCIACIONES ADD pendiente NVARCHAR(1000) NULL;

IF COL_LENGTH('dbo.COM_BITRIX_SINCRONIZACIONES', 'campos') IS NULL
  ALTER TABLE dbo.COM_BITRIX_SINCRONIZACIONES ADD campos NVARCHAR(2000) NULL;
