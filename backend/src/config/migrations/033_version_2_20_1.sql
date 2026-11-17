-- ========================================================================
-- MIGRACIÓN 033: CRONOGRAMA Y TIEMPOS DE SERVICIO (VERSIÓN 2.20.1)
-- ========================================================================
-- Registra en Control de cambios (NB/ISO/IEC 17025, 7.11.2) lo que agrega
-- la versión 2.20.1: en el Cronograma, el buscador Ctrl + K, el filtro de
-- áreas a la vista, las fechas fijas al bajar y la referencia del servicio
-- en la ficha; en los tiempos de servicio de Soporte técnico y de
-- Calibración, el período a elección, el mapa por departamento y el informe
-- PDF. Queda REGISTRADO: Sistemas lo valida y los jefes de área lo aprueban
-- antes de desplegar la versión.
--
-- No cambia tablas. Es idempotente: no repite un título.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @cambios TABLE (
    orden         INT,
    titulo        NVARCHAR(150),
    tipo          VARCHAR(20),
    modulos       NVARCHAR(200),
    descripcion   NVARCHAR(MAX),
    impacto       NVARCHAR(1000),
    referencias   NVARCHAR(1000),
    fecha_cambio  DATE
  );

  INSERT INTO @cambios VALUES
    (1, N'Cronograma: buscador Ctrl + K en todas las fechas', 'MEJORA', N'Cronograma',
     N'Ctrl + K (⌘ K en Mac) o el botón «Buscar…» de la barra abre un buscador que busca en todas las fechas del cronograma por cliente, planta, cotización, SECA u OTST, descripción, tipo de tarea o persona, sin importar tildes ni mayúsculas; todas las palabras deben coincidir y las tareas más cercanas a hoy van primero (hasta 40). También encuentra personas y vehículos. Enter lleva a la semana de la tarea, centra su fila, la resalta y abre su ficha (o la salida, de solo lectura); Mayús + Enter solo la ubica. Quien no puede editar, o una tarea de fecha pasada, solo la ubica.',
     N'Solo lectura: nueva ruta GET /calendar/cronograma/buscar para cualquier usuario con sesión, con las mismas columnas que la grilla, sin las anuladas, con parámetros y sin comodines de LIKE. Abrir una ficha sigue las mismas reglas de edición y de reservas de vehículo que un clic en la grilla.',
     N'calendar.service.js (searchSchedule), calendar.controller.js, calendar.routes.js, CalendarSearch.jsx, CalendarPage.jsx, domain/scheduleSearch.js, domain/scheduleRows.js, hooks/useGantt.js; pruebas en calendar.search.test.js y scheduleSearch.test.js.', '2026-11-17'),
    (2, N'Cronograma: filtro de áreas a la vista y fechas fijas al bajar', 'MEJORA', N'Cronograma',
     N'El filtro por área deja el menú desplegable y pasa a fichas siempre visibles sobre la grilla («Todas» y cada área con su cantidad; la del usuario lleva «Mi área»). Al bajar por el cronograma, una fila de fechas reducida queda fija bajo la barra superior, con hoy en amarillo, domingos y feriados en rojo y el día elegido subrayado, y sigue al desplazamiento horizontal de la grilla.',
     N'Solo presentación: no cambia datos ni permisos. El filtro elegido funciona igual que antes (los vehículos siguen visibles con cualquier área).',
     N'GanttPage.jsx, GanttHeader.jsx, GanttCompactHeader.jsx, index.css; pruebas e2e en calendar.spec.js.', '2026-11-17'),
    (3, N'Cronograma: la ficha pide la cotización, SECA u OTST del servicio', 'MEJORA', N'Cronograma',
     N'La ficha de una tarea (salvo permisos y compensación) tiene el campo «Cotización, SECA u OTST» del servicio al que va la salida, marcado como recomendado mientras está vacío. Reconoce los formatos de ServiceMET y del libro (OTST 26-0285-51-S01 o 0000-S16-1-25, SECA 0051-C01-26 o 0103-31-C05-26, cotización 123.COT456) y muestra dentro del campo de cuál se trata; otro texto se guarda tal cual. No es obligatorio. El globo de la tarea lo muestra con su tipo.',
     N'Se guarda en mayúsculas (hasta 60 caracteres) en la columna cotizacion de DATA_CRONOGRAMA, que estaba sin uso con el buscador de cotizaciones apagado. Las tareas anteriores no cambian; al editar, ese valor ya no oculta el cliente.',
     N'ServiceReferenceField.jsx, CellPopoverForm.jsx, GanttTaskCell.jsx, domain/taskFormDomain.js; pruebas en taskFormDomain.test.js.', '2026-11-17'),
    (4, N'Tiempos de servicio: período por mes, varios meses o rango de fechas', 'MEJORA', N'Soporte técnico, Calibración',
     N'Además de los atajos (este mes, mes anterior, últimos 3 y 12 meses, este año y año anterior), el período puede ser un mes cualquiera, varios meses seguidos (Mayús + clic) o un rango de fechas elegido en un calendario propio. Un mes completo se compara con el anterior, el mes en curso con los mismos días del anterior y varios meses completos con los mismos meses justo antes.',
     N'Solo consulta: no cambia los datos. El servidor sigue limitando cada consulta a tres años.',
     N'PeriodoSelector.jsx, TiemposPanel.jsx, domain/tiempos.js (rangoMes, rangoMeses, etiquetaSeleccion, periodoAnterior); pruebas en tiempos.test.js y e2e/tiempos.spec.js.', '2026-11-17'),
    (5, N'Tiempos de servicio: mapa de servicios por departamento con ubicación GPS', 'MEJORA', N'Soporte técnico, Calibración',
     N'Los tiempos de servicio muestran un mapa compacto de Bolivia con calles y zonas: los departamentos se tiñen por servicios u horas y cada lugar con la ubicación que registró ServiceMET (desde la 6.3.5) es un punto del color del tipo de servicio, junto a los cercanos. Se acerca con Ctrl + rueda y «Ampliar» lo abre casi a pantalla completa. Pulsar un departamento filtra todo el panel; hay también un filtro de departamento. Sin ubicación, el servicio cuenta por el departamento de su planta.',
     N'Solo lectura: el servidor lee las coordenadas del resumen DATA_SERVICIOS_DATOS (latitud, longitud y precisión de la última subida que las trae), solo si la base ya tiene esas columnas, y el departamento de la planta. El CSV agrega departamento, latitud y longitud. El mapa base viene de CARTO (clave en VITE_CARTO_API_KEY, fuera del repositorio; sin ella, OpenStreetMap) y requiere salida a internet; la biblioteca Leaflet 1.9.4 se agrega a la aplicación.',
     N'tiempos.js, soporte.tiempos.js, calibration.tiempos.js (backend); MapaServicios.jsx, MapaInteractivo.jsx, domain/ubicacion.js, domain/boliviaGeo.js (geoBoundaries BOL ADM1, GeoBolivia, dominio público); pruebas en tiempos.test.js (backend) y ubicacion.test.js.', '2026-11-17'),
    (6, N'Tiempos de servicio: informe PDF con el encabezado de los RIM', 'MEJORA', N'Soporte técnico, Calibración',
     N'«Informe PDF» genera un informe con el encabezado de los RIM en cada página (logotipo, sitio y oficinas de La Paz y Santa Cruz) y los filtros del panel: datos del informe, resumen con la comparación con el período anterior y, a elección, evolución mensual, personal, tipo de servicio o capacidad, mapa y tabla por departamento, detalle por técnico y la lista de servicios del período.',
     N'Solo consulta: el informe usa lo que el panel ya calculó y no pide nada nuevo al servidor; dice quién lo generó y cuándo. No reemplaza ningún registro técnico.',
     N'InformeTiemposPdf.jsx, ExportarInformeModal.jsx, TiemposPanel.jsx.', '2026-11-17');

  DECLARE @anio CHAR(4) = CONVERT(char(4), YEAR(DATEADD(hour, -4, SYSUTCDATETIME())));
  DECLARE @orden INT = 1;
  DECLARE @total INT = (SELECT MAX(orden) FROM @cambios);
  DECLARE @titulo NVARCHAR(150);
  DECLARE @ultimo INT;

  WHILE @orden <= @total
  BEGIN
    SELECT @titulo = titulo FROM @cambios WHERE orden = @orden;
    IF NOT EXISTS (SELECT 1 FROM dbo.APP_CAMBIOS WHERE titulo = @titulo)
    BEGIN
      SELECT @ultimo = ISNULL(MAX(CAST(RIGHT(codigo, 3) AS INT)), 0)
      FROM dbo.APP_CAMBIOS WITH (UPDLOCK, HOLDLOCK)
      WHERE codigo LIKE 'CC-' + @anio + '-[0-9][0-9][0-9]';

      INSERT INTO dbo.APP_CAMBIOS
        (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
         estado, a_posteriori, registrado_por)
      SELECT 'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.20.1',
        titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
        'REGISTRADO', 0, N'migración 033'
      FROM @cambios WHERE orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 033 (versión 2.20.1)', N'migración 033');
    END;
    SET @orden += 1;
  END;
END;
