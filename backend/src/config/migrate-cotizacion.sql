-- ========================================================================
-- SCRIPT DE MIGRACIÓN: COLUMNA descripcion → cotizacion
-- ========================================================================
-- 1. Se agrega la nueva columna "cotizacion" (NVarChar) a DATA_CRONOGRAMA.
-- 2. Se copian los datos existentes de "descripcion" a "cotizacion".
-- 3. La columna "descripcion" queda disponible como campo adicional libre.
-- ========================================================================
-- ⚠️  EJECUTAR SOLO UNA VEZ. Verificar en un entorno de prueba primero.
-- ========================================================================

BEGIN TRANSACTION;

-- 1. Agregar la columna "cotizacion" si no existe
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'DATA_CRONOGRAMA' AND COLUMN_NAME = 'cotizacion'
)
BEGIN
  ALTER TABLE DATA_CRONOGRAMA
    ADD cotizacion NVARCHAR(200) NULL;
  PRINT 'Columna "cotizacion" agregada exitosamente.';
END
ELSE
BEGIN
  PRINT 'La columna "cotizacion" ya existe. Se omite el ALTER.';
END;

-- 2. Copiar los datos actuales de "descripcion" → "cotizacion"
--    Solo para registros que aún no tienen cotizacion asignada
UPDATE DATA_CRONOGRAMA
SET cotizacion = descripcion
WHERE descripcion IS NOT NULL
  AND RTRIM(LTRIM(descripcion)) <> ''
  AND (cotizacion IS NULL OR RTRIM(LTRIM(cotizacion)) = '');

PRINT CONCAT('Registros actualizados: ', @@ROWCOUNT);

-- 3. Limpiar la columna "descripcion" de los valores que ya fueron migrados
--    (dejarla vacía para que quede disponible como campo libre)
UPDATE DATA_CRONOGRAMA
SET descripcion = NULL
WHERE cotizacion IS NOT NULL
  AND RTRIM(LTRIM(cotizacion)) <> ''
  AND descripcion = cotizacion;

PRINT 'Columna "descripcion" limpiada en registros migrados.';

COMMIT TRANSACTION;

PRINT '✅ Migración completada con éxito.';
