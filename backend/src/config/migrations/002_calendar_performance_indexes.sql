-- ========================================================================
-- MIGRACIÓN 002: ÍNDICES DE RENDIMIENTO PARA CRONOGRAMA
-- ========================================================================
-- Optimiza la consulta por rango de fechas, la validación de solapamientos
-- y la carga de técnicos/vehículos. Es idempotente por nombre de índice.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.DATA_CRONOGRAMA', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.DATA_CRONOGRAMA')
      AND name = 'IX_DATA_CRONOGRAMA_Fecha_Recurso'
  )
  BEGIN
    CREATE NONCLUSTERED INDEX IX_DATA_CRONOGRAMA_Fecha_Recurso
      ON dbo.DATA_CRONOGRAMA (fecha, id_usuario)
      INCLUDE (usuario, estado, hora_inicio, hora_fin);
  END;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.DATA_CRONOGRAMA')
      AND name = 'IX_DATA_CRONOGRAMA_Recurso_Fecha_Horario'
  )
  BEGIN
    CREATE NONCLUSTERED INDEX IX_DATA_CRONOGRAMA_Recurso_Fecha_Horario
      ON dbo.DATA_CRONOGRAMA (id_usuario, fecha, usuario)
      INCLUDE (id, estado, hora_inicio, hora_fin);
  END;
END;

IF OBJECT_ID('dbo.DATA_USERS', 'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.DATA_USERS')
      AND name = 'IX_DATA_USERS_Estado_Area'
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_DATA_USERS_Estado_Area
    ON dbo.DATA_USERS (estado, area)
    INCLUDE (id, nombre1, apellido1, cargo, hora_ingreso, hora_salida);
END;

IF OBJECT_ID('dbo.DATA_ACTIVOS', 'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.DATA_ACTIVOS')
      AND name = 'IX_DATA_ACTIVOS_Cronograma'
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_DATA_ACTIVOS_Cronograma
    ON dbo.DATA_ACTIVOS (categoria, estado, acceso_cron)
    INCLUDE (id, identificacion);
END;
