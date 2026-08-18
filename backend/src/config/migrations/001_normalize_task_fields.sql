-- ========================================================================
-- MIGRACIÓN 001: CAMPOS NORMALIZADOS DE TAREA Y RETIRO DE codigo_reg
-- ========================================================================
-- Agrega tipo_tarea, cliente y planta; separa los valores que antes estaban
-- combinados en cotizacion/cod_cliente; y elimina el código RSP, que deja de
-- generarse y almacenarse.
--
-- Ejecutar primero en un entorno de prueba y respaldar DATA_CRONOGRAMA.
-- El script es idempotente para las columnas nuevas.
-- ========================================================================

SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH('dbo.DATA_CRONOGRAMA', 'tipo_tarea') IS NULL
    ALTER TABLE dbo.DATA_CRONOGRAMA ADD tipo_tarea NVARCHAR(100) NULL;

  -- Puede existir de una migración anterior con un tamaño menor (por ejemplo,
  -- NVARCHAR(50)). Se normaliza antes de copiar valores históricos.
  IF EXISTS (
    SELECT 1
    FROM sys.columns c
    INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.DATA_CRONOGRAMA')
      AND c.name = 'tipo_tarea'
      AND (t.name <> 'nvarchar' OR (c.max_length <> -1 AND c.max_length < 200))
  )
    EXEC sys.sp_executesql N'
      ALTER TABLE dbo.DATA_CRONOGRAMA
        ALTER COLUMN tipo_tarea NVARCHAR(100) NULL;
    ';

  IF COL_LENGTH('dbo.DATA_CRONOGRAMA', 'cliente') IS NULL
    ALTER TABLE dbo.DATA_CRONOGRAMA ADD cliente NVARCHAR(200) NULL;

  IF COL_LENGTH('dbo.DATA_CRONOGRAMA', 'planta') IS NULL
    ALTER TABLE dbo.DATA_CRONOGRAMA ADD planta NVARCHAR(200) NULL;

  IF EXISTS (
    SELECT 1
    FROM sys.columns c
    INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.DATA_CRONOGRAMA')
      AND c.name = 'planta'
      AND (t.name <> 'nvarchar' OR (c.max_length <> -1 AND c.max_length < 400))
  )
    EXEC sys.sp_executesql N'
      ALTER TABLE dbo.DATA_CRONOGRAMA
        ALTER COLUMN planta NVARCHAR(200) NULL;
    ';

  -- SQL Server compila el lote antes de ejecutar los ALTER TABLE. Estos UPDATE
  -- se compilan dinámicamente para que tipo_tarea y planta ya existan.
  EXEC sys.sp_executesql N'
    -- El formulario anterior guardaba la planta en cod_cliente (ej. 123-456).
    PRINT ''Migrando códigos de planta...'';
    UPDATE dbo.DATA_CRONOGRAMA
    SET planta = LEFT(LTRIM(RTRIM(cod_cliente)), 200),
        cod_cliente = LTRIM(RTRIM(LEFT(cod_cliente, CHARINDEX(''-'', cod_cliente) - 1)))
    WHERE (planta IS NULL OR LTRIM(RTRIM(planta)) = '''')
      AND cod_cliente LIKE ''%-%''
      AND CHARINDEX(''-'', cod_cliente) > 1;

    -- Las salidas de personal también usaban cotizacion para guardar su tipo.
    PRINT ''Migrando tipos de salida...'';
    UPDATE dbo.DATA_CRONOGRAMA
    SET tipo_tarea = LEFT(LTRIM(RTRIM(cotizacion)), 100),
        cotizacion = NULL
    WHERE (tipo_tarea IS NULL OR LTRIM(RTRIM(tipo_tarea)) = '''')
      AND creado_en IN (''Salida Personal'', ''SalidaMET'')
      AND cotizacion IS NOT NULL
      AND LTRIM(RTRIM(cotizacion)) <> '''';

    -- Formato anterior: "SERVICIO - 123.COT456".
    PRINT ''Separando tipos y cotizaciones combinadas...'';
    UPDATE dbo.DATA_CRONOGRAMA
    SET tipo_tarea = LEFT(LTRIM(RTRIM(LEFT(cotizacion, CHARINDEX('' - '', cotizacion) - 1))), 100),
        cotizacion = LTRIM(RTRIM(SUBSTRING(cotizacion, CHARINDEX('' - '', cotizacion) + 3, LEN(cotizacion))))
    WHERE (tipo_tarea IS NULL OR LTRIM(RTRIM(tipo_tarea)) = '''')
      AND cotizacion LIKE ''% - %.COT%''
      AND CHARINDEX('' - '', cotizacion) > 1;

    -- Si solo existe un código de cotización, la tarea corresponde a Servicio.
    PRINT ''Clasificando cotizaciones sin tipo...'';
    UPDATE dbo.DATA_CRONOGRAMA
    SET tipo_tarea = ''Servicio''
    WHERE (tipo_tarea IS NULL OR LTRIM(RTRIM(tipo_tarea)) = '''')
      AND cotizacion LIKE ''%.COT%'';

    -- Los demás valores simples de cotizacion eran el tipo de tarea.
    PRINT ''Migrando tipos de tarea restantes...'';
    UPDATE dbo.DATA_CRONOGRAMA
    SET tipo_tarea = LEFT(LTRIM(RTRIM(cotizacion)), 100),
        cotizacion = NULL
    WHERE (tipo_tarea IS NULL OR LTRIM(RTRIM(tipo_tarea)) = '''')
      AND cotizacion IS NOT NULL
      AND LTRIM(RTRIM(cotizacion)) <> '''';
  ';

  -- codigo_reg deja de formar parte del modelo. El backend actualizado ya no
  -- lo consulta ni lo escribe.
  IF COL_LENGTH('dbo.DATA_CRONOGRAMA', 'codigo_reg') IS NOT NULL
  BEGIN
    PRINT 'Eliminando la columna codigo_reg...';
    DECLARE @defaultConstraint SYSNAME;
    SELECT @defaultConstraint = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.DATA_CRONOGRAMA')
      AND c.name = 'codigo_reg';

    IF @defaultConstraint IS NOT NULL
    BEGIN
      DECLARE @dropConstraintSql NVARCHAR(MAX);
      SET @dropConstraintSql = N'ALTER TABLE dbo.DATA_CRONOGRAMA DROP CONSTRAINT '
        + QUOTENAME(@defaultConstraint) + N';';
      EXEC sys.sp_executesql @dropConstraintSql;
    END;

    ALTER TABLE dbo.DATA_CRONOGRAMA DROP COLUMN codigo_reg;
  END;

  COMMIT TRANSACTION;
  PRINT 'Migración de campos de tarea completada correctamente.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
