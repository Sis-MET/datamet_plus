-- ========================================================================
-- MIGRACIÓN 020: EMISIÓN DE LOS CERTIFICADOS DE CALIBRACIÓN
-- ========================================================================
-- Fase 5 (docs/calibracion-plan-implementacion.md). Después de aprobar el
-- registro, el jefe de Calibración lo autoriza: se fija el número y se guarda
-- congelado el contenido del certificado (CAL_EMISIONES). El PDF autorizado
-- se firma con firma digital fuera de DataMET+ y se sube: queda archivado en
-- la carpeta del área (CAL_DOCUMENTOS_DIR, PC-EMIN\<año>) con su huella
-- SHA-256, y la fecha de emisión es la de la firma (NB/ISO/IEC 17025, 7.8).
--
-- Reemisión (7.8.8): se abre una revisión con su motivo; el registro vuelve a
-- borrador y la emisión siguiente (02, 03…) repite revisión, autorización y
-- firma. La emitida sigue vigente hasta que se emite la nueva, que la
-- reemplaza; ninguna se borra.
--
-- Estados del registro: … → APROBADO → AUTORIZADO → EMITIDO.
-- ========================================================================

SET NOCOUNT ON;

-- Estados y acciones nuevos del registro.
IF COL_LENGTH('dbo.CAL_REGISTROS', 'revision_motivo') IS NULL
  ALTER TABLE dbo.CAL_REGISTROS ADD revision_motivo NVARCHAR(500) NULL;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_REGISTROS_ESTADO')
  ALTER TABLE dbo.CAL_REGISTROS DROP CONSTRAINT CK_CAL_REGISTROS_ESTADO;
ALTER TABLE dbo.CAL_REGISTROS ADD CONSTRAINT CK_CAL_REGISTROS_ESTADO
  CHECK (estado IN ('BORRADOR', 'EN_REVISION', 'OBSERVADO', 'APROBADO', 'AUTORIZADO', 'EMITIDO'));

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_REGISTROS_REVISION')
  ALTER TABLE dbo.CAL_REGISTROS DROP CONSTRAINT CK_CAL_REGISTROS_REVISION;
ALTER TABLE dbo.CAL_REGISTROS ADD CONSTRAINT CK_CAL_REGISTROS_REVISION CHECK (
  estado NOT IN ('APROBADO', 'OBSERVADO', 'AUTORIZADO', 'EMITIDO') OR (revisado_por IS NOT NULL AND revisado_en IS NOT NULL)
);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_REGISTROS_APROBADO')
  ALTER TABLE dbo.CAL_REGISTROS DROP CONSTRAINT CK_CAL_REGISTROS_APROBADO;
ALTER TABLE dbo.CAL_REGISTROS ADD CONSTRAINT CK_CAL_REGISTROS_APROBADO
  CHECK (estado NOT IN ('APROBADO', 'AUTORIZADO', 'EMITIDO') OR resultado IS NOT NULL);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_REGISTROS_HISTORIAL_ACCION')
  ALTER TABLE dbo.CAL_REGISTROS_HISTORIAL DROP CONSTRAINT CK_CAL_REGISTROS_HISTORIAL_ACCION;
ALTER TABLE dbo.CAL_REGISTROS_HISTORIAL ADD CONSTRAINT CK_CAL_REGISTROS_HISTORIAL_ACCION CHECK (accion IN (
  'CREACION', 'EDICION', 'ENVIO', 'RETIRO', 'APROBACION', 'OBSERVACION', 'REAPERTURA',
  'AUTORIZACION', 'ANULACION', 'EMISION', 'REVISION'
));

IF OBJECT_ID('dbo.CAL_EMISIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_EMISIONES (
    id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_EMISIONES PRIMARY KEY,
    registro_id        INT            NOT NULL CONSTRAINT FK_CAL_EMISIONES_Registro REFERENCES dbo.CAL_REGISTROS (id),
    numero             NVARCHAR(30)   NOT NULL,
    -- 1 en la primera emisión; 2, 3… en las reemisiones.
    emision            INT            NOT NULL,
    -- AUTORIZADO → EMITIDO → REEMPLAZADO; ANULADO si se anula la autorización antes de firmar.
    estado             VARCHAR(12)    NOT NULL,
    -- Contenido del certificado tal como se autorizó (JSON) y su huella SHA-256.
    contenido          NVARCHAR(MAX)  NOT NULL,
    contenido_huella   VARCHAR(64)    NOT NULL,
    archivo_nombre     NVARCHAR(220)  NOT NULL,
    -- Motivo de la revisión (emisiones 2 en adelante).
    motivo             NVARCHAR(500)  NULL,
    autorizado_por     NVARCHAR(50)   NOT NULL,
    autorizado_nombre  NVARCHAR(120)  NULL,
    autorizado_en      DATETIME2      NOT NULL CONSTRAINT DF_CAL_EMISIONES_AUTORIZADO DEFAULT SYSUTCDATETIME(),
    -- PDF firmado: fecha de la firma (la de emisión), dónde quedó y su huella.
    firma_fecha        DATE           NULL,
    firma_detectada    BIT            NULL,
    carpeta            NVARCHAR(400)  NULL,
    raiz_huella        VARCHAR(64)    NULL,
    pdf_huella         VARCHAR(64)    NULL,
    pdf_tamano         INT            NULL,
    emitido_por        NVARCHAR(50)   NULL,
    emitido_en         DATETIME2      NULL,
    anulado_por        NVARCHAR(50)   NULL,
    anulado_en         DATETIME2      NULL,
    anulado_motivo     NVARCHAR(500)  NULL,
    CONSTRAINT CK_CAL_EMISIONES_ESTADO CHECK (estado IN ('AUTORIZADO', 'EMITIDO', 'REEMPLAZADO', 'ANULADO')),
    CONSTRAINT CK_CAL_EMISIONES_CONTENIDO CHECK (ISJSON(contenido) = 1),
    CONSTRAINT CK_CAL_EMISIONES_EMISION CHECK (emision >= 1),
    CONSTRAINT CK_CAL_EMISIONES_EMITIDO CHECK (
      estado NOT IN ('EMITIDO', 'REEMPLAZADO')
      OR (firma_fecha IS NOT NULL AND pdf_huella IS NOT NULL AND emitido_por IS NOT NULL AND emitido_en IS NOT NULL)
    ),
    CONSTRAINT CK_CAL_EMISIONES_ANULADO CHECK (
      estado <> 'ANULADO' OR (anulado_por IS NOT NULL AND anulado_en IS NOT NULL AND anulado_motivo IS NOT NULL)
    )
  );
END;

-- Una emisión de cada número por registro y por certificado. Las anuladas no
-- cuentan: una autorización anulada antes de firmar no llegó al cliente, así
-- que la siguiente vuelve a usar su número de emisión.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CAL_EMISIONES_Registro')
  EXEC(N'CREATE UNIQUE INDEX UX_CAL_EMISIONES_Registro ON dbo.CAL_EMISIONES (registro_id, emision) WHERE estado <> ''ANULADO''');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CAL_EMISIONES_Numero')
  EXEC(N'CREATE UNIQUE INDEX UX_CAL_EMISIONES_Numero ON dbo.CAL_EMISIONES (numero, emision) WHERE estado <> ''ANULADO''');

-- Control de cambios (7.11.2).
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: certificado de calibración, autorización, firma y reemisión';
  IF NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE titulo = @titulo)
  BEGIN
    DECLARE @anio CHAR(4) = CONVERT(char(4), YEAR(DATEADD(hour, -4, SYSUTCDATETIME())));
    DECLARE @ultimo INT;
    SELECT @ultimo = ISNULL(MAX(CAST(RIGHT(codigo, 3) AS INT)), 0)
    FROM dbo.APP_CAMBIOS WITH (UPDLOCK, HOLDLOCK)
    WHERE codigo LIKE 'CC-' + @anio + '-[0-9][0-9][0-9]';

    INSERT INTO dbo.APP_CAMBIOS
      (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
       estado, a_posteriori, registrado_por)
    VALUES (
      'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.15.0', @titulo, 'MEJORA', N'Calibración',
      N'DataMET+ arma el certificado de calibración de balanzas con el diseño de la hoja CERT del libro F-VMET-02-7.2 y lo que pide la 7.8 (k por punto, ajuste y errores antes del ajuste, clase con su origen, datos del cliente, regla de decisión). El jefe de Calibración autoriza el registro aprobado (se fija el número y se congela el contenido), firma el PDF con su firma digital fuera de DataMET+ y lo sube; queda archivado con su huella y la fecha de la firma. Las reemisiones abren una revisión con motivo y repiten revisión, autorización y firma.',
      N'Crea CAL_EMISIONES y amplía los estados de CAL_REGISTROS (migración 020). Requiere CAL_DOCUMENTOS_DIR (carpeta PC-EMIN) con permisos de lectura y escritura para el backend. No sobrescribe ni borra PDF; las emisiones anteriores se conservan (7.8.8, 8.4).',
      N'Migración 020; calibration.certificado.js; calibration.emision.js; docs/calibracion-plan-implementacion.md (fase 5).',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 020'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 020', N'migración 020');
  END;
END;
