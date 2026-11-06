-- ========================================================================
-- MIGRACIÓN 016: VALORES DE LOS CERTIFICADOS DE LOS PATRONES
-- ========================================================================
-- Fase 1 de los certificados de calibración en DataMET+
-- (docs/calibracion-plan-implementacion.md). El cálculo de un certificado
-- necesita lo que hoy el libro F-VMET-02-7.2 copia de Access (hojas
-- EQUI_VIGENTE y VALORES): las piezas de cada juego de pesas y, por
-- certificado, la corrección, la U y el k de cada pieza; y los puntos
-- calibrados de los termohigrobarómetros.
--
-- CAL_PATRONES           : tipo de patrón de un equipo (juego de pesas o
--                          instrumento de condiciones ambientales) y clase
--                          OIML R111 del juego.
-- CAL_PATRON_PIEZAS      : piezas de cada juego con su densidad. No se
--                          borran: se desactivan.
-- CAL_CERT_TRANSCRIPCION : transcripción de un certificado de
--                          CAL_CERTIFICADOS: condiciones ambientales de su
--                          calibración (densidad del aire ρa1, EURAMET
--                          cg-18 7.1.2-5b), quién y cuándo la transcribió.
-- CAL_CERT_VALORES       : corrección, U y k de cada pieza según un
--                          certificado.
-- CAL_CERT_PUNTOS        : corrección, U y k de cada punto calibrado de
--                          temperatura, humedad y presión.
--
-- La verificación de la transcripción es la revisión que ya tiene cada
-- certificado (revisado_por en CAL_CERTIFICADOS, migración 006): cambiar los
-- valores la deja pendiente y quien los transcribió no puede revisarlos.
--
-- Agrega las acciones PATRON, PIEZAS y VALORES al historial del equipo y
-- registra el cambio en Control de cambios. Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.CAL_PATRONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_PATRONES (
    -- DATA_EQUIPOS_CAL.id (esa tabla no tiene clave primaria).
    equipo_id        INT           NOT NULL CONSTRAINT PK_CAL_PATRONES PRIMARY KEY,
    tipo             VARCHAR(10)   NOT NULL,
    clase            VARCHAR(5)    NULL,
    actualizado_por  NVARCHAR(50)  NULL,
    actualizado_en   DATETIME2     NOT NULL CONSTRAINT DF_CAL_PATRONES_ACTUALIZADO DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_PATRONES_TIPO CHECK (tipo IN ('PESAS', 'AMBIENTE')),
    CONSTRAINT CK_CAL_PATRONES_CLASE CHECK (clase IS NULL OR clase IN ('E1', 'E2', 'F1', 'F2', 'M1', 'M1-2', 'M2', 'M2-3', 'M3')),
    CONSTRAINT CK_CAL_PATRONES_CLASE_PESAS CHECK (tipo = 'PESAS' OR clase IS NULL)
  );
END;

IF OBJECT_ID('dbo.CAL_PATRON_PIEZAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_PATRON_PIEZAS (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_PATRON_PIEZAS PRIMARY KEY,
    equipo_id        INT            NOT NULL,
    -- Valor nominal en mg: de 1 mg a 5 000 kg (OIML R111, 1.2).
    nominal_mg       DECIMAL(18, 6) NOT NULL,
    -- Distingue piezas del mismo valor: '' la principal, '*' y '**' los
    -- duplicados (R111, 13.1.2), o el número o letra que lleve la pieza.
    identificacion   NVARCHAR(20)   NOT NULL CONSTRAINT DF_CAL_PATRON_PIEZAS_IDENT DEFAULT N'',
    material         NVARCHAR(40)   NULL,
    -- Densidad en kg/m³ con su incertidumbre expandida y su k.
    densidad         DECIMAL(9, 2)  NULL,
    densidad_u       DECIMAL(9, 2)  NULL,
    densidad_k       DECIMAL(5, 2)  NULL,
    -- MEDIDA: del certificado o de una medición; SUPUESTA: por material (R111, Tabla B.7).
    densidad_origen  VARCHAR(10)    NULL,
    activa           BIT            NOT NULL CONSTRAINT DF_CAL_PATRON_PIEZAS_ACTIVA DEFAULT 1,
    orden            INT            NOT NULL CONSTRAINT DF_CAL_PATRON_PIEZAS_ORDEN DEFAULT 0,
    registrado_por   NVARCHAR(50)   NULL,
    registrado_en    DATETIME2      NOT NULL CONSTRAINT DF_CAL_PATRON_PIEZAS_REGISTRADO DEFAULT SYSUTCDATETIME(),
    actualizado_por  NVARCHAR(50)   NULL,
    actualizado_en   DATETIME2      NULL,
    CONSTRAINT UQ_CAL_PATRON_PIEZAS_Pieza UNIQUE (equipo_id, nominal_mg, identificacion),
    CONSTRAINT CK_CAL_PATRON_PIEZAS_NOMINAL CHECK (nominal_mg > 0 AND nominal_mg <= 5000000000),
    CONSTRAINT CK_CAL_PATRON_PIEZAS_DENSIDAD CHECK (densidad IS NULL OR densidad > 0),
    CONSTRAINT CK_CAL_PATRON_PIEZAS_DENSIDAD_U CHECK (densidad_u IS NULL OR densidad_u >= 0),
    CONSTRAINT CK_CAL_PATRON_PIEZAS_DENSIDAD_K CHECK (densidad_k IS NULL OR densidad_k > 0),
    CONSTRAINT CK_CAL_PATRON_PIEZAS_ORIGEN CHECK (densidad_origen IS NULL OR densidad_origen IN ('MEDIDA', 'SUPUESTA'))
  );
END;

IF OBJECT_ID('dbo.CAL_CERT_TRANSCRIPCION', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_CERT_TRANSCRIPCION (
    certificado_id   INT            NOT NULL CONSTRAINT PK_CAL_CERT_TRANSCRIPCION PRIMARY KEY
                                    CONSTRAINT FK_CAL_CERT_TRANSCRIPCION_Certificado REFERENCES dbo.CAL_CERTIFICADOS (id),
    -- Condiciones ambientales durante la calibración del juego de pesas.
    temperatura      DECIMAL(6, 2)  NULL,
    humedad          DECIMAL(6, 2)  NULL,
    presion          DECIMAL(8, 2)  NULL,
    observaciones    NVARCHAR(300)  NULL,
    transcrito_por   NVARCHAR(50)   NULL,
    transcrito_en    DATETIME2      NOT NULL CONSTRAINT DF_CAL_CERT_TRANSCRIPCION_EN DEFAULT SYSUTCDATETIME(),
    -- Evita que dos personas guarden a la vez sobre la misma transcripción.
    version          INT            NOT NULL CONSTRAINT DF_CAL_CERT_TRANSCRIPCION_VERSION DEFAULT 1,
    CONSTRAINT CK_CAL_CERT_TRANSCRIPCION_HUMEDAD CHECK (humedad IS NULL OR (humedad >= 0 AND humedad <= 100)),
    CONSTRAINT CK_CAL_CERT_TRANSCRIPCION_PRESION CHECK (presion IS NULL OR (presion > 300 AND presion < 1200))
  );
END;

IF OBJECT_ID('dbo.CAL_CERT_VALORES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_CERT_VALORES (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_CERT_VALORES PRIMARY KEY,
    certificado_id   INT            NOT NULL CONSTRAINT FK_CAL_CERT_VALORES_Certificado REFERENCES dbo.CAL_CERTIFICADOS (id),
    pieza_id         INT            NOT NULL CONSTRAINT FK_CAL_CERT_VALORES_Pieza REFERENCES dbo.CAL_PATRON_PIEZAS (id),
    -- Número del documento cuando el certificado del juego reúne varios
    -- (por ejemplo, uno por pieza).
    documento        NVARCHAR(40)   NULL,
    -- Corrección al valor nominal: masa convencional − nominal, en mg.
    correccion_mg    DECIMAL(18, 6) NOT NULL,
    u_mg             DECIMAL(18, 6) NOT NULL,
    k                DECIMAL(5, 2)  NOT NULL,
    -- Lo que declara el certificado sobre la clase (apta / no apta), si lo declara.
    conforme         BIT            NULL,
    CONSTRAINT UQ_CAL_CERT_VALORES_Pieza UNIQUE (certificado_id, pieza_id),
    CONSTRAINT CK_CAL_CERT_VALORES_U CHECK (u_mg >= 0),
    CONSTRAINT CK_CAL_CERT_VALORES_K CHECK (k > 0)
  );
END;

IF OBJECT_ID('dbo.CAL_CERT_PUNTOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_CERT_PUNTOS (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_CERT_PUNTOS PRIMARY KEY,
    certificado_id   INT            NOT NULL CONSTRAINT FK_CAL_CERT_PUNTOS_Certificado REFERENCES dbo.CAL_CERTIFICADOS (id),
    -- T en °C, HR en %, P en hPa.
    magnitud         VARCHAR(2)     NOT NULL,
    documento        NVARCHAR(40)   NULL,
    punto            DECIMAL(12, 4) NOT NULL,
    correccion       DECIMAL(12, 4) NOT NULL,
    u                DECIMAL(12, 4) NOT NULL,
    k                DECIMAL(5, 2)  NOT NULL,
    CONSTRAINT UQ_CAL_CERT_PUNTOS_Punto UNIQUE (certificado_id, magnitud, punto),
    CONSTRAINT CK_CAL_CERT_PUNTOS_MAGNITUD CHECK (magnitud IN ('T', 'HR', 'P')),
    CONSTRAINT CK_CAL_CERT_PUNTOS_U CHECK (u >= 0),
    CONSTRAINT CK_CAL_CERT_PUNTOS_K CHECK (k > 0)
  );
END;

-- Dinámico: las tablas recién creadas no existen al compilar este lote.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.CAL_PATRON_PIEZAS') AND name = 'IX_CAL_PATRON_PIEZAS_Equipo')
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_PATRON_PIEZAS_Equipo ON dbo.CAL_PATRON_PIEZAS (equipo_id, activa) INCLUDE (nominal_mg, identificacion);');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.CAL_CERT_VALORES') AND name = 'IX_CAL_CERT_VALORES_Pieza')
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_CERT_VALORES_Pieza ON dbo.CAL_CERT_VALORES (pieza_id);');

-- Las acciones nuevas del historial del equipo.
IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = 'CK_CAL_EQUIPOS_HISTORIAL_ACCION' AND definition NOT LIKE '%VALORES%'
)
  ALTER TABLE dbo.CAL_EQUIPOS_HISTORIAL DROP CONSTRAINT CK_CAL_EQUIPOS_HISTORIAL_ACCION;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CAL_EQUIPOS_HISTORIAL_ACCION')
  EXEC('ALTER TABLE dbo.CAL_EQUIPOS_HISTORIAL ADD CONSTRAINT CK_CAL_EQUIPOS_HISTORIAL_ACCION CHECK (accion IN (
    ''ALTA'', ''EDICION'', ''CERTIFICADO'', ''CORRECCION'', ''ANULACION'', ''BAJA'', ''REACTIVACION'', ''REVISION'',
    ''PATRON'', ''PIEZAS'', ''VALORES''
  ))');

-- ─── Control de cambios (NB/ISO/IEC 17025, 7.11.2) ─────────────────────────
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: valores de los certificados de los patrones';
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
      N'En la ficha de cada equipo patrón se registra si es un juego de pesas o un instrumento de condiciones ambientales, la clase OIML R111 del juego, sus piezas con su densidad y, para el certificado vigente, la corrección, la U y el k de cada pieza o de cada punto de temperatura, humedad y presión, con las condiciones de su calibración. Es la fase 1 de los certificados de calibración en DataMET+: reemplaza lo que el libro F-VMET-02-7.2 copia de Access (EQUI_VIGENTE y VALORES).',
      N'Crea CAL_PATRONES, CAL_PATRON_PIEZAS, CAL_CERT_TRANSCRIPCION, CAL_CERT_VALORES y CAL_CERT_PUNTOS (migración 016). Cambiar los valores deja el certificado pendiente de revisión y quien los transcribió no puede revisarlos (7.11.6). No modifica DATA_EQUIPOS_CAL.',
      N'Migración 016; calibration.patrones.js; docs/calibracion-plan-implementacion.md (fase 1).',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 016'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 016', N'migración 016');
  END;
END;
