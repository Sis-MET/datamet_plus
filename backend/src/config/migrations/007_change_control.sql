-- ========================================================================
-- MIGRACIÓN 007: CONTROL DE CAMBIOS Y REGISTRO DE FALLAS
-- ========================================================================
-- NB/ISO/IEC 17025:2018, 7.11:
--
-- APP_CAMBIOS            : cada cambio del sistema (módulos, mejoras,
--                          correcciones, base de datos, configuración) con su
--                          documentación, validación, aprobación e
--                          implementación (7.11.2).
-- APP_CAMBIOS_HISTORIAL  : cada paso y edición de un cambio, con la versión
--                          anterior y la nueva.
-- APP_FALLAS             : fallas del sistema (errores del servidor, tareas
--                          programadas o registradas a mano) con su acción
--                          inmediata y correctiva (7.11.3 e).
--
-- Siembra los cambios ya implementados a partir del historial del
-- repositorio (registrados a posteriori) y los del módulo Calibración, que
-- quedan pendientes de validar y aprobar. Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.APP_CAMBIOS (
    id                    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_APP_CAMBIOS PRIMARY KEY,
    codigo                VARCHAR(20)    NOT NULL CONSTRAINT UQ_APP_CAMBIOS_Codigo UNIQUE,
    version               NVARCHAR(20)   NULL,
    titulo                NVARCHAR(150)  NOT NULL,
    tipo                  VARCHAR(20)    NOT NULL,
    modulos               NVARCHAR(200)  NULL,
    descripcion           NVARCHAR(MAX)  NOT NULL,
    impacto               NVARCHAR(1000) NULL,
    referencias           NVARCHAR(1000) NULL,
    fecha_cambio          DATE           NULL,
    estado                VARCHAR(20)    NOT NULL CONSTRAINT DF_APP_CAMBIOS_ESTADO DEFAULT 'REGISTRADO',
    validacion            NVARCHAR(2000) NULL,
    validacion_resultado  VARCHAR(20)    NULL,
    validado_por          NVARCHAR(50)   NULL,
    validado_en           DATETIME2      NULL,
    aprobacion_obs        NVARCHAR(500)  NULL,
    aprobado_por          NVARCHAR(50)   NULL,
    aprobado_en           DATETIME2      NULL,
    implementado_en       DATE           NULL,
    implementado_por      NVARCHAR(50)   NULL,
    implementacion_obs    NVARCHAR(500)  NULL,
    -- Registrado después de implementarse (cambios anteriores a este control).
    a_posteriori          BIT            NOT NULL CONSTRAINT DF_APP_CAMBIOS_POSTERIORI DEFAULT 0,
    registrado_por        NVARCHAR(50)   NULL,
    registrado_en         DATETIME2      NOT NULL CONSTRAINT DF_APP_CAMBIOS_REGISTRADO DEFAULT SYSUTCDATETIME(),
    actualizado_por       NVARCHAR(50)   NULL,
    actualizado_en        DATETIME2      NULL,
    CONSTRAINT CK_APP_CAMBIOS_TIPO CHECK (tipo IN ('MODULO', 'MEJORA', 'CORRECCION', 'SEGURIDAD', 'BASE_DATOS', 'CONFIGURACION')),
    CONSTRAINT CK_APP_CAMBIOS_ESTADO CHECK (estado IN ('REGISTRADO', 'VALIDADO', 'APROBADO', 'IMPLEMENTADO', 'RECHAZADO')),
    CONSTRAINT CK_APP_CAMBIOS_RESULTADO CHECK (validacion_resultado IS NULL OR validacion_resultado IN ('CONFORME', 'NO_CONFORME'))
  );
END;

IF OBJECT_ID('dbo.APP_CAMBIOS_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.APP_CAMBIOS_HISTORIAL (
    id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_APP_CAMBIOS_HISTORIAL PRIMARY KEY,
    cambio_id  INT           NOT NULL CONSTRAINT FK_APP_CAMBIOS_HISTORIAL_Cambio REFERENCES dbo.APP_CAMBIOS (id),
    accion     VARCHAR(20)   NOT NULL,
    detalle    NVARCHAR(400) NULL,
    antes      NVARCHAR(MAX) NULL,
    despues    NVARCHAR(MAX) NULL,
    usuario    NVARCHAR(50)  NULL,
    fecha      DATETIME2     NOT NULL CONSTRAINT DF_APP_CAMBIOS_HISTORIAL_FECHA DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_APP_CAMBIOS_HISTORIAL_ACCION CHECK (accion IN (
      'REGISTRO', 'EDICION', 'VALIDACION', 'APROBACION', 'RECHAZO', 'IMPLEMENTACION'
    ))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.APP_CAMBIOS_HISTORIAL') AND name = 'IX_APP_CAMBIOS_HISTORIAL_Cambio'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_APP_CAMBIOS_HISTORIAL_Cambio
    ON dbo.APP_CAMBIOS_HISTORIAL (cambio_id, fecha DESC);');
END;

IF OBJECT_ID('dbo.APP_FALLAS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.APP_FALLAS (
    id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_APP_FALLAS PRIMARY KEY,
    -- SERVIDOR: error de la API; TAREA: tarea programada; PROCESO: error no
    -- controlado del proceso; MANUAL: registrada por una persona (p. ej. el
    -- servidor estuvo caído).
    origen             VARCHAR(20)    NOT NULL,
    -- Agrupa las repeticiones de una misma falla mientras está abierta.
    huella             CHAR(40)       NULL,
    mensaje            NVARCHAR(500)  NOT NULL,
    detalle            NVARCHAR(MAX)  NULL,
    ruta               NVARCHAR(300)  NULL,
    estado_http        INT            NULL,
    usuario            NVARCHAR(50)   NULL,
    ocurrencias        INT            NOT NULL CONSTRAINT DF_APP_FALLAS_OCURRENCIAS DEFAULT 1,
    primera_vez        DATETIME2      NOT NULL CONSTRAINT DF_APP_FALLAS_PRIMERA DEFAULT SYSUTCDATETIME(),
    ultima_vez         DATETIME2      NOT NULL CONSTRAINT DF_APP_FALLAS_ULTIMA DEFAULT SYSUTCDATETIME(),
    estado             VARCHAR(20)    NOT NULL CONSTRAINT DF_APP_FALLAS_ESTADO DEFAULT 'ABIERTA',
    impacto            NVARCHAR(500)  NULL,
    accion_inmediata   NVARCHAR(1000) NULL,
    causa              NVARCHAR(1000) NULL,
    accion_correctiva  NVARCHAR(1000) NULL,
    cambio_id          INT            NULL CONSTRAINT FK_APP_FALLAS_Cambio REFERENCES dbo.APP_CAMBIOS (id),
    registrado_por     NVARCHAR(50)   NULL,
    atendido_por       NVARCHAR(50)   NULL,
    atendido_en        DATETIME2      NULL,
    cerrado_por        NVARCHAR(50)   NULL,
    cerrado_en         DATETIME2      NULL,
    CONSTRAINT CK_APP_FALLAS_ORIGEN CHECK (origen IN ('SERVIDOR', 'TAREA', 'PROCESO', 'MANUAL')),
    CONSTRAINT CK_APP_FALLAS_ESTADO CHECK (estado IN ('ABIERTA', 'EN_CURSO', 'CERRADA', 'DESCARTADA'))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.APP_FALLAS') AND name = 'IX_APP_FALLAS_Estado'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_APP_FALLAS_Estado
    ON dbo.APP_FALLAS (estado, ultima_vez DESC);');
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.APP_FALLAS') AND name = 'IX_APP_FALLAS_Huella'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_APP_FALLAS_Huella
    ON dbo.APP_FALLAS (huella)
    WHERE huella IS NOT NULL AND estado IN (''ABIERTA'', ''EN_CURSO'');');
END;

-- ─── Cambios ya realizados ─────────────────────────────────────────────────
-- Tomados del historial del repositorio. Los anteriores al módulo Calibración
-- ya están en uso y se registran a posteriori: su validación y aprobación
-- formales están pendientes. Las fechas de puesta en producción solo constan
-- cuando el commit lo indica.
DECLARE @semilla TABLE (
  codigo          VARCHAR(20),
  version         NVARCHAR(20),
  titulo          NVARCHAR(150),
  tipo            VARCHAR(20),
  modulos         NVARCHAR(200),
  descripcion     NVARCHAR(MAX),
  impacto         NVARCHAR(1000),
  referencias     NVARCHAR(1000),
  fecha_cambio    DATE,
  estado          VARCHAR(20),
  implementado_en DATE,
  a_posteriori    BIT
);

INSERT INTO @semilla VALUES
  ('CC-2026-001', NULL, N'Formulario RIM', 'MODULO', N'Formulario RIM',
   N'Formulario de recepción de instrumentos de pesaje: datos de la balanza, del cliente y del técnico, validación de campos, firma digital, evidencias fotográficas y generación del PDF.',
   N'Nuevo registro de recepción de instrumentos.',
   N'Commits 752dbef a bcf0f2e (22/01/2026 a 05/03/2026).', '2026-03-05', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-002', NULL, N'Backend y conexión con SQL Server', 'MODULO', N'Sistema',
   N'API en Node.js y Express conectada a SQL Server, inicio de sesión con token y conexión del frontend con el backend.',
   N'Los datos pasan a guardarse en DataMET.',
   N'Commits b3f3657 y 5c80975.', '2026-02-27', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-003', NULL, N'Cronograma Métrica y primera puesta en producción', 'MODULO', N'Cronograma',
   N'Calendario de tareas del personal, inicio de sesión, tema claro y oscuro, lógica de vehículos y activos y certificador en el servidor. Primera puesta en producción el 02/04/2026 y correcciones posteriores.',
   N'Nuevo registro de la planificación del personal.',
   N'Commits b967b4a a 12327c3.', '2026-04-10', 'IMPLEMENTADO', '2026-04-02', 1),
  ('CC-2026-004', NULL, N'Cronograma: varias fichas por celda, horarios y DATA_USERS', 'MEJORA', N'Cronograma',
   N'Varias fichas en una celda, lógica de horarios, nueva tabla del cronograma, separación de ids para el guardado y uso de DATA_USERS; ajustes de la VPN.',
   N'Cambia la tabla del cronograma.',
   N'Commits dcbeaab a f3715d9.', '2026-04-22', 'IMPLEMENTADO', '2026-04-22', 1),
  ('CC-2026-005', NULL, N'Cronograma: cotizaciones y salidas del personal', 'MODULO', N'Cronograma, Salidas del personal',
   N'Preparación para Bitrix24, columna de cotización con descripción separada, registro de códigos (codigo_reg), salidas del personal y gestión administrativa del calendario.',
   N'Nuevos datos en el cronograma.',
   N'Commits 796aa51 a b8075bc.', '2026-05-21', 'IMPLEMENTADO', '2026-05-21', 1),
  ('CC-2026-006', NULL, N'Gestor de paquetes y notificaciones', 'SEGURIDAD', N'Sistema',
   N'Cambio de npm a pnpm por seguridad de las dependencias y de sileo a sonner para las notificaciones; configuración dinámica del backend y refactorización de componentes.',
   N'Sin cambios en los datos.',
   N'Commits 5d41e74, 28f219c, 3204eb3 y abd2845.', '2026-05-22', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-007', N'2.5.4', N'Código de salida, copiar y mover tareas', 'MEJORA', N'Cronograma',
   N'Generación del código de salida, copiar o mover tareas, vista del calendario según el área del usuario, versión de la aplicación y pie de página.',
   N'Nuevos datos en las salidas del personal.',
   N'Commit 165c82f.', '2026-05-25', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-008', N'2.5.4', N'Gantt: cliente, planta y fichas pasadas', 'MEJORA', N'Cronograma',
   N'Se guardan planta y descripción, jerarquía cliente/planta, tipo «Otro», clientes manuales, rediseño de validaciones y permiso para que el jefe de área modifique fichas pasadas.',
   N'Cambia quién puede modificar fichas pasadas.',
   N'Commits 23fe91f, 4391b16 y 298874c.', '2026-07-15', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-009', N'2.6.0', N'Migraciones versionadas y validación del cronograma', 'BASE_DATOS', N'Sistema, Cronograma',
   N'Migraciones registradas en SCHEMA_MIGRATIONS (001: campos normalizados de la tarea y retiro de codigo_reg), validación del cronograma en el backend, capa de dominio del calendario, tema unificado, almacenamiento seguro y pruebas con Vitest y Playwright.',
   N'Modifica DATA_CRONOGRAMA (migración 001).',
   N'Commits c510567 a 35a8796; migración 001.', '2026-08-18', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-010', N'2.6.1', N'Rendimiento del Gantt e índices', 'MEJORA', N'Cronograma',
   N'Optimización del dibujo del Gantt y de sus tooltips e índices de rendimiento del cronograma (migración 002).',
   N'Agrega índices a DATA_CRONOGRAMA, DATA_USERS y DATA_ACTIVOS.',
   N'Commit 63c6c44; migración 002.', '2026-08-26', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-011', N'2.6.1', N'Gestión IvMET', 'MODULO', N'Gestión IvMET',
   N'Módulo administrativo de IvMET: API protegida hacia Supabase, gestor por cliente con licencias, contratos y pagos, acceso restringido al nivel 3 con código, permisos personales, balanzas registradas por el cliente, casos y actualizaciones.',
   N'El backend accede a datos de clientes en Supabase.',
   N'Commits 9188f80 a 78a22de.', '2026-09-15', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-012', N'2.6.1', N'Tema claro y oscuro y barra lateral', 'MEJORA', N'Todos',
   N'Nueva base visual con tema claro y oscuro, barra lateral con Ctrl+B y rediseño de los controles, el Formulario RIM, el Cronograma, las Salidas y Gestión IvMET.',
   N'Sin cambios en los datos.',
   N'Commits 7b618c3 a 3a019b7.', '2026-09-16', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-013', N'2.6.1', N'Reservas de vehículos y fichas por grupo', 'MEJORA', N'Cronograma',
   N'Disponibilidad de vehículos en la agenda, protección de las reservas y vínculo de las fichas por grupo y por creador (migración 003).',
   N'Agrega columnas a DATA_CRONOGRAMA (migración 003).',
   N'Commits a3950cc a ebcd07d; migración 003.', '2026-09-23', 'IMPLEMENTADO', NULL, 1),
  ('CC-2026-014', N'2.7.0', N'Módulo Calibración: plan anual y alertas', 'MODULO', N'Calibración',
   N'Plan anual de calibraciones, verificaciones internas y actividades del área (vistas año, mes y agenda), seguimiento de cada fecha, alertas en el cronograma y por correo, y pestañas de equipos, actividades y alertas (migración 004).',
   N'Crea las tablas CAL_PROGRAMAS, CAL_EVENTOS, CAL_AJUSTES, CAL_CONTACTOS y CAL_ALERTAS_ENVIOS; lee DATA_EQUIPOS_CAL.',
   N'Commits ac3cb9b a 56bd24f; migración 004.', '2026-10-06', 'REGISTRADO', NULL, 0),
  ('CC-2026-015', N'2.7.0', N'Gestión de equipos y certificados de calibración', 'MODULO', N'Calibración',
   N'Alta y edición de equipos en DATA_EQUIPOS_CAL; registro, corrección y anulación de certificados; baja y reactivación; historial por equipo (migración 005).',
   N'Escribe en DATA_EQUIPOS_CAL con sus convenciones; crea CAL_CERTIFICADOS y CAL_EQUIPOS_HISTORIAL.',
   N'Commits 611f4db a 1675e9a; migración 005.', '2026-10-06', 'REGISTRADO', NULL, 0),
  ('CC-2026-016', N'2.7.0', N'Pestaña Cumplimiento NB/ISO/IEC 17025', 'MEJORA', N'Calibración',
   N'Evaluación con datos en vivo de los puntos 7.5, 7.11 y 8.4, con plan de acción por prioridad, y skill del proyecto con los requisitos.',
   N'Solo lectura; consulta el historial de respaldos en msdb.',
   N'Archivos calibration.compliance.js y CompliancePanel.jsx.', '2026-10-06', 'REGISTRADO', NULL, 0),
  ('CC-2026-017', N'2.7.0', N'Trazabilidad de los registros de calibración', 'MEJORA', N'Calibración',
   N'Historial completo de cada fecha del plan y de su configuración, motivo obligatorio al modificar lo ya registrado, corrección de certificados con la versión anterior completa, revisión por un segundo usuario y referencia a la hoja de datos de cada verificación (migración 006).',
   N'Agrega columnas a CAL_EVENTOS, CAL_CERTIFICADOS y CAL_EQUIPOS_HISTORIAL; crea CAL_EVENTOS_HISTORIAL y CAL_PLAN_HISTORIAL.',
   N'Migración 006.', '2026-10-06', 'REGISTRADO', NULL, 0),
  ('CC-2026-018', N'2.7.0', N'Control de cambios y registro de fallas', 'MODULO', N'Sistema',
   N'Registro de los cambios del sistema con su validación, aprobación e implementación, y registro de fallas con captura automática de los errores del servidor y su acción inmediata y correctiva (migración 007).',
   N'Crea APP_CAMBIOS, APP_CAMBIOS_HISTORIAL y APP_FALLAS.',
   N'Migración 007.', '2026-10-06', 'REGISTRADO', NULL, 0);

INSERT INTO dbo.APP_CAMBIOS
  (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
   estado, implementado_en, implementacion_obs, a_posteriori, registrado_por)
SELECT s.codigo, s.version, s.titulo, s.tipo, s.modulos, s.descripcion, s.impacto, s.referencias,
  s.fecha_cambio, s.estado, s.implementado_en,
  CASE WHEN s.a_posteriori = 1 AND s.implementado_en IS NULL
    THEN N'En uso; la fecha de puesta en producción no quedó registrada.' END,
  s.a_posteriori, N'migración 007'
FROM @semilla s
WHERE NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS c WHERE c.codigo = s.codigo);

INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
SELECT c.id, 'REGISTRO',
  CASE WHEN c.a_posteriori = 1
    THEN N'Registrado a posteriori a partir del historial del repositorio'
    ELSE N'Registrado al documentar el módulo Calibración' END,
  N'migración 007'
FROM dbo.APP_CAMBIOS c
WHERE NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS_HISTORIAL h WHERE h.cambio_id = c.id);
