# DataMET+

Aplicación interna de Métrica Ltda. que reúne el apartado RIM (registros, numeración y formulario), el cronograma operativo, el cronograma de calibración, los informes de soporte técnico y la administración de IvMET.

## Características

- **Formulario Completo:** Secciones organizadas para datos de balanza, cliente y técnico.
- **Validación Robusta:** Uso de Zod y React Hook Form para asegurar la integridad de datos.
- **Firmas Digitales:** Captura de firma en pantalla táctil o con mouse.
- **Evidencias:** Subida de fotos con drag & drop y previsualización.
- **Diseño minimalista:** tokens de color en `src/index.css` con tema claro y oscuro (sigue al sistema hasta que se elige uno desde la barra superior), tipografía Figtree autoalojada y vidrio solo en capas flotantes (barra superior, menús, avisos).
- **Barra lateral:** módulos, sesión y cierre de sesión; se oculta o muestra con `Ctrl+B` (`⌘B` en macOS) y en móvil se abre como panel.
- **Acceso por área:** todos ven Calibración, Soporte técnico y Gestión IvMET en la barra lateral, pero solo los usa el personal de su área (Calibración, Soporte Técnico; IvMET por ahora solo Sistemas). Sistemas, que en `DATA_USERS` es el nivel 3 (`acceso_cron = 3`), entra a todos para revisar errores. Quien no es del área ve un candado en el menú y, al abrirlo, el apartado difuminado con un aviso; el apartado no se monta ni pide datos, y el backend responde 403 (`AREA_ACCESS_DENIED`) a sus rutas (`backend/src/services/access.areas.js`).
- **Responsive:** Adaptable a dispositivos móviles y escritorio.
- **Gestión IvMET:** panel administrativo para clientes contratados, licencias, planes y revisión del catálogo sincronizado.
- **Calibración:** plan anual de calibraciones, verificaciones internas y actividades del área, con alertas en el cronograma y por correo.
- **Soporte técnico:** informes de los 8 servicios del área a partir de lo que sube ServiceMET, con el diseño de las plantillas Excel, fotografías, edición con historial, emisión y PDF; y los próximos servicios que sugieren los técnicos, con línea de tiempo, seguimiento y avisos por correo.
- **Control de cambios y registro de fallas:** historial de los cambios del sistema con su validación y aprobación, y registro de las fallas con sus acciones (NB/ISO/IEC 17025, 7.11).

## RIM (recepción de instrumentos)

El apartado RIM tiene tres pestañas:

- **Registros:** historial de los RIM de ServiceMET (calibración, soporte y
  registro directo) y del formulario web. Como en Calibración, arriba van la
  búsqueda, el botón **Filtros** (cliente, planta, área, origen y fechas de
  emisión, en un panel que se abre a pedido; los aplicados quedan como
  etiquetas que se quitan con un clic) y los chips de situación con su conteo
  (recibidos, en ejecución, concluidos, entregados y anulados). La ficha de cada RIM es de
  solo lectura: datos del cliente y del instrumento, motivo, inventario,
  estado físico, fotos, **las dos firmas** (cliente y representante de
  Métrica), su **ejecución** y su **entrega** (ver abajo) y su trazabilidad
  (quién lo emitió, cuándo llegó al servidor, versión, talonario e
  instalación). Se puede imprimir o guardar como PDF: salen la ejecución, la
  entrega con sus firmas y el historial de correcciones, sin los botones.
- **Numeración:** los talonarios de cada gestión y qué pasó con cada número:
  con RIM registrado, emitido y por subir, disponible en el teléfono o no
  utilizado.
- **Nuevo RIM:** el formulario web. Ahora registra el RIM en el servidor con
  el motivo, las dos firmas y hasta 5 fotos, recibe su número y recién
  entonces genera el PDF con ese código.

**Código único `RIM-AA-NNNN`** (`RIM-26-0042`): gestión y número, único para
todos los RIM. ServiceMET trabaja sin conexión, así que cada teléfono recibe
por adelantado talonarios de números libres; el formulario web toma el
siguiente número al registrar. Los RIM anteriores conservan su código
(`RIM-{planta}-{AA}`) y se muestran como «formato anterior» con su N.º.

**Un RIM no se edita ni se borra** (NB/ISO/IEC 17025, 7.5.2): se anula con
motivo (y, si lo hay, el código del RIM que lo reemplaza), lo que agrega una
fila en `form_rim_anulaciones`. Consultan todos los usuarios; anulan un RIM y
cierran el talonario de un teléfono perdido o reinstalado los jefes de área y
los niveles 2 y 3.

### Ejecución y entrega

Lo que pasa después de la recepción se registra desde la ficha, **sin
modificar el RIM**. Cada guardado agrega una fila con el usuario de la sesión
y la hora del servidor, que apunta a la versión que reemplaza; la anterior
queda en el historial de la ficha.

- **Ejecución** (6.2, `form_rim_ejecucion`): quién recibió en Soporte
  Técnico, fecha de ingreso, técnico asignado, fechas de inicio, informe y
  conclusión, y N.º de cotización, informe y factura. Se llena por partes:
  completar campos vacíos lo puede cualquier usuario con sesión; cambiar o
  borrar un dato ya registrado es una **corrección**, con motivo, y solo la
  hacen los jefes de área y los niveles 2 y 3. El servidor decide cuál es
  comparando con la versión vigente.
- **Entrega** (6.3, `form_rim_entregas`): quién recibe por el cliente, quién
  entrega por Métrica, fecha, lugar, observaciones y **las dos firmas en
  pantalla** (obligatorias). La registra cualquier usuario con sesión; la
  corrigen (las firmas se conservan) o la anulan con motivo los jefes de área
  y los niveles 2 y 3. Anulada, puede registrarse la entrega correcta.
- Las fechas no pueden ser futuras ni anteriores a la emisión del RIM; el
  inicio no va antes del ingreso, ni el informe o la conclusión antes del
  inicio. La entrega no exige la ejecución concluida, y la ejecución puede
  completarse después de entregar (la factura suele llegar después).
- En un RIM anulado ya no se registra nada; lo registrado sigue visible.
- Si dos personas guardan a la vez sobre la misma versión, la segunda recibe
  un aviso y la ficha se recarga (índices únicos en la base).
- La etapa del historial sale de la última versión: **entregado** (entrega
  vigente), **concluido** (fecha de conclusión), **en ejecución** (algún dato)
  o **recibido**.

Los datos viven en DataMET, la misma base de DataMET+ (`DB_DATABASE`;
`DataMET_prueba` en pruebas), en las tablas que crean los scripts 012, 014 y
016 de ServiceMET. No se usa ninguna otra base; la variable `RIM_DB_NAME` ya
no existe y, si quedó en el `.env`, se ignora con un aviso. Rutas:

- `GET /api/rim/registros` (filtros `q`, `cliente`, `planta`, `desde`,
  `hasta`, `area`, `origen`, `estado`, `etapa`, `page`, `pageSize`),
  `GET /api/rim/registros/filtros`, `GET /api/rim/registros/:n`
- `POST /api/rim/registros/:n/anulacion`, `POST /api/rim/registros`
- `POST /api/rim/registros/:n/ejecucion` (`anteriorId`, los nueve campos y,
  si corrige, `motivo`) y `POST /api/rim/registros/:n/entrega` (`accion`:
  `registro` con `firmaCliente` y `firmaRepresentante`, `correccion` o
  `anulacion` con `motivo`); ambas responden la ficha actualizada.
- `GET /api/rim/talonarios?gestion=`, `POST /api/rim/talonarios/:id/cierre`

Orden de despliegue (junto con ServiceMET):

1. En DataMET, los scripts de ServiceMET
   `backend/sql/012_create_form_rim_y_form_bitrix.sql`,
   `014_rim_numeracion_y_gestion.sql` y `016_rim_ejecucion_y_entrega.sql`, en
   ese orden, con `@loginDataMetPlus` igual al `DB_USER` de DataMET+ en el 014
   y el 016. Dan `SELECT`/`INSERT` (y `EXECUTE` en `rim_reservar_talonario`) y
   deniegan `UPDATE` y `DELETE` en todas las tablas del RIM; al final muestran
   los permisos efectivos y avisan si algún usuario todavía puede modificar
   (por ejemplo, por ser `db_owner`).
2. El backend de ServiceMET.
3. DataMET+: backend y frontend (`pnpm build`).
4. La versión de la app ServiceMET que numera el RIM.

Sin los scripts 012 y 014, el apartado responde que las tablas de los RIM no
están listas.
Sin el 016, el historial y la ficha se ven igual, pero sin etapa, y la ficha
avisa que falta el script en lugar de mostrar la ejecución y la entrega.

## Calibración

Módulo independiente del cronograma del personal. Gestiona los equipos de
`DATA_EQUIPOS_CAL` y guarda su planificación e historial en tablas `CAL_*`
(migraciones `004` a `006`, aplicar con `pnpm migrate` en `backend`).

- **Calibración:** la fecha sale del certificado: `cert_fecha + cert_periodo`
  (días). No se usa `cert_fechaven` porque en varios registros está vacía o
  repite la emisión. Al registrar un certificado nuevo el plan se recalcula.
- **Verificación interna:** por equipo, cada N meses contando desde cada
  calibración o desde una fecha fija. Se omite si cae a menos de 14 días de la
  recalibración; las fechas que dependen de una calibración futura se muestran
  como estimadas y no generan avisos.
- **Actividades del área:** tareas propias (p. ej. revisar documentos legales en
  Fundaempresa o la política de calidad), únicas o periódicas.
- **Vistas:** año (línea de tiempo con la vigencia del certificado), mes y
  agenda; además pestañas de equipos (configuración individual o por lote),
  actividades y alertas.
- **Seguimiento:** cada fecha puede marcarse en proceso, realizada (con
  resultado en verificaciones), reprogramada o cancelada.
- **Permisos:** consultan y editan el área Calibración y Sistemas (nivel 3);
  el resto del personal ve el apartado bloqueado y el backend rechaza sus
  consultas.

### Equipos y certificados

Desde la pestaña Equipos y la ficha de cada equipo:

- **Alta:** registra el equipo en `DATA_EQUIPOS_CAL` con sus convenciones: el
  `id` es el siguiente número (la tabla no tiene clave), `reg_usuario` son las
  iniciales de `DATA_USERS`, el código se guarda en mayúsculas y no se repite.
  El certificado inicial es opcional.
- **Certificado nuevo:** la renovación reemplaza el vigente en
  `DATA_EQUIPOS_CAL` (con `cert_fechaven` calculado) y el anterior queda en
  `CAL_CERTIFICADOS`. Debe ser posterior al vigente y no futuro. También se
  registra desde una calibración pendiente del cronograma.
- **Corregir / anular:** corregir arregla el vigente sin crear otro; anular
  lo descarta con motivo y vuelve a regir el anterior.
- **Baja / reactivación:** la baja (`estado = 'DESACTIVADO'`) saca el equipo
  del plan y de las alertas; su historial se conserva.
- **Historial:** certificados, verificaciones realizadas y cada cambio
  (`CAL_EQUIPOS_HISTORIAL`).

Si otro sistema cambia el certificado directamente en `DATA_EQUIPOS_CAL`, el
módulo lo archiva como `EXTERNO` antes de reemplazarlo.

### Trazabilidad de los registros (NB/ISO/IEC 17025, 7.5)

Migración `006`:

- **Versiones de cada fecha:** cada cambio de estado, resultado, hoja de datos
  o reprogramación queda en `CAL_EVENTOS_HISTORIAL` con la versión anterior y
  la nueva completas, quién y cuándo. Cambiar una fecha que ya figuraba como
  realizada exige el motivo; «Restablecer» deja la última versión en el
  historial antes de volver a la programación original.
- **Verificaciones:** al registrarla como realizada se exigen el resultado y la
  hoja o el archivo donde quedaron sus datos (`registro_ref`).
- **Revisión por un segundo usuario:** certificados y verificaciones los
  revisa otra persona; el sistema impide que lo haga quien los registró o
  corrigió. Si los datos cambian, la revisión vuelve a quedar pendiente.
- **Corrección de certificados:** exige el motivo y conserva la versión
  anterior completa (observaciones incluidas) en `CAL_EQUIPOS_HISTORIAL`.
- **Configuración del plan:** frecuencias, responsables, avisos y actividades
  guardan cada versión en `CAL_PLAN_HISTORIAL`.

La ficha de cada equipo une en su actividad los cambios del equipo, de su plan
y de sus fechas; la de cada actividad, los de su configuración y sus fechas.

### Cumplimiento NB/ISO/IEC 17025

La pestaña **Cumplimiento** (área Calibración y Sistemas) evalúa el módulo frente
a la NB/ISO/IEC 17025:2018 (acreditación DTA-IBMETRO), puntos **7.5** registros
técnicos, **7.11** control de los datos y gestión de la información y **8.4**
control de registros. Cada vez que se abre, `GET /api/calibracion/cumplimiento`
reúne datos con consultas de solo lectura (integridad de `DATA_EQUIPOS_CAL`,
historial, migraciones registradas, respaldos de `msdb`, configuración del
servidor) y marca cada requisito como cumple, parcial, no cumple o «del
laboratorio» (falta evidencia que no vive en el software), con su evidencia,
lo que falta y un plan de acción por prioridad.

El catálogo de requisitos está en `backend/src/services/calibration.compliance.js`
y sus reglas en la skill `.claude/skills/nb-iso-17025`: cuando un cambio
resuelva una brecha, actualiza el catálogo y sus pruebas. Los requisitos están
resumidos con palabras propias; ante una duda manda el texto de la norma.

### Alertas

Cada serie usa los avisos generales o los suyos propios: días de anticipación y
frecuencia (una vez, semanal, diaria o sin alertas). Las fechas en aviso y las
vencidas aparecen en «Requieren atención» y en el contador de la barra lateral.
Por correo, cada día a la hora configurada se envía un resumen al responsable
de cada serie (si su correo está registrado en el módulo) y a quienes reciben
todas las alertas. `CAL_ALERTAS_ENVIOS` registra cada aviso para no repetirlo
antes de tiempo.

Por ahora la configuración de correo (destinatarios, servidor, frecuencia, hora
e historial) está oculta en la interfaz con `EMAIL_ALERTS_UI = false` en
`src/features/calibration/domain/format.js`; el envío del backend sigue
intacto. Ponerla en `true` la vuelve a mostrar.

Variables del backend (sin `SMTP_HOST` las alertas solo se ven en la app):

```dotenv
SMTP_HOST=smtp.ejemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<usuario>
SMTP_PASSWORD=<clave>
SMTP_FROM="Calibración Métrica <calibracion@ejemplo.com>"
CAL_ALERTS_ENABLED=true
APP_URL=http://<servidor>:3000
```

## Soporte técnico

Reemplaza los libros Excel con macros del área (IMPR, IMPA, IDIG/IMCR,
INST, AJML, IREL): cada servicio que el técnico sube desde ServiceMET aparece
en la lista y su informe se revisa, se completa, se emite y se imprime desde
la aplicación (migración `008`, rutas `/api/soporte/*`).

| Servicio | Tabla de ServiceMET | Plantilla | PDF |
|---|---|---|---|
| Mantenimiento preventivo regular | `DATA_SERVICIOS_DATOS_MPR_STIL` | IMPR | `IMPR-…` |
| Mantenimiento preventivo avanzado | `DATA_SERVICIOS_DATOS_MPA_STAC` | IMPA | `IMPA-…` |
| Mantenimiento correctivo | `DATA_SERVICIOS_DATOS_MCR` | IMCR | `IMCR-…` |
| Diagnóstico | `DATA_SERVICIOS_DATOS_DIG` | IDIG | `IDIG-…` |
| Instalación | `DATA_SERVICIOS_DATOS_INT` | INST | `INST-…` |
| Verificación con IBMETRO | `DATA_SERVICIOS_DATOS_IBM` | AJML (Ajuste Metrológico en Linealidad) | `AJML-…` |
| Verificaciones internas | `DATA_SERVICIOS_DATOS_VFI` | sin plantilla Excel: mismo diseño | `IVFI-…` |
| Relevamiento de datos | `DATA_SERVICIOS_DATOS_RVD` | IREL | `IREL-…` |

- **Lista:** un informe por servicio vigente (si ServiceMET volvió a subirlo,
  cuenta la fila `ACTIVO`), con búsqueda (OTST, número de informe, cliente,
  serie…), tipo de servicio, filtros de cliente, técnico y fechas, y chips de
  estado: **pendiente** (solo datos de ServiceMET), **borrador** (revisado o
  corregido, sin emitir) y **emitido**.
- **Agrupar por:** **OTST** (por omisión, como se elegía en el Excel: cliente,
  planta, fechas, técnicos y servicios de la orden; sus informes en el orden
  de los instrumentos), **técnico** (OTST, clientes y último servicio) o sin
  agrupar. Cada grupo muestra cuántos informes tiene y cuántos están
  emitidos, y carga sus informes al abrirlo (de a 50). Al buscar y quedar uno
  o dos grupos, se abren solos; al volver de un informe se conservan la
  agrupación y los grupos abiertos. El técnico se agrupa y se filtra sin
  título, punto final ni inicial del segundo apellido, porque ServiceMET lo
  registra con variantes («Aux. Elvis Villca .» y «Tec. Elvis Villca .»,
  «Tec. Jhonatan Barrau» y «Tec. Jhonatan Barrau F.»).
- **Número de informe:** como en las macros, la OTST y los 3 últimos dígitos
  del código Métrica (`26-0285-51-S01-002`).
- **Editor:** formulario por secciones, en el orden del informe, con vista
  previa al lado (debajo de 1280 px, en su pestaña). Los estados se marcan con
  los mismos símbolos del informe; cada dato corregido muestra el valor que
  subió el técnico y se puede restaurar. En las pruebas se elige la forma de
  la plataforma y las posiciones, con el diagrama a la vista. `Ctrl+S` guarda.
- **Revisión antes de emitir** (`domain/avisos.js`, con pruebas): al emitir se
  listan los datos que faltan o parecen incompletos, y cada aviso lleva a su
  sección. No impide emitir. Revisa datos del cliente e instrumento, d, e (en
  el avanzado) y unidades, textos vacíos o de relleno (menos de 15
  caracteres), pruebas sin lecturas o sin carga, puntos de linealidad a
  medias, valores que no son números, **lecturas que se apartan más del 10 %
  de su carga** (p. ej. 99.997 g con una carga de 10 g), retorno a cero y
  estabilidad, parámetros sin estado, la fecha del próximo servicio, la
  conclusión, el técnico y las fotos.
- **Redacción con IA:** en los textos largos (observaciones, conclusiones,
  reporte de falla, evaluación técnica y trabajo realizado) el botón «Mejorar
  redacción» pide a Google Gemini una
  versión corregida: solo ortografía, puntuación y estilo técnico, sin
  cambiar cifras, unidades ni nombres ni agregar datos. El técnico la usa o
  la descarta; usada, el historial marca ese cambio con «IA». Solo se envían
  el texto, el tipo de servicio y el nombre de la sección (ni cliente ni
  instrumento). La clave vive solo en el backend (ver Despliegue).
- **Informe:** hojas A4 con la cuadrícula de 33 columnas de las plantillas,
  su membrete, colores y tipografía (Century Gothic). Las valoraciones se
  imprimen como símbolo: ✓ bueno, ⚠ regular, ✗ malo y ⊘ no aplica (también
  «Aceptable», «Sí», «Se intentó» y «No» de los ajustes); la leyenda dice
  «Regular» en todas las plantillas y un ajuste «No aplica» queda en blanco.
  Las tablas de lecturas imprimen solo las filas con datos. Se pagina solo y
  respeta los saltos de hoja de cada plantilla. Cada hoja lleva al pie el
  número de informe, la revisión, quién lo emitió y cuándo (o «Borrador sin
  emitir») y «Página n de N»; la última, «Fin del informe». «Imprimir»
  abre el diálogo del navegador con el nombre de archivo de las macros
  (`IMPR-<informe>-<cliente>-<instrumento>-<capacidad>-<unidad>-<código interno>`).
  Sin emitir, cada hoja lleva la marca «BORRADOR». Las barras van en azul
  `#1F4E79` (el «Azul, Énfasis 1, más oscuro 50 %» de Excel) para que no se
  vean celestes al imprimir.
- **Guardar PDF:** genera el archivo con las mismas hojas de la vista previa
  (cada hoja como imagen de unos 290 ppp, 0,3–1 MB por hoja) y el nombre de
  las macros. Cada hoja se pasa a imagen con las reglas CSS de la página
  (`components/rasterizar.js`): el navegador la vuelve a acomodar dentro de
  la imagen, como al imprimir, en vez de copiar las medidas de la pantalla
  (así una fuente que el navegador dibuja algo más ancha no parte líneas ni
  monta textos). El PDF se arma sin librerías (`domain/pdf.js`). En un sitio seguro (HTTPS o `localhost`) pregunta dónde
  guardarlo y el navegador recuerda la última carpeta; por HTTP con una IP
  el navegador no lo permite y el PDF se descarga (para elegir la carpeta,
  activar «Preguntar dónde guardar cada archivo antes de descargarlo» en
  Chrome o Edge). Se habilita con los cambios guardados. El texto del PDF
  guardado no se puede seleccionar; para un PDF con texto, «Imprimir» →
  «Guardar como PDF».
- **Diagramas de excentricidad** (`domain/plataforma.js`): la plataforma
  (cuadrada, rectangular, circular o triangular) con las posiciones
  numeradas y el indicador, como la dibuja ServiceMET. En la báscula de
  camión, el puente con la ida arriba y la vuelta abajo y la lectura de cada
  posición. La plantilla IMPA tenía intercambiadas las posiciones 4 y 6
  respecto de ServiceMET; el diagrama sigue a ServiceMET.
- **Cálculos** (`src/features/soporte/domain/calculos.js`, con pruebas): diferencia
  máxima de excentricidad y repetibilidad (máx − mín), error de linealidad
  (indicación − carga) y error máximo (mayor |error|), en unidades y en
  divisiones (÷ d; ÷ e en el preventivo avanzado). En un instrumento de
  varios rangos cada carga se divide por la d (o e) del rango que la cubre;
  la linealidad en divisiones es el mayor |error|/división de sus puntos. Si
  falta e, se usa d y el informe lo indica («Diferencia Maxima (d)»). Los
  decimales salen de la d más fina (0.01 → 2). Las macros IMCR y AJML
  restaban al revés (carga − indicación): el error máximo no cambia, solo el
  signo de cada punto.
- **Preventivo regular:** además de lo de la macro, el informe muestra las
  conclusiones del técnico, el estado final y si hubo personal de apoyo
  cuando ServiceMET los registra.
- **Fotografías:** hasta 12 por informe, en hojas de 6 con su descripción
  (como la hoja FOTOGRAFIAS); se reducen a 1400 px en el navegador.
- **Permisos:** usan el apartado (consultar, editar, subir fotos, emitir,
  imprimir y guardar PDF) el área Soporte Técnico y Sistemas (nivel 3); el
  resto del personal lo ve bloqueado y el backend rechaza sus consultas.

### Trazabilidad (NB/ISO/IEC 17025, 7.5.2)

Las filas de `DATA_SERVICIOS_DATOS_*` son las observaciones originales del
técnico y **no se modifican**. Lo corregido se guarda en `ST_INFORMES.datos`
(campo → valor) y se superpone al original; un campo que vuelve a su valor
original deja de figurar como corregido. Cada guardado agrega una fila en
`ST_INFORMES_HISTORIAL` con el valor anterior y el nuevo de cada campo, el
usuario de la sesión y la hora del servidor.

- La emisión registra quién y cuándo, y guarda una copia completa de la
  Rev. 0 en `ST_INFORMES_REVISIONES` (fila del servicio, correcciones y fotos).
- **Reemisión** (migración `010`): un informe emitido no se edita
  directamente. «Abrir revisión» pide el motivo una vez (por ejemplo, el
  pedido del cliente) y deja el informe «En revisión»: los cambios de datos y
  fotos se guardan como borrador de la revisión siguiente, sin pedir motivo
  ni subir la revisión en cada guardado, mientras la vigente sigue siendo la
  que se entrega (se puede imprimir desde el aviso). «Reemitir» la convierte
  en la nueva revisión con quién y cuándo, y guarda su copia; «Cancelar
  revisión» devuelve datos y fotos a la vigente. Todo queda en el historial.
- El pie de un informe reemitido dice «Rev. N del … por … · Reemplaza a la
  Rev. N-1 del …» y el informe cierra con «Revisiones del informe», el motivo
  de cada una (NB/ISO/IEC 17025, 7.8.8). En el historial, «Revisiones
  emitidas» permite volver a imprimir o guardar en PDF cualquier revisión tal
  como se entregó; el PDF de una reemisión termina en `-RevN`.
- Los informes emitidos antes de la migración 010 guardan la copia de su
  revisión vigente al abrir su primera revisión (se marca como copia
  posterior); sus revisiones anteriores no se pueden reimprimir.
- Una foto no se borra: se quita con usuario y fecha.
- Dos personas no se pisan: cada informe lleva una versión y el segundo en
  guardar recibe un aviso y la versión vigente (409).
- No se editan la identidad del servicio (OTST, código de registro, código
  Métrica) ni las columnas de sistema; el backend valida cada valor contra el
  tipo y el largo de su columna.

- Un texto redactado con la sugerencia de Gemini queda marcado como tal en
  su cambio del historial; el autor sigue siendo el usuario que lo guardó.

Despliegue: aplicar la migración `008` (`pnpm migrate` en `backend`; crea
`ST_INFORMES`, `ST_INFORMES_HISTORIAL` y `ST_INFORMES_FOTOS` y registra el
cambio CC-2026-019 en el Control de cambios) y después backend y frontend.
Las fotos se guardan en la base (unos 150–300 KB cada una): en SQL Server
Express cuentan para el límite de 10 GB. La reemisión necesita además la
migración `010` (estado «En revisión», nuevas acciones del historial y
`ST_INFORMES_REVISIONES`; registra el cambio CC-2026-021).

Para «Mejorar redacción», en `backend/.env`:

| Variable | Valor |
|---|---|
| `GEMINI_API_KEY` | Clave de Google AI Studio. Sin ella el botón no aparece. |
| `GEMINI_MODEL` | Modelo principal (por omisión `gemini-3.5-flash-lite`, responde en 1–2 s). |
| `GEMINI_MODEL_RESPALDO` | Se usa si el principal está saturado o no disponible (por omisión `gemini-3.5-flash`). |

La clave no va en variables `VITE_` ni en el repositorio: el navegador llama
a `/api/soporte/redaccion` y el backend llama a Gemini.

### Próximos servicios

En casi todos los servicios el técnico llena «Fecha próximo servicio
sugerido» y «Tipo de servicio sugerido». La pestaña **Próximos servicios** los
reúne por equipo (Código Métrica) para que el área sepa a qué cliente volver y
cuándo (migración `009`, rutas `/api/soporte/proximos*` y `/api/soporte/avisos*`).

- **Qué fecha vale:** la que sugirió el último mantenimiento (preventivo
  regular o avanzado, correctivo), instalación o verificación (IBMETRO o
  interna) del equipo. Un servicio posterior de esos tipos la reemplaza con la
  suya, aunque venga sin fecha; el diagnóstico y el relevamiento no la cambian.
  Si el área corrigió la fecha en el informe, vale la corregida. Una fecha que
  no es posterior al servicio no cuenta. Reglas y pruebas en
  `backend/src/services/soporte.proximos.reglas.js` y
  `backend/tests/soporte.proximos.test.js`.
- **Situación:** programado, en aviso (le faltan los días de anticipación o
  menos), coordinado (visita acordada con el cliente), vencido o descartado.
- **Vista:** «Requieren atención» con lo vencido y lo próximo de cualquier
  año, agrupado por cliente y planta (los equipos de una misma visita; cada
  grupo se despliega y la OTST del servicio anterior figura solo como
  referencia de cada equipo); línea de tiempo anual agrupada por cliente (una fila por equipo, con
  los servicios realizados, la banda hasta el próximo servicio, el periodo de
  aviso y lo vencido sin atender); vistas de mes y agenda, también agrupadas
  por cliente; filtros por
  cliente, ciudad, tipo sugerido, situación y búsqueda. El contador de la
  barra lateral y de la pestaña cuenta lo que requiere atención.
- **Seguimiento (oculto por ahora):** el área todavía no tiene un
  procedimiento para gestionar estas fechas, así que los botones están
  ocultos con `SEGUIMIENTO_UI = false` en
  `src/features/soporte/domain/proximos.js` (el backend y la tabla siguen
  intactos; la bitácora de un equipo se muestra si ya tiene gestiones).
  Ponerlo en `true` los vuelve a mostrar. Con él activo, desde la ficha del
  equipo se registra el contacto con el
  cliente, una visita coordinada (con fecha), una reprogramación (nueva fecha
  y motivo), un descarte (motivo; deja de avisar) o una reactivación. Cada
  gestión es una fila de `ST_PROXIMOS_SEGUIMIENTO` con usuario de la sesión y
  hora del servidor; no se edita ni se borra (7.5.2). Dos personas no se
  pisan: el segundo recibe un aviso (409) y la ficha vigente. Si el equipo
  tiene un servicio nuevo, el seguimiento anterior queda en la bitácora y la
  nueva fecha empieza limpia.
- **Avisos:** pestaña **Avisos** con la anticipación (30 días por omisión),
  la repetición (una vez, semanal, diaria o sin avisos), la hora y los
  destinatarios. Cada día, a esa hora, cada destinatario activo recibe un
  correo con lo vencido y lo próximo agrupado por cliente. Usa el mismo SMTP
  que calibración; `ST_ALERTS_ENABLED=false` lo detiene. `ST_AVISOS_ENVIOS`
  registra cada aviso para no repetirlo antes de tiempo (si la fecha se
  reprograma, el aviso empieza de nuevo) y `ST_AVISOS_HISTORIAL` cada cambio
  de los ajustes y los destinatarios.

Despliegue: aplicar la migración `009` (crea `ST_PROXIMOS_SEGUIMIENTO`,
`ST_AVISOS_AJUSTES`, `ST_AVISOS_CONTACTOS`, `ST_AVISOS_HISTORIAL` y
`ST_AVISOS_ENVIOS`, y registra el cambio CC-2026-020) y después backend y
frontend. Mientras no haya destinatarios no sale ningún correo.

## Control de cambios y registro de fallas

Dos apartados al pie de la barra lateral, sobre el usuario, solo para el nivel 3
(migración `007`, rutas `/api/sistema/*`):

- **Control de cambios** (NB/ISO/IEC 17025, 7.11.2): cada cambio del sistema
  (módulo, mejora, corrección, seguridad, base de datos o configuración) se
  documenta, se valida (qué se probó, con qué datos y el resultado), se aprueba
  y recién entonces se implementa. Cada paso queda en `APP_CAMBIOS_HISTORIAL`;
  un cambio aprobado ya no se edita. Los cambios se agrupan por versión y la
  cabecera indica si la versión en uso (`package.json`) tiene todos sus
  cambios aprobados. La migración siembra lo implementado según el historial
  de git: lo anterior al módulo Calibración figura como en uso y registrado a
  posteriori (falta su validación y aprobación) y lo de Calibración (2.7.0)
  queda por validar.
- **Registro de fallas** (7.11.3 e): los errores 5xx del servidor, de las
  tareas programadas y del proceso se guardan solos en `APP_FALLAS` (sin el
  cuerpo de la petición), agrupando sus repeticiones mientras siguen abiertas.
  Las fallas que la aplicación no puede ver (servidor o red caídos) se
  registran a mano. Cerrar una falla exige la acción inmediata y la correctiva,
  y puede ligarse al cambio que la corrigió.

Al publicar una versión: registra sus cambios, valídalos y apruébalos antes de
desplegarla, y después registra la fecha de implementación.

> Pendiente de coordinar con el Jefe de Sistemas: las contraseñas de
> `DATA_USERS` se guardan y comparan en texto plano porque varios sistemas las
> leen así. La norma pide proteger el acceso (7.11.3 a) y guardarlas con hash es
> la forma esperada de cumplirlo; el cambio debe hacerse a la vez en todos los
> sistemas que usan esa tabla.

## Gestión IvMET

El navegador consume exclusivamente `/api/ivmet/*` con el JWT de RimMET. La conexión administrativa con Supabase ocurre en el backend y requiere un usuario RimMET con `acceso_cron = 3`. Por ahora solo lo usa Sistemas: el resto del personal lo ve en la barra lateral con candado y, al abrirlo, el aviso de acceso restringido.

Variables del backend:

```dotenv
IVMET_ENABLED=false
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<server-only-secret>
```

Para desarrollo local puede usarse temporalmente `SUPABASE_SERVICE_ROLE_KEY` en lugar de `SUPABASE_SECRET_KEY`. Ninguna de estas claves debe declararse con prefijo `VITE_` ni almacenarse en el frontend.

El módulo incluye fichas por cliente/planta/balanza, cuentas y licencias,
contratos, tarifas mensuales/anuales, pagos parciales, renovaciones, cupos,
áreas, patrones/certificados y sincronización selectiva. Comparte los tokens
de tema de la aplicación: superficies sólidas en datos y formularios, y vidrio
en las listas desplegables.

Antes de abrirlo, aplicar las migraciones administrativas del repositorio IvMET.
Consultar [la guía de operación y despliegue](docs/ivmet-management.md).

Rutas principales:

- `GET /api/ivmet/overview`
- `GET /api/ivmet/clients`
- `GET /api/ivmet/plans`
- `GET /api/ivmet/clients/:clientId`
- `GET /api/ivmet/clients/:clientId/equipment`
- `GET /api/ivmet/clients/:clientId/users`
- `GET /api/ivmet/integration`
- `POST /api/ivmet/actions/:action`

### Acceso temporal de desarrollo a IvMET

El gestor muestra **En desarrollo** y requiere, además del nivel 3, un código
validado en el backend. No carga datos antes de desbloquearlo. Configura
`IVMET_ACCESS_CODE_HASH` en el `.env` privado del backend con el comando
`pnpm ivmet:access-code`; sin hash válido el módulo permanece bloqueado.

El frontend y el backend se deben actualizar juntos. Consulta la
[guía de configuración y despliegue](docs/ivmet-development-access.md).

## Tecnologías

- React 19
- Vite
- Tailwind CSS
- React Hook Form + Zod
- React Signature Canvas
- React Dropzone
- Lucide React

## Instalación y Ejecución

1.  **Instalar dependencias:**

    ```bash
    cd rim-app
    corepack pnpm install
    ```

2.  **Iniciar servidor de desarrollo:**

    ```bash
    corepack pnpm dev
    ```

3.  **Construir para producción:**
    ```bash
    corepack pnpm build
    ```

## Estructura del Proyecto

- `src/components/ui`: Componentes base reutilizables.
- `src/components/forms`: Componentes complejos del formulario (Firma, Fotos).
- `src/components/layout`: Elementos de estructura (Header).
- `src/utils`: Validaciones y utilidades.
