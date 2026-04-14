-- ========================================================================
-- SCRIPT DE MIGRACIÓN: ELIMINACIÓN DE TURNOS "MAÑANA" Y "TARDE"
-- ========================================================================
-- Este script toma los registros actuales de DATA_CRONOGRAMA y, si tienen
-- información tanto en "manana" como en "tarde", los divide en dos filas distintas.
-- Si solo tienen uno, simplemente lo re-asigna a la columna "manana" (que
-- a partir de ahora se usará conceptualmente como "actividad" única de la ficha).

BEGIN TRANSACTION;

-- 1. Insertar nuevas filas para los registros que tenían "tarde" rellenado.
-- Se crea una nueva ficha donde la actividad (manana) sea lo que estaba en tarde,
-- utilizando los metadatos originales del registro padre.
INSERT INTO DATA_CRONOGRAMA (
    id_usuario, usuario, fecha, 
    manana, -- se usa la columna manana como 'actividad' global
    tarde, 
    color_am, -- color
    color_pm, 
    estado_am, -- estado
    estado_pm,
    creado_por, fecha_creacion, hora_creacion, 
    actualizado_por, fecha_modificacion, hora_modificacion
)
SELECT 
    id_usuario, usuario, fecha, 
    tarde AS manana, -- Movemos lo que estaba en tarde a manana (actividad)
    NULL AS tarde,   -- Vaciamos tarde
    color_pm AS color_am, -- Movemos color de tarde
    NULL AS color_pm,
    estado_pm AS estado_am, -- Movemos estado de tarde
    NULL AS estado_pm,
    creado_por, fecha_creacion, hora_creacion, 
    actualizado_por, fecha_modificacion, hora_modificacion
FROM DATA_CRONOGRAMA
WHERE tarde IS NOT NULL AND RTRIM(LTRIM(tarde)) <> '';

-- 2. Limpiar las columnas "tarde" de los registros originales, ya que ahora 
-- toda la información de la tarde ha sido separada en nuevas filas exclusivas.
UPDATE DATA_CRONOGRAMA
SET 
    tarde = NULL,
    color_pm = NULL,
    estado_pm = NULL
WHERE tarde IS NOT NULL AND RTRIM(LTRIM(tarde)) <> '';

-- Opcional: Eliminar filas que accidentalmente estén totalmente vacías
DELETE FROM DATA_CRONOGRAMA 
WHERE (manana IS NULL OR RTRIM(LTRIM(manana)) = '') 
  AND (tarde IS NULL OR RTRIM(LTRIM(tarde)) = '');

COMMIT TRANSACTION;

-- Nota: Para que el sistema funcione a nivel de BD, las columnas 'tarde', 'color_pm'
-- y 'estado_pm' ya no se utilizarán ni afectarán. A través del API, nos referiremos
-- a 'manana' como la ficha individual.
