# DataMET+

Aplicación interna de Métrica Ltda. que reúne el apartado RIM (registros, numeración y formulario), el cronograma operativo, el cronograma de calibración y la administración de IvMET.

## Características

- **Formulario Completo:** Secciones organizadas para datos de balanza, cliente y técnico.
- **Validación Robusta:** Uso de Zod y React Hook Form para asegurar la integridad de datos.
- **Firmas Digitales:** Captura de firma en pantalla táctil o con mouse.
- **Evidencias:** Subida de fotos con drag & drop y previsualización.
- **Diseño minimalista:** tokens de color en `src/index.css` con tema claro y oscuro (sigue al sistema hasta que se elige uno desde la barra superior), tipografía Figtree autoalojada y vidrio solo en capas flotantes (barra superior, menús, avisos).
- **Barra lateral:** módulos, sesión y cierre de sesión; se oculta o muestra con `Ctrl+B` (`⌘B` en macOS) y en móvil se abre como panel.
- **Responsive:** Adaptable a dispositivos móviles y escritorio.
- **Gestión IvMET:** panel administrativo para clientes contratados, licencias, planes y revisión del catálogo sincronizado.
- **Calibración:** plan anual de calibraciones, verificaciones internas y actividades del área, con alertas en el cronograma y por correo.
- **Control de cambios y registro de fallas:** historial de los cambios del sistema con su validación y aprobación, y registro de las fallas con sus acciones (NB/ISO/IEC 17025, 7.11).

## RIM (recepción de instrumentos)

El apartado RIM tiene tres pestañas:

- **Registros:** historial de los RIM de ServiceMET (calibración, soporte y
  registro directo) y del formulario web, con filtros por texto, cliente,
  planta, fechas de emisión, área, estado (vigente o anulado) y etapa
  (recibido, en ejecución, concluido o entregado). La ficha de cada RIM es de
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
- **Permisos:** consultan todos; editan el área Calibración y el nivel 3.

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

La pestaña **Cumplimiento** (área Calibración y nivel 3) evalúa el módulo frente
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

El navegador consume exclusivamente `/api/ivmet/*` con el JWT de RimMET. La conexión administrativa con Supabase ocurre en el backend y requiere un usuario RimMET con `acceso_cron = 3`.

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
