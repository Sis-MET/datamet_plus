-- ========================================================================
-- MIGRACIÓN 003: GRUPO DE FICHA Y CREADOR NUMÉRICO
-- ========================================================================
-- grupo_id   : identifica todas las filas que forman una misma ficha (la
--              persona principal, las adicionales y el vehículo). Antes el
--              vínculo se deducía comparando textos.
-- id_creador : DATA_USERS.id de quien creó la fila. Decide quién puede
--              tocar una reserva de vehículo sin depender de nombres.
-- Ambas columnas son opcionales: las filas anteriores siguen funcionando con
-- la comparación por texto. Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.DATA_CRONOGRAMA', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.DATA_CRONOGRAMA', 'grupo_id') IS NULL
    ALTER TABLE dbo.DATA_CRONOGRAMA ADD grupo_id VARCHAR(36) NULL;

  IF COL_LENGTH('dbo.DATA_CRONOGRAMA', 'id_creador') IS NULL
    ALTER TABLE dbo.DATA_CRONOGRAMA ADD id_creador INT NULL;
END;

-- Dinámico: la columna recién creada no existe al compilar este lote.
IF OBJECT_ID('dbo.DATA_CRONOGRAMA', 'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.DATA_CRONOGRAMA')
      AND name = 'IX_DATA_CRONOGRAMA_Grupo'
  )
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_DATA_CRONOGRAMA_Grupo
    ON dbo.DATA_CRONOGRAMA (grupo_id)
    WHERE grupo_id IS NOT NULL;');
END;
