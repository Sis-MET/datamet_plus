-- Calibración: aprobadores de los registros de calibración (fase 4).
-- El jefe de Calibración revisa por su cargo y delega en personal del área,
-- como en Soporte (013): versión, lista e historial de cada cambio.

IF OBJECT_ID('dbo.CAL_APROBADORES_AJUSTES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_APROBADORES_AJUSTES (
    id INT NOT NULL CONSTRAINT PK_CAL_APROBADORES_AJUSTES PRIMARY KEY,
    version INT NOT NULL CONSTRAINT DF_CAL_APROBADORES_VERSION DEFAULT 1,
    actualizado_por NVARCHAR(50) NULL,
    actualizado_en DATETIME2 NULL,
    CONSTRAINT CK_CAL_APROBADORES_UNICO CHECK (id = 1)
  );
END;
IF NOT EXISTS (SELECT 1 FROM dbo.CAL_APROBADORES_AJUSTES WHERE id = 1)
  INSERT INTO dbo.CAL_APROBADORES_AJUSTES (id, version) VALUES (1, 1);

IF OBJECT_ID('dbo.CAL_APROBADORES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_APROBADORES (
    usuario_id INT NOT NULL CONSTRAINT PK_CAL_APROBADORES PRIMARY KEY,
    autorizado_por NVARCHAR(50) NOT NULL,
    autorizado_en DATETIME2 NOT NULL CONSTRAINT DF_CAL_APROBADORES_FECHA DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID('dbo.CAL_APROBADORES_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_APROBADORES_HISTORIAL (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_APROBADORES_HISTORIAL PRIMARY KEY,
    version INT NOT NULL,
    anteriores NVARCHAR(MAX) NOT NULL,
    nuevos NVARCHAR(MAX) NOT NULL,
    usuario NVARCHAR(50) NOT NULL,
    nombre NVARCHAR(120) NULL,
    fecha DATETIME2 NOT NULL CONSTRAINT DF_CAL_APROBADORES_HIST_FECHA DEFAULT SYSUTCDATETIME()
  );
END;

-- Control de cambios (7.11.2).
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @titulo NVARCHAR(150) = N'Calibración: aprobadores, composición de cargas y avisos antes de enviar';
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
      N'El jefe de Calibración designa aprobadores de los registros de calibración (además de él, por su cargo). Quien elabora el registro puede elegir las piezas de cada carga en lugar de la regla automática; antes de enviar a revisión se muestran los avisos del servicio; el detalle dibuja la plataforma de la excentricidad.',
      N'Crea CAL_APROBADORES, CAL_APROBADORES_AJUSTES y CAL_APROBADORES_HISTORIAL (migración 019). Los permisos se leen de DATA_USERS en cada solicitud. La composición elegida queda en el registro con su historial y entra en la huella del envío (7.5.2, 7.11).',
      N'Migración 019; aprobadores.js; calibration.aprobadores.js; calibration.registros.js; docs/calibracion-plan-implementacion.md (fase 4).',
      CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 019'
    );

    INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
    VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 019', N'migración 019');
  END;
END;
