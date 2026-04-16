-- Agregar columnas hora_inicio y hora_fin a DATA_CRONOGRAMA
ALTER TABLE DATA_CRONOGRAMA ADD hora_inicio TIME(7) NULL;
ALTER TABLE DATA_CRONOGRAMA ADD hora_fin    TIME(7) NULL;
