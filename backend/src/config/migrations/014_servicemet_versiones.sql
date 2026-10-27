-- ========================================================================
-- MIGRACIÓN 014: VERSIONES DE SERVICEMET Y SU APROBACIÓN
-- ========================================================================
-- NB/ISO/IEC 17025:2018, 7.11.2: cada versión de ServiceMET (la app de
-- calibración y soporte en los teléfonos) se documenta, se valida y la
-- aprueba el jefe de Calibración antes de ponerse en uso.
--
-- CAL_SERVICEMET_VERSIONES : cada versión con sus cambios, su validación, la
--                            decisión del jefe de Calibración y su puesta en
--                            uso.
-- CAL_SERVICEMET_HISTORIAL : cada paso y edición de una versión, con lo
--                            anterior y lo nuevo.
--
-- Siembra las versiones del historial de ServiceMET
-- (lib/screens/calidad/data/historial_versiones.dart) como registradas a
-- posteriori: ya se liberaron y les falta la validación y la aprobación. Las
-- que tienen registro de validación en docs/iso17025/validaciones lo citan.
--
-- También registra en Control de cambios los cambios de DataMET+ 2.15.0.
-- Es idempotente.
-- ========================================================================

SET XACT_ABORT ON;

IF OBJECT_ID('dbo.CAL_SERVICEMET_VERSIONES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_SERVICEMET_VERSIONES (
    id                    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_SERVICEMET_VERSIONES PRIMARY KEY,
    -- Versión y build tal como figuran en pubspec.yaml de ServiceMET («6.4.1+19»).
    version               VARCHAR(30)    NOT NULL CONSTRAINT UQ_CAL_SERVICEMET_VERSIONES_Version UNIQUE,
    fecha_version         DATE           NOT NULL,
    commit_ref            VARCHAR(40)    NULL,
    -- A: crítico (captura, cálculos, esquema, subida o seguridad);
    -- B: funcional (flujos o pantallas); C: menor (textos, estilos, compilación).
    clase                 CHAR(1)        NOT NULL,
    resumen               NVARCHAR(1000) NOT NULL,
    -- Listas en JSON: ["…", "…"].
    nuevo                 NVARCHAR(MAX)  NULL,
    corregido             NVARCHAR(MAX)  NULL,
    impacto_registros     NVARCHAR(2000) NULL,
    -- Documento con las pruebas de la versión (VAL-6.4.1+19).
    registro_validacion   NVARCHAR(60)   NULL,
    estado                VARCHAR(20)    NOT NULL CONSTRAINT DF_CAL_SERVICEMET_VERSIONES_Estado DEFAULT 'REGISTRADA',
    validacion            NVARCHAR(2000) NULL,
    validacion_resultado  VARCHAR(20)    NULL,
    validado_por          NVARCHAR(50)   NULL,
    validado_en           DATETIME2      NULL,
    -- Decisión del jefe de Calibración: aprobada para uso o no aprobada.
    decision_obs          NVARCHAR(500)  NULL,
    decidido_por          NVARCHAR(50)   NULL,
    decidido_nombre       NVARCHAR(120)  NULL,
    decidido_cargo        NVARCHAR(60)   NULL,
    decidido_en           DATETIME2      NULL,
    -- Desde cuándo la usan los técnicos y en qué teléfonos.
    en_uso_desde          DATE           NULL,
    dispositivos          NVARCHAR(500)  NULL,
    puesta_obs            NVARCHAR(500)  NULL,
    puesta_por            NVARCHAR(50)   NULL,
    puesta_en             DATETIME2      NULL,
    -- Registrada después de liberarse (versiones anteriores a este control).
    a_posteriori          BIT            NOT NULL CONSTRAINT DF_CAL_SERVICEMET_VERSIONES_Posteriori DEFAULT 0,
    registrado_por        NVARCHAR(50)   NULL,
    registrado_en         DATETIME2      NOT NULL CONSTRAINT DF_CAL_SERVICEMET_VERSIONES_Registrado DEFAULT SYSUTCDATETIME(),
    actualizado_por       NVARCHAR(50)   NULL,
    actualizado_en        DATETIME2      NULL,
    CONSTRAINT CK_CAL_SERVICEMET_VERSIONES_Clase CHECK (clase IN ('A', 'B', 'C')),
    CONSTRAINT CK_CAL_SERVICEMET_VERSIONES_Estado CHECK (estado IN ('REGISTRADA', 'VALIDADA', 'APROBADA', 'EN_USO', 'RECHAZADA')),
    CONSTRAINT CK_CAL_SERVICEMET_VERSIONES_Resultado CHECK (validacion_resultado IS NULL OR validacion_resultado IN ('CONFORME', 'NO_CONFORME')),
    -- Solo se usa una versión con validación conforme y aprobada.
    CONSTRAINT CK_CAL_SERVICEMET_VERSIONES_Aprobada CHECK (
      estado NOT IN ('APROBADA', 'EN_USO') OR (validacion_resultado = 'CONFORME' AND decidido_por IS NOT NULL)
    ),
    CONSTRAINT CK_CAL_SERVICEMET_VERSIONES_EnUso CHECK (estado <> 'EN_USO' OR en_uso_desde IS NOT NULL)
  );
END;

IF OBJECT_ID('dbo.CAL_SERVICEMET_HISTORIAL', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CAL_SERVICEMET_HISTORIAL (
    id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAL_SERVICEMET_HISTORIAL PRIMARY KEY,
    version_id  INT           NOT NULL CONSTRAINT FK_CAL_SERVICEMET_HISTORIAL_Version REFERENCES dbo.CAL_SERVICEMET_VERSIONES (id),
    accion      VARCHAR(20)   NOT NULL,
    detalle     NVARCHAR(400) NULL,
    antes       NVARCHAR(MAX) NULL,
    despues     NVARCHAR(MAX) NULL,
    usuario     NVARCHAR(50)  NULL,
    fecha       DATETIME2     NOT NULL CONSTRAINT DF_CAL_SERVICEMET_HISTORIAL_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_CAL_SERVICEMET_HISTORIAL_Accion CHECK (accion IN (
      'REGISTRO', 'EDICION', 'VALIDACION', 'APROBACION', 'RECHAZO', 'PUESTA_EN_USO'
    ))
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.CAL_SERVICEMET_HISTORIAL') AND name = 'IX_CAL_SERVICEMET_HISTORIAL_Version'
)
BEGIN
  EXEC('CREATE NONCLUSTERED INDEX IX_CAL_SERVICEMET_HISTORIAL_Version
    ON dbo.CAL_SERVICEMET_HISTORIAL (version_id, fecha DESC);');
END;

-- ─── Versiones ya liberadas ────────────────────────────────────────────────
DECLARE @semilla TABLE (
  version              VARCHAR(30),
  fecha_version        DATE,
  commit_ref           VARCHAR(40),
  clase                CHAR(1),
  resumen              NVARCHAR(1000),
  nuevo                NVARCHAR(MAX),
  corregido            NVARCHAR(MAX),
  impacto_registros    NVARCHAR(2000),
  registro_validacion  NVARCHAR(60)
);

INSERT INTO @semilla VALUES
  (N'6.1.0+8', '2026-08-12', '4740593', 'A',
   N'Nueva experiencia de inicio, subida directa a DataMET y recuperación de trabajos pendientes.',
   N'["Rediseño del inicio de sesión, del inicio y de las pantallas de servicio.","Validación y subida de todos los módulos de soporte al servidor.","Conexión al servidor con certificado fijado.","Recuperación de calibraciones y servicios de soporte pendientes.","Finalización de servicios sin exportar CSV."]',
   NULL,
   N'Los registros se suben directamente a DataMET mediante la API, que valida y asigna el código de registro.',
   NULL),
  (N'6.1.1+9', '2026-08-14', 'f7c176d', 'A',
   N'Tipo de servicio en la subida y manejo de balanzas nuevas.',
   N'["La subida registra el tipo de servicio en el resumen general.","Las balanzas nuevas se suben y se señalan para completarlas en DataMET."]',
   N'["Resúmenes y formularios de la versión 6.1.0."]',
   N'El resumen general guarda tipo_servicio (script 005); las balanzas nuevas quedan con estado BALANZA NUEVA.',
   NULL),
  (N'6.2.0+10', '2026-08-17', '7213956', 'A',
   N'Prevención de duplicados y normalización de datos de soporte.',
   N'["Se evitan servicios y cargas duplicados por módulo y OTST."]',
   N'["Fechas e indicadores de soporte se normalizan por módulo.","Se retiraron los permisos de fotos, video y almacenamiento total de Android."]',
   N'Las fechas e indicadores de soporte se guardan con un formato único; no se admiten duplicados por módulo y OTST.',
   NULL),
  (N'6.3.1+13', '2026-09-18', '6273e8f', 'A',
   N'Recuperación de registros desde bases .db y ajustes de soporte.',
   N'["Importación de bases .db desde Respaldo, con vista previa de lo que se recupera.","Comentarios de instalación de hasta 1000 caracteres.","Interruptor para marcar todos los campos como \"No aplica\" en soporte."]',
   N'["Diagnóstico y mantenimiento correctivo guardan el estado del servicio.","La precarga cierra la conexión antes de reemplazar la base."]',
   N'Diagnóstico y correctivo registran estado_servicio; los comentarios de instalación admiten 1000 caracteres (script 010).',
   NULL),
  (N'6.3.3+15', '2026-09-24', 'bf004af', 'A',
   N'Lectura del indicador con la cámara, teclado numérico propio y asistente de calibración unificado.',
   N'["Lectura del indicador de la balanza con la cámara, incluidos los displays de 7 segmentos.","Teclado numérico propio con navegación entre campos.","Revisión de datos pendientes antes de finalizar y nuevo selector de pesas patrón con su vigencia.","Visor de fotografías con opciones de compartir y guardar.","Notificaciones de servicios y vencimientos con icono y canales propios.","En soporte, el código QR selecciona cliente, planta e instrumento.","Indicador de guardado automático en el asistente."]',
   N'["La carga de excentricidad admite decimales.","La subida ya no envía al servidor columnas de progreso local.","\"Balanza Calibrada\" significa lo mismo en toda la app.","Continuar una calibración o un servicio de soporte pendiente recupera fotos, balanza y pruebas iniciales.","El mantenimiento correctivo avisa cuando no pudo guardar.","Las indicaciones vuelven a replicar la carga."]',
   N'La carga de excentricidad se guarda con decimales (requiere el script 011 en DataMET). Se reorganizó el guardado del asistente de calibración.',
   NULL),
  (N'6.3.4+16', '2026-10-05', '8825ff7', 'A',
   N'Recepción de instrumentos (RIM) con las firmas del cliente y de Métrica, oportunidades en Bitrix24, soporte técnico con la misma seguridad que la calibración, fotos sin entrar a Editar y nueva navegación.',
   N'["Sección \"Calidad y normativa\" en la pestaña Otros de la barra inferior: tablero de cumplimiento NB/ISO/IEC 17025, manual de uso interactivo e historial de versiones.","Exportación en PDF de la matriz de cumplimiento, el manual y el historial de versiones.","Soporte técnico: teclado numérico propio y lectura del indicador con la cámara en excentricidad, repetibilidad y linealidad (también la carga sustitutiva), como en calibración. Atrás cierra primero el teclado.","Registro de oportunidades comerciales en Bitrix24 (CRM › Prospectos) desde calibración y soporte, sin salir del servicio. No modifica los registros técnicos.","Calibración y soporte técnico: título centrado con el paso actual debajo; ≡ abre la lista de pasos, marca los completos y lleva a cualquiera habilitado (reemplaza a la barra de pasos). \"Anterior\" y el gesto Atrás retroceden un paso y nunca sacan del servicio; ⋮ reúne \"Registrar oportunidad comercial\" y \"Salir (queda guardado)\", que guarda antes de cerrar.","Recepción de instrumentos de pesaje (RIM) desde calibración y soporte: ⋮ › \"Emitir RIM (recepción de instrumento)\". El cliente, la planta y el instrumento se toman del servicio; el técnico registra el inventario, los daños, la suciedad y el motivo, y firman en la pantalla, a pantalla completa, el cliente y el representante de Métrica. El RIM queda guardado en el teléfono, con su PDF, y no se modifica: si tiene un error se anula con motivo.","La app sugiere el RIM cuando el servicio de una balanza se corta: al salir a medias y al descartar un servicio pendiente. Después de emitirlo, \"Cambiar de balanza\" cierra esa balanza sin concluirla y permite seguir con otra en la misma SECA u OTST.","Servicios reúne los formularios adicionales: \"Recepción de instrumentos (RIM)\" y \"Oportunidades comerciales\" (antes en Precarga), con sus pendientes de enviar.","RIM y oportunidades también fuera de un servicio: en Servicios, \"Nuevo RIM\" y \"Nueva oportunidad\" abren una selección rápida de cliente, planta e instrumento (o el código QR del instrumento). El RIM admite un instrumento no registrado, con código provisional. Estos registros se guardan como \"Registro directo\".","Oportunidades sin conexión: se registran con el cliente de ServiceMET y quedan pendientes. Al volver la conexión con el servidor la app les asigna la empresa de Bitrix24 (la elegida antes para ese cliente o una coincidencia exacta de nombre) y las envía sola; si no hay una coincidencia segura, pide que el técnico la elija. Reemplaza al botón \"Guardar pendiente\".","Fotos de calibración y soporte técnico sin entrar a Editar: en \"Registros\" cada balanza muestra sus fotos en miniatura; \"+N\" o el menú › \"Ver fotos\" las reúne por sección, y el visor permite deslizar, acercar, saltar con la tira de miniaturas, compartir y guardar. Ver las fotos no modifica el registro. El detalle del registro muestra las fotos en lugar de sus rutas en el teléfono.","Nueva barra de navegación inferior: una cápsula más angosta que flota sobre la pantalla, clara u oscura según el tema, con íconos nuevos; la pestaña abierta se resalta en gris con su nombre y las demás muestran solo su ícono.","Íconos nuevos en toda la app: una sola familia de línea fina y redondeada en lugar de los íconos de Material y Font Awesome. No cambia ningún flujo ni ningún dato."]',
   N'["Soporte técnico con la misma seguridad que la calibración: se avanza solo con el paso completo y guardado en el teléfono; un paso adelante se abre solo con los anteriores completos, y \"Finalizar\" revisa todos los pasos y lleva al primero incompleto (antes revisaba solo el actual y se podía finalizar con pasos saltados). Las pruebas de excentricidad, repetibilidad y linealidad marcadas como realizadas se exigen con todas sus lecturas.","Soporte técnico: Relevamiento de datos exige inspección, pruebas y cierre (antes se podía finalizar vacío); al continuarlo recupera la repetibilidad y las posiciones de excentricidad en su lugar. El panel ≡ marca como completos los pasos llenos también al reabrir el servicio.","Soporte técnico: al elegir otra balanza se cierra el servicio recién finalizado, que antes quedaba abierto debajo y aceptaba cambios.","Calibración: de Inspección en adelante los pasos se abren con el instrumento confirmado."]',
   N'Nuevos registros en la base servicios_extras: RIM (form_rim, con las firmas del cliente y del representante de Métrica) y copia de cada oportunidad registrada en Bitrix24 (form_bitrix). Requiere ejecutar el script 012 antes de desplegar el backend. En soporte técnico, cada paso debe quedar completo y guardado para avanzar.',
   NULL),
  (N'6.3.5+17', '2026-10-15', '3692570', 'A',
   N'Ubicación de cada servicio, ficha del instrumento con los rangos de menor a mayor, balanzas nuevas que se suben con su código definitivo, registros de solo lectura y aviso antes de cada permiso.',
   N'["Ubicación de cada servicio de calibración y de los 8 módulos de soporte: al guardar la balanza se toma una vez la ubicación del teléfono (latitud, longitud, precisión y hora). Si el servicio se continúa en otro lugar, se conserva la primera. Se envía al subir, aparte del registro técnico.","Permisos: antes de cada solicitud del teléfono (ubicación, notificaciones y cámara) la app muestra su propio aviso; ninguno se pide en silencio. Sin permiso de ubicación, o con la ubicación del teléfono apagada, no se puede iniciar ni continuar un servicio: aparece \"Ubicación requerida\".","Ficha del instrumento, en el paso Instrumento y en el botón ámbar de información (calibración y soporte): código, estado (catálogo o nueva), datos clave, escala de capacidades y tabla de rangos. El Rango 1 es siempre el de menor capacidad; es solo visual, los datos guardados no cambian.","Paso Instrumento con los campos agrupados, rangos editables de menor a mayor y \"Agregar rango\". La búsqueda de balanzas muestra su capacidad.","Balanzas nuevas en la subida: aparecen aparte con los pasos a seguir y \"Asignar código\". Se suben solo con el código métrica que asignó DataMET; mientras tanto se pueden subir las balanzas ya registradas. Al asignarlo, la app avisa si no corresponde al cliente y la planta, si ya lo tiene otra balanza del servicio y si figura en la precarga.","Registros de solo lectura: se retiró \"Editar\". El detalle muestra \"Historial de cambios\" cuando al registro se le asignó el código de una balanza nueva, y las balanzas nuevas llevan la marca \"Nueva\"."]',
   N'["Las notificaciones ya no se piden al abrir la app sin aviso: se piden desde el inicio, después del aviso de la app.","La \"Información del instrumento\" de calibración y la de soporte mostraban los rangos en el orden guardado; ahora van de menor a mayor capacidad."]',
   N'Cada registro de calibración y soporte guarda su ubicación en el teléfono, y el resumen DATA_SERVICIOS_DATOS la recibe en latitud, longitud, precision_gps y fecha_gps (requiere el script 013 antes de desplegar el backend; lo subido desde versiones anteriores queda sin coordenadas). Las balanzas nuevas ya no se suben con código provisional. Asignar el código definitivo es la única corrección de un registro técnico, y queda en la tabla auditoria_registros con el valor anterior, el nuevo, el usuario, la fecha, el motivo y la versión de la app.',
   N'VAL-6.3.5+17'),
  (N'6.4.0+18', '2026-10-19', '8b18cb6', 'A',
   N'RIM con código único RIM-AA-NNNN por talonarios, RIM anulados que se suben con su anulación, y los RIM guardados en DataMET.',
   N'["RIM con código único RIM-AA-NNNN (gestión y número), igual para calibración, soporte, registro directo y DataMET+. El teléfono recibe del servidor talonarios de números (al abrir la app, al volver la conexión o desde el formulario) y los usa en orden aunque no tenga red, así el cliente firma con el código definitivo. Sin números, el formulario muestra \"Sin números de RIM en este teléfono\" y no deja emitir. Los RIM ya emitidos conservan su código anterior.","RIM anulado antes de subirse: se sube marcado como anulado, con quién, cuándo y por qué, para que su número no quede como un hueco. Un RIM ya subido se anula en DataMET+ (Registros RIM), donde también se registran su ejecución en Soporte Técnico y su entrega al cliente."]',
   N'["Soporte técnico (servidor): las cargas de repetibilidad con decimales (525.5 kg) de Mantenimiento preventivo avanzado, Mantenimiento preventivo regular y Relevamiento de datos ya se aceptan; antes el servidor rechazaba esos servicios. La app no cambia; requiere el script 015."]',
   N'Cada RIM nuevo guarda su gestión, su número, el talonario del que salió y la instalación de la app; dos RIM no pueden compartir número (índice único en el servidor). Los RIM y la copia de las oportunidades se guardan en tablas propias dentro de DataMET (scripts 012 y 014), y los usuarios de la API y de DataMET+ tienen denegado modificarlas o borrarlas. La base local del teléfono agrega los talonarios y la numeración del RIM. Antes de distribuir la app hay que ejecutar los scripts 012, 014 y 015 en DataMET y desplegar el backend: sin ellos la app no recibe talonarios y no puede emitir RIM nuevos.',
   N'VAL-6.4.0+18'),
  (N'6.4.1+19', '2026-10-20', '646ec67', 'A',
   N'Soporte técnico: el interruptor de las pruebas metrológicas avisa y guarda en el acto, una prueba omitida ya no se guarda ni se sube, y volver a activar la linealidad ya no deja la pantalla en blanco.',
   N'["Soporte técnico: al activar u omitir una prueba metrológica con el interruptor \"Realizar ...\", la tarjeta muestra \"Activando la prueba…\" u \"Omitiendo la prueba…\" y el cambio se guarda en el acto; antes la pantalla tardaba en reaccionar, sin aviso, hasta el autoguardado. Aplica a los 7 módulos con pruebas metrológicas."]',
   N'["Soporte técnico: volver a activar la linealidad cuando tenía una sola carga (o al reabrir el servicio así) dejaba la pantalla en blanco; ahora se abre con la carga registrada. La repetibilidad reabierta con un número de lecturas que no está en la lista (por ejemplo 4) muestra la opción que las contiene.","Soporte técnico: una prueba metrológica omitida ya no guarda ni sube sus lecturas, y sigue omitida al continuar el servicio; antes, si ya tenía datos, volvía activa con ellos y podían subirse (en Relevamiento de datos se guardaban siempre). Una prueba aún sin llenar sigue activa al continuar. Además, las cargas o lecturas quitadas no dejan su valor en el registro, y al continuar vuelven las que siguen a una vacía (antes se perdían) y la repetibilidad inicial de Instalación y Verificaciones internas vuelve con sus mediciones (antes con 10). Aplica a los 7 módulos con pruebas metrológicas."]',
   N'En los 7 módulos de soporte con pruebas metrológicas, una prueba omitida queda vacía en el registro y no llega a DataMET, y tampoco las cargas o lecturas que el técnico quitó. La base local agrega a cada tabla de soporte la columna pruebas_omitidas, que no se sube; un registro guardado con una versión anterior se lee como antes. El servidor no cambia. Incluye todo lo de 6.4.0+18: si esa versión no se distribuyó, antes de distribuir esta hay que ejecutar sus scripts (012, 014 y 015) en DataMET y desplegar el backend.',
   N'VAL-6.4.1+19');

INSERT INTO dbo.CAL_SERVICEMET_VERSIONES
  (version, fecha_version, commit_ref, clase, resumen, nuevo, corregido, impacto_registros,
   registro_validacion, a_posteriori, registrado_por)
SELECT s.version, s.fecha_version, s.commit_ref, s.clase, s.resumen, s.nuevo, s.corregido,
  s.impacto_registros, s.registro_validacion, 1, N'migración 014'
FROM @semilla s
WHERE NOT EXISTS (SELECT 1 FROM dbo.CAL_SERVICEMET_VERSIONES v WHERE v.version = s.version);

INSERT INTO dbo.CAL_SERVICEMET_HISTORIAL (version_id, accion, detalle, usuario)
SELECT v.id, 'REGISTRO', N'Registrada a posteriori a partir del historial de versiones de ServiceMET', N'migración 014'
FROM dbo.CAL_SERVICEMET_VERSIONES v
WHERE NOT EXISTS (SELECT 1 FROM dbo.CAL_SERVICEMET_HISTORIAL h WHERE h.version_id = v.id);

-- ─── Control de cambios de DataMET+ ────────────────────────────────────────
-- El código sigue al último del año, sea cual sea la base; cada cambio se
-- reconoce por su título para no duplicarlo.
IF OBJECT_ID('dbo.APP_CAMBIOS', 'U') IS NOT NULL
BEGIN
  DECLARE @cambios TABLE (
    orden        INT,
    titulo       NVARCHAR(150),
    tipo         VARCHAR(20),
    modulos      NVARCHAR(200),
    descripcion  NVARCHAR(MAX),
    impacto      NVARCHAR(1000),
    referencias  NVARCHAR(1000)
  );
  INSERT INTO @cambios VALUES
    (1, N'Secciones de cada apartado en la barra lateral', 'MEJORA', N'RIM, Calibración, Soporte técnico',
     N'Cada apartado despliega sus secciones en la barra lateral (por ejemplo, Calibración: Cronograma, Equipos, Actividades, Alertas y Cumplimiento) y la barra superior nombra la sección abierta. Se quitan las pestañas repetidas dentro de RIM, Calibración y Soporte técnico.',
     N'Sin cambios en los datos ni en los permisos: solo cambia cómo se llega a cada sección.',
     N'navigation.js, Sidebar.jsx y Topbar.jsx.'),
    (2, N'Calibración: versiones de ServiceMET y su aprobación', 'MODULO', N'Calibración',
     N'Registro de cada versión de ServiceMET con sus cambios, su clase e impacto en los registros. Sistemas registra la versión y su validación; el jefe de Calibración la aprueba o la rechaza antes de usarse, y se registra desde cuándo está en uso. Muestra qué versión usa cada teléfono según los RIM y talonarios que envía, y avisa si alguna no está aprobada.',
     N'Crea CAL_SERVICEMET_VERSIONES y CAL_SERVICEMET_HISTORIAL (migración 014) y siembra las 9 versiones del historial de ServiceMET; lee form_rim y rim_talonarios sin modificarlas.',
     N'Migración 014; calibration.servicemet.js; sección Versiones ServiceMET.');

  DECLARE @anio CHAR(4) = CONVERT(char(4), YEAR(DATEADD(hour, -4, SYSUTCDATETIME())));
  DECLARE @orden INT = 1;
  DECLARE @ultimo INT;
  WHILE @orden <= 2
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM dbo.APP_CAMBIOS a JOIN @cambios c ON c.titulo = a.titulo WHERE c.orden = @orden
    )
    BEGIN
      SELECT @ultimo = ISNULL(MAX(CAST(RIGHT(codigo, 3) AS INT)), 0)
      FROM dbo.APP_CAMBIOS WITH (UPDLOCK, HOLDLOCK)
      WHERE codigo LIKE 'CC-' + @anio + '-[0-9][0-9][0-9]';

      INSERT INTO dbo.APP_CAMBIOS
        (codigo, version, titulo, tipo, modulos, descripcion, impacto, referencias, fecha_cambio,
         estado, a_posteriori, registrado_por)
      SELECT 'CC-' + @anio + '-' + RIGHT('00' + CAST(@ultimo + 1 AS varchar(10)), 3), N'2.15.0',
        c.titulo, c.tipo, c.modulos, c.descripcion, c.impacto, c.referencias,
        CAST(DATEADD(hour, -4, SYSUTCDATETIME()) AS date), 'REGISTRADO', 0, N'migración 014'
      FROM @cambios c WHERE c.orden = @orden;

      INSERT INTO dbo.APP_CAMBIOS_HISTORIAL (cambio_id, accion, detalle, usuario)
      VALUES (SCOPE_IDENTITY(), 'REGISTRO', N'Registrado con la migración 014', N'migración 014');
    END;
    SET @orden += 1;
  END;
END;
