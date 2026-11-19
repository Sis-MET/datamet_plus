-- ========================================================================
-- MIGRACIÓN 034: COMERCIAL, FASE 1 — FACTURAS, PAGOS Y COBRANZA
-- ========================================================================
-- Reemplaza el libro «2026 FACTURACION metrica.xlsx» (docs/comercial-
-- analisis-facturacion.md). Nada se borra: una factura o un pago se anulan
-- con motivo, y cada alta, anulación e importación queda en COM_HISTORIAL.
--
-- COM_CATEGORIAS          catálogo de categorías de ingreso (las 51 columnas
--                         H:BF del Excel 2026), con área, sub área, regla de
--                         margen y si comisionan según las fórmulas del Excel.
-- COM_FACTURAS            una fila por factura; número único por gestión.
-- COM_FACTURA_LINEAS      el monto repartido por categoría; las líneas suman
--                         el monto (lo controla el servidor) y no se modifican.
-- COM_FACTURA_REFERENCIAS cotizaciones, nota de salida, RIM, OTST, Bitrix24.
-- COM_FACTURA_PERSONAS    responsable comercial, quién cotizó, quién ejecutó.
-- COM_PAGOS               cada pago recibido, una vez.
-- COM_PAGO_APLICACIONES   qué parte de cada pago va a cada factura: admite
--                         anticipos (pago sin aplicar), pagos de varias
--                         facturas y pagos parciales.
-- COM_CLIENTES            datos de facturación del cliente que no están en
--                         DATA_CLIENTES (plazo de crédito, correos, ventana de
--                         recepción). DATA_CLIENTES no se modifica.
-- COM_HISTORIAL           solo crece.
--
-- Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.COM_CATEGORIAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_CATEGORIAS (
    id                INT            NOT NULL CONSTRAINT PK_COM_CATEGORIAS PRIMARY KEY,
    codigo            VARCHAR(40)    NOT NULL CONSTRAINT UQ_COM_CATEGORIAS_CODIGO UNIQUE,
    nombre            NVARCHAR(120)  NOT NULL,
    -- Área que factura: Soporte técnico (ST), Calibración (CAL) o Ventas (VENT),
    -- como los totales MNT / CAL / VENT del Excel.
    area              VARCHAR(4)     NOT NULL CONSTRAINT CK_COM_CATEGORIAS_AREA CHECK (area IN ('ST', 'CAL', 'VENT')),
    subarea           VARCHAR(20)    NOT NULL,
    -- NETO: monto sin impuestos (× 0,84); LOGISTICA: × 0,80; PRODUCTO: neto
    -- menos costo de almacén; TERCERO: neto menos el costo del tercero × 0,87.
    regla_margen      VARCHAR(10)    NOT NULL CONSTRAINT CK_COM_CATEGORIAS_REGLA CHECK (regla_margen IN ('NETO', 'LOGISTICA', 'PRODUCTO', 'TERCERO')),
    comisiona         BIT            NOT NULL,
    -- Columna y encabezado (en mayúsculas, sin tildes) del Excel 2026, para importar.
    excel_columna     VARCHAR(3)     NULL,
    excel_encabezado  NVARCHAR(160)  NULL,
    orden             INT            NOT NULL,
    vigente           BIT            NOT NULL CONSTRAINT DF_COM_CATEGORIAS_VIGENTE DEFAULT 1
  );
END;

DECLARE @categorias TABLE (
  id INT, codigo VARCHAR(40), nombre NVARCHAR(120), area VARCHAR(4), subarea VARCHAR(20),
  regla_margen VARCHAR(10), comisiona BIT, excel_columna VARCHAR(3), excel_encabezado NVARCHAR(160)
);
INSERT INTO @categorias VALUES
    (1, 'ST-STIL-DIAG', N'Diagnóstico (STIL)', 'ST', 'STIL', 'NETO', 1, 'H', N'DIAGNOSTICO (STIL)'),
    (2, 'ST-STIL-AJML', N'Ajustes metrológicos en linealidad (STIL)', 'ST', 'STIL', 'NETO', 1, 'I', N'AJUSTES METROLOGICOS EN LINEALIDAD (STIL)'),
    (3, 'ST-STIL-MPR', N'Mantenimiento preventivo (STIL)', 'ST', 'STIL', 'NETO', 1, 'J', N'MNT. PREVENTIVO (STIL)'),
    (4, 'ST-STIL-MCR', N'Mantenimiento correctivo (STIL)', 'ST', 'STIL', 'NETO', 1, 'K', N'MNT. CORRECTIVO (STIL)'),
    (5, 'ST-STIL-INST', N'Instalación y montaje (STIL)', 'ST', 'STIL', 'NETO', 1, 'L', N'INSTALACION Y MONTAJE (STIL)'),
    (6, 'ST-STIL-PSP', N'Mantenimiento de pesas patrón (STIL)', 'ST', 'STIL', 'NETO', 1, 'M', N'MNT PESAS PATRON (STIL)'),
    (7, 'ST-STAC-DIAG', N'Diagnóstico (STAC)', 'ST', 'STAC', 'NETO', 1, 'N', N'DIAGNOSTICO (STAC)'),
    (8, 'ST-STAC-AJML', N'Ajustes metrológicos (STAC)', 'ST', 'STAC', 'NETO', 1, 'O', N'AJUSTES METROLOGICOS (STAC)'),
    (9, 'ST-STAC-MPR', N'Mantenimiento preventivo regular (STAC)', 'ST', 'STAC', 'NETO', 1, 'P', N'MNT. PREVENTIVO REGULAR (STAC)'),
    (10, 'ST-STAC-MPA', N'Mantenimiento preventivo avanzado (STAC)', 'ST', 'STAC', 'NETO', 1, 'Q', N'MNT. PREVENTIVO AVANZADO (STAC)'),
    (11, 'ST-STAC-INST', N'Instalación y montaje (STAC)', 'ST', 'STAC', 'NETO', 1, 'R', N'INSTALACION Y MONTAJE (STAC)'),
    (12, 'ST-STAC-VINT', N'Verificaciones internas (STAC)', 'ST', 'STAC', 'NETO', 1, 'S', N'VERIFICIONES INTERNAS (STAC)'),
    (13, 'ST-GRUAS', N'Manipulación de patrones (grúas)', 'ST', 'GRUAS', 'NETO', 1, 'T', N'MANIPULACION DE PATRONES (GRUAS)'),
    (14, 'ST-LOG', N'Logística (ST)', 'ST', 'LOGISTICA', 'LOGISTICA', 0, 'U', N'LOGISTICA (ST)'),
    (15, 'ST-IBMETRO', N'Servicios IBMETRO (ST)', 'ST', 'IBMETRO', 'TERCERO', 1, 'V', N'SERVICIOS IBMETRO'),
    (16, 'ST-COMPRAS-VENTA', N'Compras internas para venta (ST)', 'ST', 'COMPRAS', 'PRODUCTO', 1, 'W', N'COMPRAS INTERNAS VENTAS (ST)'),
    (17, 'ST-COMPRAS-CLIENTE', N'Otras compras solicitadas por el cliente (ST)', 'ST', 'COMPRAS', 'TERCERO', 1, 'X', N'OTRAS COMPRAS SOLICITADAS POR EL CLIENTE'),
    (18, 'ST-OTROS', N'Otros (ST)', 'ST', 'OTROS', 'NETO', 0, 'Y', N'OTROS (ST)'),
    (19, 'CAL-BLZ', N'Calibración de balanzas', 'CAL', 'BALANZAS', 'NETO', 0, 'Z', N'CALIBRACION DE BALANZAS'),
    (20, 'CAL-PSP', N'Calibración de pesas', 'CAL', 'PESAS', 'NETO', 0, 'AA', N'CALIBRACION DE PESAS'),
    (21, 'CAL-ASESORIA', N'Asesoría', 'CAL', 'ASESORIA', 'NETO', 0, 'AB', N'ASESORIA'),
    (22, 'CAL-LOG', N'Logística (CAL)', 'CAL', 'LOGISTICA', 'LOGISTICA', 0, 'AC', N'LOGISTICA (CAL)'),
    (23, 'CAL-COMPRAS-CLIENTE', N'Otras compras solicitadas por el cliente (CAL)', 'CAL', 'COMPRAS', 'TERCERO', 0, 'AD', N'OTRAS COMPRAS SOLICITADAS POR EL CLIENTE2'),
    (24, 'CAL-OTROS', N'Otros (CAL)', 'CAL', 'OTROS', 'NETO', 0, 'AE', N'OTROS (CAL)'),
    (25, 'VENT-PESAS-M', N'Pesas clase M', 'VENT', 'PESAS', 'PRODUCTO', 1, 'AF', N'PESAS CLASE M'),
    (26, 'VENT-PESAS-F', N'Pesas clase F', 'VENT', 'PESAS', 'PRODUCTO', 1, 'AG', N'PESAS CLASE F'),
    (27, 'VENT-PESAS-E', N'Pesas clase E', 'VENT', 'PESAS', 'PRODUCTO', 1, 'AH', N'PESAS CLASE E'),
    (28, 'VENT-PESAS-ACC', N'Otros componentes y accesorios (pesas)', 'VENT', 'PESAS', 'PRODUCTO', 1, 'AI', N'OTROS COMPONENTES ACCESORIOS (PESAS)'),
    (29, 'VENT-LAB-ANALITICA', N'Balanza analítica (≥ 1 mg)', 'VENT', 'LABORATORIO', 'PRODUCTO', 1, 'AJ', N'BLZ ANALITICA (>= 1 MG )'),
    (30, 'VENT-LAB-PRECISION', N'Balanza de precisión (≥ 0,1 g)', 'VENT', 'LABORATORIO', 'PRODUCTO', 1, 'AK', N'BLZ PRECISION (>= 0.1 G)'),
    (31, 'VENT-LAB-ACC', N'Otros componentes (laboratorio)', 'VENT', 'LABORATORIO', 'PRODUCTO', 1, 'AL', N'OTROS COMPONENTES (LABORATORIO)'),
    (32, 'VENT-IND-MESA', N'Balanza de mesa (≥ 0,5 g)', 'VENT', 'INDUSTRIAL', 'PRODUCTO', 1, 'AM', N'BLZ MESA (>= 0,5 G )'),
    (33, 'VENT-IND-BANCO', N'Balanza de banco (≥ 10 g)', 'VENT', 'INDUSTRIAL', 'PRODUCTO', 1, 'AN', N'BLZ BANCO (>= 10 G )'),
    (34, 'VENT-IND-PISO', N'Balanza de piso (≥ 100 g)', 'VENT', 'INDUSTRIAL', 'PRODUCTO', 1, 'AO', N'BLZ PISO (>= 100 G )'),
    (35, 'VENT-IND-OTRA', N'Otro tipo de balanza', 'VENT', 'INDUSTRIAL', 'PRODUCTO', 1, 'AP', N'OTRO TIPO DE BLZ'),
    (36, 'VENT-IND-TANQUES', N'Tanques y silos', 'VENT', 'INDUSTRIAL', 'PRODUCTO', 1, 'AQ', N'TANQUES Y SILOS'),
    (37, 'VENT-IND-ACC', N'Otros componentes y accesorios (industrial)', 'VENT', 'INDUSTRIAL', 'PRODUCTO', 1, 'AR', N'OTROS COMPONENTES ACCESORIOS (INDUSTRIAL)'),
    (38, 'VENT-BASCULA', N'Báscula de camiones y componentes', 'VENT', 'BASCULAS', 'PRODUCTO', 1, 'AS', N'BASCULA DE CAMIONES Y COMPONENTES'),
    (39, 'VENT-SOFTWARE', N'Software', 'VENT', 'SOFTWARE', 'PRODUCTO', 1, 'AT', N'SOFTWARE'),
    (40, 'VENT-OBRA-CIVIL', N'Obra civil y relacionados', 'VENT', 'OBRA_CIVIL', 'NETO', 1, 'AU', N'OBRA CIVIL Y RELACIONADOS'),
    (41, 'VENT-LOG-PERSONAL', N'Logística de personal', 'VENT', 'LOGISTICA', 'LOGISTICA', 0, 'AV', N'LOGISTICA DE PERSONAL'),
    (42, 'VENT-LOG-EQUIPOS', N'Logística de equipos', 'VENT', 'LOGISTICA', 'LOGISTICA', 0, 'AW', N'LOGISTICA DE EQUIPOS'),
    (43, 'VENT-APORTE-CAL-BLZ', N'Compra interna (calibración de balanzas)', 'VENT', 'APORTE', 'NETO', 1, 'AX', N'COMPRA INTERNA (CAL BLZ)'),
    (44, 'VENT-APORTE-CAL-PSP', N'Compra interna (calibración de pesas)', 'VENT', 'APORTE', 'NETO', 1, 'AY', N'COMPRA INTERNA (CAL PSP)'),
    (45, 'VENT-APORTE-LOG-CAL', N'Compra interna (logística de calibración)', 'VENT', 'APORTE', 'NETO', 0, 'AZ', N'COMPRA INTERNA (LOG CAL)'),
    (46, 'VENT-APORTE-INST-ST', N'Compra interna (instalación ST)', 'VENT', 'APORTE', 'NETO', 1, 'BA', N'COMPRA INTERNA (INST ST)'),
    (47, 'VENT-APORTE-LOG-ST', N'Compra interna (logística ST)', 'VENT', 'APORTE', 'NETO', 0, 'BB', N'COMPRA INTERNA ( LOG ST)'),
    (48, 'VENT-IBMETRO', N'Servicios IBMETRO por venta', 'VENT', 'IBMETRO', 'TERCERO', 1, 'BC', N'SERVICIOS IBMETRO POR VENTA'),
    (49, 'VENT-COMPRAS-CLIENTE', N'Otras compras solicitadas por el cliente (venta)', 'VENT', 'COMPRAS', 'TERCERO', 1, 'BD', N'OTRAS COMPRAS SOLICITADAS POR EL CLIENTE3'),
    (50, 'VENT-GRUAS', N'Grúas por venta', 'VENT', 'GRUAS', 'NETO', 1, 'BE', N'GRUAS POR VENT'),
    (51, 'VENT-ALQUILER', N'Otros (venta) y alquiler', 'VENT', 'ALQUILER', 'NETO', 1, 'BF', N'OTROS (VENT) ALQUILER');

INSERT INTO dbo.COM_CATEGORIAS (id, codigo, nombre, area, subarea, regla_margen, comisiona, excel_columna, excel_encabezado, orden)
SELECT c.id, c.codigo, c.nombre, c.area, c.subarea, c.regla_margen, c.comisiona, c.excel_columna, c.excel_encabezado, c.id
FROM @categorias c
WHERE NOT EXISTS (SELECT 1 FROM dbo.COM_CATEGORIAS x WHERE x.id = c.id OR x.codigo = c.codigo);

IF OBJECT_ID('dbo.COM_FACTURAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_FACTURAS (
    id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_FACTURAS PRIMARY KEY,
    gestion           SMALLINT       NOT NULL,
    numero            INT            NOT NULL CONSTRAINT CK_COM_FACTURAS_NUMERO CHECK (numero > 0),
    fecha_emision     DATE           NOT NULL,
    tipo              VARCHAR(10)    NOT NULL CONSTRAINT CK_COM_FACTURAS_TIPO CHECK (tipo IN ('SERVICIO', 'VENTA')),
    -- Cliente de DataMET (DATA_CLIENTES.codigo_cliente) y los datos tal como
    -- salen en la factura.
    cliente_codigo    NVARCHAR(20)   NULL,
    razon_social      NVARCHAR(255)  NOT NULL,
    nit               NVARCHAR(20)   NULL,
    monto             DECIMAL(14, 2) NOT NULL CONSTRAINT CK_COM_FACTURAS_MONTO CHECK (monto >= 0),
    observacion       NVARCHAR(1000) NULL,
    estado            VARCHAR(10)    NOT NULL CONSTRAINT DF_COM_FACTURAS_ESTADO DEFAULT 'VIGENTE'
                                     CONSTRAINT CK_COM_FACTURAS_ESTADO CHECK (estado IN ('VIGENTE', 'ANULADA')),
    anulada_motivo    NVARCHAR(300)  NULL,
    anulada_por       NVARCHAR(50)   NULL,
    anulada_nombre    NVARCHAR(120)  NULL,
    anulada_en        DATETIME2      NULL,
    origen            VARCHAR(10)    NOT NULL CONSTRAINT CK_COM_FACTURAS_ORIGEN CHECK (origen IN ('MANUAL', 'EXCEL', 'SIN')),
    origen_ref        NVARCHAR(120)  NULL,
    creado_por        NVARCHAR(50)   NOT NULL,
    creado_nombre     NVARCHAR(120)  NULL,
    creado_en         DATETIME2      NOT NULL CONSTRAINT DF_COM_FACTURAS_CREADO DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_COM_FACTURAS_NUMERO UNIQUE (gestion, numero),
    CONSTRAINT CK_COM_FACTURAS_ANULACION CHECK (
      (estado = 'VIGENTE' AND anulada_en IS NULL AND anulada_por IS NULL AND anulada_motivo IS NULL)
      OR (estado = 'ANULADA' AND anulada_en IS NOT NULL AND anulada_por IS NOT NULL AND anulada_motivo IS NOT NULL)
    )
  );
  CREATE INDEX IX_COM_FACTURAS_FECHA ON dbo.COM_FACTURAS (fecha_emision DESC, numero DESC);
  CREATE INDEX IX_COM_FACTURAS_CLIENTE ON dbo.COM_FACTURAS (cliente_codigo);
END;

IF OBJECT_ID('dbo.COM_FACTURA_LINEAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_FACTURA_LINEAS (
    id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_FACTURA_LINEAS PRIMARY KEY,
    factura_id    INT            NOT NULL CONSTRAINT FK_COM_FACTURA_LINEAS_FACTURA REFERENCES dbo.COM_FACTURAS (id),
    categoria_id  INT            NOT NULL CONSTRAINT FK_COM_FACTURA_LINEAS_CATEGORIA REFERENCES dbo.COM_CATEGORIAS (id),
    orden         INT            NOT NULL,
    monto         DECIMAL(14, 2) NOT NULL CONSTRAINT CK_COM_FACTURA_LINEAS_MONTO CHECK (monto > 0),
    -- Equipos atendidos o vendidos (balanzas, pesas).
    cantidad      INT            NULL CONSTRAINT CK_COM_FACTURA_LINEAS_CANTIDAD CHECK (cantidad >= 0),
    -- Regional que atiende la línea (la factura 433 del Excel se partió en dos filas).
    regional      VARCHAR(3)     NULL CONSTRAINT CK_COM_FACTURA_LINEAS_REGIONAL CHECK (regional IN ('LPZ', 'SCZ')),
    -- Costo de almacén (producto) o costo real del tercero (IBMETRO, compras).
    costo         DECIMAL(14, 2) NULL CONSTRAINT CK_COM_FACTURA_LINEAS_COSTO CHECK (costo >= 0),
    nota_salida   NVARCHAR(60)   NULL
  );
  CREATE INDEX IX_COM_FACTURA_LINEAS_FACTURA ON dbo.COM_FACTURA_LINEAS (factura_id, orden);
END;

IF OBJECT_ID('dbo.COM_FACTURA_REFERENCIAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_FACTURA_REFERENCIAS (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_FACTURA_REFERENCIAS PRIMARY KEY,
    factura_id  INT           NOT NULL CONSTRAINT FK_COM_FACTURA_REFERENCIAS_FACTURA REFERENCES dbo.COM_FACTURAS (id),
    tipo        VARCHAR(20)   NOT NULL CONSTRAINT CK_COM_FACTURA_REFERENCIAS_TIPO CHECK (tipo IN (
                  'COTIZACION', 'COTIZACION_CAL', 'COTIZACION_CAL_VENTA', 'NOTA_SALIDA', 'RIM', 'OTST', 'BITRIX')),
    valor       NVARCHAR(80)  NOT NULL
  );
  CREATE INDEX IX_COM_FACTURA_REFERENCIAS_FACTURA ON dbo.COM_FACTURA_REFERENCIAS (factura_id);
  CREATE INDEX IX_COM_FACTURA_REFERENCIAS_VALOR ON dbo.COM_FACTURA_REFERENCIAS (valor);
END;

IF OBJECT_ID('dbo.COM_FACTURA_PERSONAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_FACTURA_PERSONAS (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_FACTURA_PERSONAS PRIMARY KEY,
    factura_id  INT            NOT NULL CONSTRAINT FK_COM_FACTURA_PERSONAS_FACTURA REFERENCES dbo.COM_FACTURAS (id),
    rol         VARCHAR(12)    NOT NULL CONSTRAINT CK_COM_FACTURA_PERSONAS_ROL CHECK (rol IN (
                  'RESPONSABLE', 'COTIZO', 'COTIZO_CAL', 'EJECUTO_ST', 'APOYO_ST', 'EJECUTO_CAL', 'APOYO_CAL')),
    -- DATA_USERS.id cuando se reconoce a la persona; el nombre va siempre.
    usuario_id  INT            NULL,
    nombre      NVARCHAR(120)  NOT NULL,
    -- Parte que le toca cuando hay dos responsables (50 / 50 u otro reparto).
    porcentaje  DECIMAL(5, 2)  NULL CONSTRAINT CK_COM_FACTURA_PERSONAS_PORCENTAJE CHECK (porcentaje > 0 AND porcentaje <= 100)
  );
  CREATE INDEX IX_COM_FACTURA_PERSONAS_FACTURA ON dbo.COM_FACTURA_PERSONAS (factura_id);
END;

IF OBJECT_ID('dbo.COM_PAGOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_PAGOS (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_PAGOS PRIMARY KEY,
    fecha           DATE           NOT NULL,
    monto           DECIMAL(14, 2) NOT NULL CONSTRAINT CK_COM_PAGOS_MONTO CHECK (monto > 0),
    medio           VARCHAR(15)    NOT NULL CONSTRAINT CK_COM_PAGOS_MEDIO CHECK (medio IN (
                      'DEPOSITO', 'TRANSFERENCIA', 'EFECTIVO', 'QR', 'CHEQUE', 'OTRO')),
    cliente_codigo  NVARCHAR(20)   NULL,
    referencia      NVARCHAR(120)  NULL,
    -- Cómo se verificó: «Extracto oct 2026», «Comprobante en Bitrix24»…
    verificacion    NVARCHAR(120)  NULL,
    observacion     NVARCHAR(1000) NULL,
    estado          VARCHAR(10)    NOT NULL CONSTRAINT DF_COM_PAGOS_ESTADO DEFAULT 'VIGENTE'
                                   CONSTRAINT CK_COM_PAGOS_ESTADO CHECK (estado IN ('VIGENTE', 'ANULADO')),
    anulado_motivo  NVARCHAR(300)  NULL,
    anulado_por     NVARCHAR(50)   NULL,
    anulado_nombre  NVARCHAR(120)  NULL,
    anulado_en      DATETIME2      NULL,
    origen          VARCHAR(10)    NOT NULL CONSTRAINT CK_COM_PAGOS_ORIGEN CHECK (origen IN ('MANUAL', 'EXCEL')),
    origen_ref      NVARCHAR(120)  NULL,
    creado_por      NVARCHAR(50)   NOT NULL,
    creado_nombre   NVARCHAR(120)  NULL,
    creado_en       DATETIME2      NOT NULL CONSTRAINT DF_COM_PAGOS_CREADO DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_COM_PAGOS_ANULACION CHECK (
      (estado = 'VIGENTE' AND anulado_en IS NULL AND anulado_por IS NULL AND anulado_motivo IS NULL)
      OR (estado = 'ANULADO' AND anulado_en IS NOT NULL AND anulado_por IS NOT NULL AND anulado_motivo IS NOT NULL)
    )
  );
  CREATE INDEX IX_COM_PAGOS_FECHA ON dbo.COM_PAGOS (fecha DESC, id DESC);
END;

IF OBJECT_ID('dbo.COM_PAGO_APLICACIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_PAGO_APLICACIONES (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_PAGO_APLICACIONES PRIMARY KEY,
    pago_id     INT            NOT NULL CONSTRAINT FK_COM_PAGO_APLICACIONES_PAGO REFERENCES dbo.COM_PAGOS (id),
    factura_id  INT            NOT NULL CONSTRAINT FK_COM_PAGO_APLICACIONES_FACTURA REFERENCES dbo.COM_FACTURAS (id),
    monto       DECIMAL(14, 2) NOT NULL CONSTRAINT CK_COM_PAGO_APLICACIONES_MONTO CHECK (monto > 0),
    CONSTRAINT UQ_COM_PAGO_APLICACIONES UNIQUE (pago_id, factura_id)
  );
  CREATE INDEX IX_COM_PAGO_APLICACIONES_FACTURA ON dbo.COM_PAGO_APLICACIONES (factura_id);
END;

IF OBJECT_ID('dbo.COM_CLIENTES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_CLIENTES (
    cliente_codigo  NVARCHAR(20)   NOT NULL CONSTRAINT PK_COM_CLIENTES PRIMARY KEY,
    plazo_dias      INT            NULL CONSTRAINT CK_COM_CLIENTES_PLAZO CHECK (plazo_dias BETWEEN 0 AND 365),
    -- Correos de recepción de facturas, separados por punto y coma.
    correos         NVARCHAR(500)  NULL,
    -- Ventana de recepción: «del 1 al 22 de cada mes», «hasta el 25».
    recepcion       NVARCHAR(200)  NULL,
    observacion     NVARCHAR(500)  NULL,
    actualizado_por NVARCHAR(50)   NOT NULL,
    actualizado_en  DATETIME2      NOT NULL CONSTRAINT DF_COM_CLIENTES_ACTUALIZADO DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID('dbo.COM_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.COM_HISTORIAL (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_COM_HISTORIAL PRIMARY KEY,
    entidad     VARCHAR(10)    NOT NULL CONSTRAINT CK_COM_HISTORIAL_ENTIDAD CHECK (entidad IN ('FACTURA', 'PAGO', 'CLIENTE')),
    entidad_id  NVARCHAR(20)   NOT NULL,
    accion      VARCHAR(15)    NOT NULL CONSTRAINT CK_COM_HISTORIAL_ACCION CHECK (accion IN ('REGISTRO', 'IMPORTACION', 'ANULACION', 'ACTUALIZACION')),
    -- Qué se registró o cambió (JSON).
    detalle     NVARCHAR(MAX)  NULL,
    motivo      NVARCHAR(300)  NULL,
    usuario     NVARCHAR(50)   NOT NULL,
    nombre      NVARCHAR(120)  NULL,
    fecha       DATETIME2      NOT NULL CONSTRAINT DF_COM_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_COM_HISTORIAL_ENTIDAD ON dbo.COM_HISTORIAL (entidad, entidad_id, id);
END;

-- El historial solo crece.
IF OBJECT_ID('dbo.TR_COM_HISTORIAL_SOLO_AGREGAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_HISTORIAL_SOLO_AGREGAR
    ON dbo.COM_HISTORIAL INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51034, N''El historial de Comercial no se modifica ni se borra.'', 1;
    END');

-- Facturas y pagos no se borran; de una factura o un pago vigente solo se
-- registra la anulación, una vez.
IF OBJECT_ID('dbo.TR_COM_FACTURAS_SIN_BORRAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_FACTURAS_SIN_BORRAR
    ON dbo.COM_FACTURAS INSTEAD OF DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51034, N''Las facturas no se borran: se anulan con su motivo.'', 1;
    END');

IF OBJECT_ID('dbo.TR_COM_FACTURAS_SOLO_ANULAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_FACTURAS_SOLO_ANULAR
    ON dbo.COM_FACTURAS AFTER UPDATE
    AS
    BEGIN
      SET NOCOUNT ON;
      IF UPDATE(gestion) OR UPDATE(numero) OR UPDATE(fecha_emision) OR UPDATE(tipo) OR UPDATE(cliente_codigo)
        OR UPDATE(razon_social) OR UPDATE(nit) OR UPDATE(monto) OR UPDATE(observacion) OR UPDATE(origen)
        OR UPDATE(origen_ref) OR UPDATE(creado_por) OR UPDATE(creado_nombre) OR UPDATE(creado_en)
        OR EXISTS (SELECT 1 FROM deleted WHERE estado = ''ANULADA'')
        THROW 51034, N''De una factura solo se registra su anulación, una vez.'', 1;
    END');

IF OBJECT_ID('dbo.TR_COM_PAGOS_SIN_BORRAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_PAGOS_SIN_BORRAR
    ON dbo.COM_PAGOS INSTEAD OF DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51034, N''Los pagos no se borran: se anulan con su motivo.'', 1;
    END');

IF OBJECT_ID('dbo.TR_COM_PAGOS_SOLO_ANULAR', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_PAGOS_SOLO_ANULAR
    ON dbo.COM_PAGOS AFTER UPDATE
    AS
    BEGIN
      SET NOCOUNT ON;
      IF UPDATE(fecha) OR UPDATE(monto) OR UPDATE(medio) OR UPDATE(cliente_codigo) OR UPDATE(referencia)
        OR UPDATE(verificacion) OR UPDATE(observacion) OR UPDATE(origen) OR UPDATE(origen_ref)
        OR UPDATE(creado_por) OR UPDATE(creado_nombre) OR UPDATE(creado_en)
        OR EXISTS (SELECT 1 FROM deleted WHERE estado = ''ANULADO'')
        THROW 51034, N''De un pago solo se registra su anulación, una vez.'', 1;
    END');

-- Líneas, referencias, personas y aplicaciones se escriben una vez, con su
-- factura o su pago: una corrección es anular y volver a registrar.
IF OBJECT_ID('dbo.TR_COM_FACTURA_LINEAS_FIJAS', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_FACTURA_LINEAS_FIJAS
    ON dbo.COM_FACTURA_LINEAS INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51034, N''Las líneas de una factura no se modifican ni se borran.'', 1;
    END');

IF OBJECT_ID('dbo.TR_COM_FACTURA_REFERENCIAS_FIJAS', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_FACTURA_REFERENCIAS_FIJAS
    ON dbo.COM_FACTURA_REFERENCIAS INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51034, N''Las referencias de una factura no se modifican ni se borran.'', 1;
    END');

IF OBJECT_ID('dbo.TR_COM_FACTURA_PERSONAS_FIJAS', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_FACTURA_PERSONAS_FIJAS
    ON dbo.COM_FACTURA_PERSONAS INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51034, N''Las personas de una factura no se modifican ni se borran.'', 1;
    END');

IF OBJECT_ID('dbo.TR_COM_PAGO_APLICACIONES_FIJAS', 'TR') IS NULL
  EXEC(N'CREATE TRIGGER dbo.TR_COM_PAGO_APLICACIONES_FIJAS
    ON dbo.COM_PAGO_APLICACIONES INSTEAD OF UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      THROW 51034, N''Las aplicaciones de un pago no se modifican ni se borran: se anula el pago.'', 1;
    END');
