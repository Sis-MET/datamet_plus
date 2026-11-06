# Plan de implementación: certificados de calibración de balanzas

Plan para reemplazar el libro `F-VMET-02-7.2 Registro de calibración` por
DataMET+. Parte del análisis del Excel y de las decisiones del laboratorio
([calibracion-analisis-excel.md](calibracion-analisis-excel.md), secciones 7 a
10) y de las skills normativas del proyecto (`euramet-cg-18`, `guia-sim-ipfna`,
`oiml-r76`, `oiml-r111`, `gum-iso-iec-guide-98-3`, `nb-iso-17025`).

## Alcance

**Incluye:** calibración de instrumentos para pesar de funcionamiento no
automático que ServiceMET sube a `DATA_SERVICIOS_DATOS_CALIBRACION` (servicios
CAL.B y CAL.BL): registro, cálculo, revisión, autorización, certificado,
firma, archivo y reemisión; los datos de los patrones que el cálculo necesita;
la validación del software y el reemplazo del Excel.

**Por ahora no incluye:** calibración de pesas (OIML R111, Anexo C),
microbalanzas (Guía SIM 2025), firma digital integrada en la aplicación y otros
tipos de instrumento. El diseño no debe impedirlos.

## Principios

1. **Lo que subió el técnico no se toca.** Las filas de ServiceMET son las
   observaciones originales; las correcciones se superponen campo a campo con
   historial (NB/ISO/IEC 17025 7.5.2), como en Soporte técnico.
2. **Un solo motor de cálculo, en el servidor.** Funciones puras y probadas;
   el editor pide una vista previa al servidor en vez de duplicar el cálculo en
   el navegador. Así hay una sola implementación que validar (7.11.2).
3. **Lo editable es la configuración del método**, con versión y aprobación del
   jefe de Calibración: parámetros, tablas y textos. Las fórmulas viven en el
   código, con pruebas (decisión 9). Cada certificado guarda la versión del
   motor y de la configuración con que se calculó.
4. **Reutilizar Soporte técnico**: lista agrupada, editor con vista previa,
   avisos antes de emitir, envío a revisión y aprobación delegada, emisión con
   copia congelada, reemisión con revisiones (7.8.8), PDF A4 y archivo con
   huella SHA-256.
5. **Registro único del laboratorio**: un solo registro para todos; se acaban
   las copias del libro por ingeniero. La numeración y los nombres de archivo
   siguen exactamente las reglas actuales.

## Vista general

| Fase | Objetivo | Depende de | Tamaño |
|---|---|---|---|
| 0 | Preparativos del laboratorio y de Sistemas | — | S |
| 1 | Valores de los certificados de pesas y termohigrómetros en el gestor de equipos | 0 | M |
| 2 | Lectura de ServiceMET y modelo de datos del servicio | 0 | M |
| 3 | Motor de cálculo y configuración del método | 1 (modelo de piezas), 2 (modelo del servicio) | L |
| 4 | Registro de calibración: lista, editor, revisión | 2, 3 | L |
| 5 | Certificado, autorización, firma, archivo y reemisión | 4 | L |
| 6 | Pantalla de configuración del método | 3 | M |
| 7 | Validación, migración de históricos y puesta en marcha | 1–6 | M |
| — | Cambios en ServiceMET (en paralelo, no bloquean) | 1 | M |

Las fases 1 y 2 pueden avanzar a la vez. La 3 puede empezar con datos de
prueba antes de que terminen. La 6 puede ir en paralelo a la 4 y la 5.

## Fase 0 — Preparativos

**Laboratorio**

- Actualizar el procedimiento P-VMET-02-7.2 y el texto «Método utilizado» del
  certificado para citar EURAMET cg-18 v4.0 y la Guía SIM (decisión 1;
  documento controlado, 8.3).
- Definir quién **elabora**, quién **revisa** y quién **autoriza** (firmantes),
  y si el jefe de Calibración delega la revisión como en Soporte técnico.
- Aprobar los valores iniciales de la configuración del método (sección
  «Configuración inicial» al final).
- Aprobar el diseño del certificado: el de la hoja CERT actual más lo que pide
  7.8 (k por punto, antes y después del ajuste, datos del cliente marcados,
  regla de decisión y riesgo).
- Numeración, códigos y nombres de archivo **se mantienen tal cual** (decidido
  el 2026-11-05): n.º de certificado `NNNN-CNN-RR-AA` (negociación, n.º de RECA
  de ServiceMET y año), n.º de emisión `01`, `02`…, nombre del PDF y carpeta
  `PC-EMIN\<año>`. Detalle en
  [calibracion-fase0-propuesta.md](calibracion-fase0-propuesta.md), sección 3.
- Confirmar la regla para armar cargas con piezas del juego (la de menos
  piezas) y sus desempates (por ejemplo, preferir la pieza sin marca a la
  duplicada «*»).
- Reunir todas las copias del libro (MGC, JOR, AGF y anteriores) para la
  migración y la corrida paralela.

**Sistemas**

- Registrar el cambio en Control de cambios (`APP_CAMBIOS`, 7.11.2).
- Trabajar contra `DataMET_prueba`. Ojo: ahí las migraciones 002–007 y 011–013
  están aplicadas sin registrar; no ejecutar `pnpm migrate` a ciegas.
- Preparar datos de prueba: filas reales de ServiceMET anonimizadas y, para las
  mismas balanzas, los resultados del Excel (CARE).

**Hecho cuando** el laboratorio aprobó roles, configuración inicial, diseño y
numeración, y hay datos de prueba.

## Fase 1 — Valores de los certificados de los patrones

Hoy el gestor de equipos (`DATA_EQUIPOS_CAL`, `CAL_CERTIFICADOS`) guarda por
equipo el número de certificado, la fecha, el período, el vencimiento y el
ente. Falta lo que el Excel tenía en EQUI_VIGENTE y VALORES.

**Estado (2026-11-06):** construida y probada en el navegador contra
`DataMET_prueba` (migración 016 aplicada): pegar piezas y valores desde Excel,
guardar, avisos R111, bloqueo de la verificación para quien transcribió, motivo
obligatorio al corregir e historial. E2-005 quedó allí con datos de prueba (no
reales) para probar la verificación con otro usuario. Falta la carga inicial en
la base real y que el laboratorio verifique cada certificado.

**Base de datos** (migración `016_calibracion_patrones.sql`):

- `CAL_PATRONES`: tipo de patrón del equipo (juego de pesas o condiciones
  ambientales) y clase R111 del juego.
- `CAL_PATRON_PIEZAS`: piezas de cada juego (valor nominal en mg, marca que
  distingue a las duplicadas, material, densidad, U(ρ) y k, origen de la
  densidad —medida o supuesta R111 B.7—, activa). Las piezas no se borran: se
  desactivan.
- `CAL_CERT_TRANSCRIPCION`: por certificado, condiciones de la calibración del
  juego (t, HR, p, para ρa1, EURAMET 7.1.2-5b), observaciones, quién y cuándo
  transcribió y versión (control de concurrencia).
- `CAL_CERT_VALORES`: por certificado y pieza, documento (si el juego tiene
  varios certificados), corrección, U, k y conformidad.
- `CAL_CERT_PUNTOS`: para termohigrómetros, por certificado y magnitud (T, HR,
  p), cada punto con corrección, U y k.
- Historial en `CAL_EQUIPOS_HISTORIAL` (acciones `PATRON`, `PIEZAS`,
  `VALORES`, con antes y después y motivo) y entrada en `APP_CAMBIOS`.

**Backend** (`calibration.patrones.js`, esquema `patron` en la validación,
`GET/PUT /calibracion/equipos/:id/patron`):

- Tipo, clase, piezas y valores del certificado vigente se guardan en una sola
  transacción. Cambiar valores ya transcritos pide motivo.
- La verificación reutiliza la revisión de `CAL_CERTIFICADOS`: la hace otra
  persona (ni quien registró o corrigió el certificado ni quien transcribió los
  valores); transcribir de nuevo la deja pendiente otra vez.
- Avisos R111 (sin bloquear): U ≤ δm/3, |corrección| ≤ δm − U, densidad dentro
  de la Tabla 5, pieza no conforme, datos faltantes.
- `valoresVigentesEn(equipo, fecha)` devuelve el certificado vigente en la
  fecha de la calibración (lo usará el motor de la fase 3).

**Frontend** (Calibración › Equipos › ficha › «Piezas y valores»): tipo y
clase; tabla de piezas con pegado desde Excel; valores del certificado vigente
por pieza (o por punto para termohigrómetros) con condiciones, avisos y botón
«Verificar contra el original».

**Carga inicial** (`backend/scripts/patrones-importar-excel.js`; desde
`backend`: `npm run patrones:importar -- "<libro .xlsm>"`): lee del
libro EQPE2 (material, clase), VALORES (piezas, densidad) y EQUI_VIGENTE
(corrección y U en µg, aptitud, condiciones). Sin `--aplicar` solo muestra el
plan; con `--aplicar --usuario <usuario>` carga a nombre de ese usuario, como
transcriptor. Solo toca juegos activos del gestor que aún no tienen piezas, y
carga valores solo si el certificado del libro es el vigente en DataMET+. No
inventa datos: deja vacías las condiciones fuera de rango (F1-001 trae HR 519 y
p 6492) y no reparte un único valor entre varias pesas iguales (juegos M, por
ejemplo 30 pesas de 20 kg): esos se transcriben del PDF. Los
termohigrómetros se transcriben a mano (el libro no tiene sus puntos).

Corrida de prueba contra `DataMET_prueba` con el libro MGC: 8 juegos con
piezas y valores (E2-003, E2-005, E2-103, E2-105, F1-001, F1-101, F1-104 y
F1-105); F1-202 a F1-204 y los 7 juegos M solo piezas, porque el gestor de
prueba tiene certificados anteriores; E2-002, E2-101, F1-103, F1-201, F2-201 y
M2 no están en el gestor de prueba.

**Pruebas:** `calibration.patrones.test.js` (reglas R111, vigencia, versiones,
validación) y `patrones.importar.test.js` (lectura del libro y plan de carga);
`domain/patrones.test.js` en el frontend (números, unidades y pegado).

Al registrar un certificado nuevo de un juego de pesas o de un
termohigrómetro, DataMET+ abre enseguida «Piezas y valores» para transcribir
sus valores.

**Pendiente:** regla para piezas M sin identificación (decisión del
laboratorio; los certificados internos de Métrica, p. ej. 286-C03-P2-22, dan un
código y un valor por pieza: M2-301 … M2-307); verificar en la base real que el
gestor tiene los certificados vigentes antes de cargar.

**Mejora futura (decidido el 2026-11-06):** leer el PDF del certificado para
llenar los valores sin digitarlos. Los originales de IBMETRO de 2026 y los
internos de Métrica son PDF digitales con texto, así que puede hacerse sin OCR
ni servicios externos (tabla «Resultado de la medición»: valor nominal, marca,
masa convencional «2 g + 0,005 mg», U; condiciones con su U; densidad). Por
ahora se transcribe a mano o pegando desde Excel. El PDF no se guarda en
DataMET+: la documentación de Calibración se gestiona en otro sistema.

**Hecho cuando** todos los juegos y termohigrómetros en uso tienen su
certificado vigente transcrito y verificado.

## Fase 2 — Lectura de ServiceMET y modelo del servicio

**Fila vigente:** como en Soporte, la última fila por `codigo_registro`
(`ORDER BY n DESC`), sin las de `estado_servicio_csv = 'ANULADO'`.

**Adaptador** (`calibracion.fuente.js`): convierte la fila ancha en un modelo
estructurado, sin límites artificiales:

```text
servicio      código, SECA, negociación, n.º RECA, sticker, fecha, horas, técnico
cliente       cliente, planta, dirección, departamento
instrumento   tipo, marca, modelo, serie, cód. interno, cód. Métrica, ubicación,
              unidad, rangos[{max, d, e, decimales}], clase {valor, origen}
patrones      juegos[] (equipo1..5, cantidad), termohigrómetros[] (equipo6..7)
condiciones   inicio {hora, t, HR, p}, fin {hora, t, HR, p}, inspección[14] con fotos
precarga      [{carga, indicación}]   (as found)
ajuste        {realizado, tipo, pesas}
excentricidad {plataforma, indicador, carga, posiciones[{n, indicación, retorno}]}
repetibilidad [{carga, lecturas[{indicación, retorno}]}]
errores       {método de carga, puntos[{carga, cero, indicación, retorno}]}   (hasta 60)
sustitución   {método, …}
criterio      {emp NB 23001, % cliente, factor de seguridad, regla de decisión}
cierre        recomendaciones, observaciones
```

- **Normalización**: diccionarios para los textos libres (método, regla, sí/no,
  plataforma, unidad), reparación de la codificación («S�» → «Sí»), números con
  coma o punto, técnico resuelto contra `DATA_USERS` (y aviso si es «Usuario» o
  «Usuario sin datos»).
- **Patrones**: cada código se busca en el gestor de equipos; aviso si no existe
  o no tiene certificado vigente y verificado en la fecha del servicio.
- **Instrumento del cliente**: puntos acordados de ensayo (hoy ICLI, en Access)
  como referencia para los avisos; decidir en esta fase si se migran a SQL.
- **Mapeo con versión**: si ServiceMET cambia columnas, se agrega un mapeo sin
  tocar el motor (relacionado con Versiones ServiceMET, migración 014).

**Backend:** lista de servicios con estado del registro (pendiente / borrador /
en revisión / aprobado / autorizado / emitido), agrupada por SECA, con
búsqueda y filtros (cliente, técnico, fechas).

**Pruebas:** fixtures de filas reales anonimizadas con su modelo esperado;
casos de multirango, 13+ puntos, 6 posiciones, sustitución, textos dañados.

**Hecho cuando** todos los servicios de 2026 se leen sin errores y los avisos
de calidad de datos se pueden revisar.

## Fase 3 — Motor de cálculo y configuración del método

**Módulo** `backend/src/services/calibracion/motor/` sin acceso a la base:
recibe el modelo del servicio, los valores de los patrones y la configuración, y
devuelve resultados, presupuesto por punto y avisos. Cada función cita su
ecuación de EURAMET en un comentario.

| Bloque | Qué calcula | Referencia |
|---|---|---|
| Aire | ρa por CIPM-2007 (y la aproximada con su rango); u(ρa) con la U del certificado del termohigrobarómetro + variación inicio-fin, con la HR como fracción | EURAMET A1, A3; R111 E (Enmienda 2025) |
| Cargas | Composición de cada carga con piezas del juego (menos piezas + desempates), editable; mc, U (suma lineal), emp, densidad combinada y u(ρ) | EURAMET 4.3.1, 7.1.2.1 |
| Masa de referencia | δmc, δmB = −mN(ρa − ρ0)(1/ρ − 1/ρc) haya o no ajuste, u por 7.1.2-5a o 5b; deriva D = kD·U; convección (Tabla F2.1) si aplica | EURAMET 7.1.2 |
| Indicación | d0 (de cero) y dL por rango; s por intervalo (mayor de las dos que encierran la carga); excentricidad método 3 | EURAMET 6.3-2, 7.1.1 |
| Error | E = I − mref; u(E); νeff por Welch-Satterthwaite; k = t al 95,45 % | EURAMET 7.1.3, 7.3, B; GUM G |
| Sustitución | LTn y LTn,k con 7.1.2-15a/b para los dos métodos | EURAMET 4.3.3, 7.1.2.6 |
| Tolerancia | emp NB 23001 por la clase registrada o pedida por el cliente; % de la carga; tramos | R76 Tabla 6 y 3.5.2 |
| Conformidad | Simple (\|E\| ≤ T) o conservadora (\|E\| + U(E) ≤ T); riesgo bilateral con u(E) = U/k | 17025 7.8.6; ILAC G8 |
| Presentación | U con dos cifras significativas hacia arriba; error al mismo decimal; k por punto | GUM 7.2.6 |
| Anexo (sin formar parte del certificado) | Incertidumbre en uso U(W) y global, pesada mínima (G-9), USP <41>, curva E(I) por mínimo χ² | EURAMET 7.4–7.5, C, G |

**Configuración del método** (tabla `CB_METODO_VERSIONES`, nombre a confirmar):
parámetros, tablas y textos en JSON con estado (borrador / aprobada / vigente),
quién y cuándo aprobó; se siembra la versión 1 con los valores aprobados en la
fase 0. Su pantalla de edición es la fase 6.

**Vista previa:** `POST /api/calibracion/registros/:id/calcular` calcula sin
guardar; el editor la llama al cambiar datos.

**Pruebas (evidencia de validación, 7.11.6):**

- Vectores de EURAMET Anexo H (H1 ya transcrito en la skill `euramet-cg-18`;
  agregar H2 multirango y H3 sustitución) y de la Guía SIM Apéndice G.
- Una prueba por fórmula, con el número de ecuación en el nombre.
- Casos de borde: unidades mg/g/kg, multirango, 3/5/10 lecturas, ceros
  distintos de cero, 13+ puntos, presión < 600 hPa, pesas de fundición en
  altura, instrumento sin clase.

**Hecho cuando** pasan todos los vectores de EURAMET y la Guía SIM y el
laboratorio revisó el presupuesto de un caso real.

## Fase 4 — Registro de calibración: lista, editor y revisión

**Base de datos** (migración `017_calibracion_registros.sql`, prefijo a
confirmar; no usar `CAL_CERTIFICADOS`, que ya es de los equipos):

- `CB_REGISTROS`: uno por servicio (código de ServiceMET), correcciones
  superpuestas (JSON), composición de cargas, clase con origen, estado,
  validación, número, revisión, versión del motor y de la configuración.
- `CB_HISTORIAL`: cada guardado con valor anterior y nuevo por campo, usuario y
  hora del servidor (7.5.2).
- `CB_APROBADORES` (o reutilizar el patrón de `ST_APROBADORES`): a quién
  delega el jefe de Calibración la revisión.

**Backend:** lista, detalle, escritura con historial, enviar a revisión,
aprobar o devolver con observación, permisos del área Calibración (el JWT ni
el nivel de Sistemas conceden aprobar, como en Soporte).

**Frontend** (nuevo apartado de Calibración, por ejemplo «Certificados»):

- **Lista** agrupada por SECA (como la OTST de Soporte), con estados y filtros.
- **Editor por secciones** en el orden de RECA: cliente; instrumento (rangos,
  clase y su origen); patrones y **composición de cada carga** (propuesta y
  editable); condiciones e inspección; precarga y ajuste (as found);
  excentricidad (con el diagrama de `plataforma.js` de Soporte); repetibilidad;
  errores; sustitución; criterio (emp, tolerancia, regla); observaciones. Cada
  dato corregido muestra el valor de ServiceMET y se puede restaurar.
- **Panel de resultados**: errores, U, k, conformidad y riesgo por punto, y el
  presupuesto desplegable (componente, valor, distribución, u, ν, origen).
- **Avisos antes de enviar a revisión** (como `domain/avisos.js`): fecha;
  excentricidad > 2d; lecturas que se apartan de su carga > 4d; U > 3d (umbral
  configurable); patrón o termohigrómetro vencido o sin verificar; técnico sin
  identificar; textos dañados; puntos de linealidad incompletos; rango
  reducido sin Min′ o Max′; carga de excentricidad menor que Max/3.

**Hecho cuando** un ingeniero puede elaborar el registro de un servicio real y
otro revisarlo y aprobarlo, con todo el historial.

## Fase 5 — Certificado, autorización, firma y reemisión

**Documento** (React, como `InformeDocumento` de Soporte, A4):

- Mismo contenido y aspecto que la hoja CERT: cliente, instrumento, lugar y
  fecha, condiciones ambientales, patrones y trazabilidad, alcance, registro
  (SECA, RECA, sticker), método, excentricidad, repetibilidad, errores con U,
  emp o tolerancia, conformidad y riesgo, observaciones, «Fin del certificado».
- **Agregados por 7.8 y EURAMET 8**: k y probabilidad de cobertura por punto
  (y la razón si k ≠ 2); resultados antes y después del ajuste cuando hubo
  ajuste; datos del cliente identificados (tolerancia, rango de uso, clase
  pedida); regla de decisión aplicada.
- Gráficos de error con las bandas del emp y de desviación estándar.
- **Información adicional** (anexo que no forma parte del certificado):
  incertidumbre en uso, pesada mínima, USP <41>.
- «Borrador» en cada hoja hasta que esté emitido; n.º y «Página n de N» en cada
  hoja.

**Flujo:** aprobado → **autorizado** por un firmante (quién y cuándo; el número
de certificado sigue la regla actual, que sale de los datos de ServiceMET) →
PDF para firmar → el
firmante lo firma con su firma digital fuera de DataMET+ y lo sube → **emitido**
con la fecha de la firma y el PDF firmado archivado con su huella en la carpeta
del área (como `ST_DOCUMENTOS_DIR` de Soporte; hoy `PC-EMIN\<año>` en OneDrive).
La fecha de emisión que declara el certificado es la de la firma digital.

**Reemisión** (7.8.8): «Abrir revisión» con motivo; los cambios son borrador de
la revisión siguiente; «Reemitir» repite autorización y firma; el pie dice a qué
revisión reemplaza y el certificado cierra con «Revisiones del certificado».
Reutilizar `soporte.revisiones.js` y `CB_REVISIONES` / `CB_DOCUMENTOS`.

**Hecho cuando** se emite, firma, archiva y reemite un certificado de prueba de
punta a punta.

## Fase 6 — Configuración del método

- Pantalla para ver y editar la versión en borrador: parámetros (k, probabilidad,
  redondeo, valores por defecto, umbrales de avisos, componentes activas),
  tablas (emp por tramos, convección, densidades por material) y textos del
  certificado (método, notas, reglas de decisión).
- Aprobación solo del jefe de Calibración; quien la redacta no la aprueba.
  Historial de versiones con diferencias.
- Al aprobar una versión nueva, los registros en borrador se recalculan con
  ella; los emitidos no cambian (conservan su versión).

## Fase 7 — Validación, migración y puesta en marcha

1. **Corrida paralela**: recalcular en DataMET+ los certificados emitidos con el
   Excel (CARE de todas las copias) y comparar campo a campo. Las diferencias
   por los errores 1, 2, 3, 6, 9 y 10 del análisis son esperadas y se
   documentan; cualquier otra se investiga.
2. **Informe de validación** (7.11.2) con los vectores de EURAMET y la Guía
   SIM, la corrida paralela y las pruebas automáticas; aprobación del
   laboratorio y registro en Control de cambios.
3. **Migración de históricos**: CARE y REOR de cada copia como registros
   heredados de solo lectura, con su PDF de OneDrive enlazado, para consulta,
   trazabilidad y reemisión.
4. **Instructivo** dentro de la aplicación (7.11.5) y capacitación.
5. **Cumplimiento**: agregar el 7.8 al catálogo de la pestaña Cumplimiento y a
   sus pruebas; actualizar el estado conocido de la skill `nb-iso-17025`.
6. **Corte**: fecha desde la que solo se emite en DataMET+; el Excel queda de
   solo lectura.

## En paralelo — Cambios en ServiceMET

No bloquean: el adaptador tolera los datos actuales.

- Elegir los juegos de pesas y el termohigrobarómetro de la **lista del gestor
  de equipos de DataMET+** (mismo código).
- Enviar códigos en vez de textos libres; números como números; UTF-8.
- Identificar al técnico por su usuario.
- Declarar la clase del instrumento y su origen (placa, aprobación, sin clase).
- Definir con el laboratorio las lecturas «as found» cuando hay ajuste.
- Registrar la versión de la app en cada fila; validar cada versión en
  Versiones ServiceMET.

## Hitos

1. **Patrones verificados** (fin de la fase 1).
2. **Motor validado** con EURAMET y la Guía SIM (fin de la fase 3).
3. **Registro y revisión** en pruebas con servicios reales (fin de la fase 4).
4. **Certificado firmado y reemitido** de punta a punta (fin de la fase 5).
5. **Corrida paralela aprobada** e informe de validación (fase 7).
6. **Puesta en marcha** y retiro del Excel.

## Riesgos y cuidados

- **Datos de los patrones**: si la transcripción tiene errores, todos los
  certificados heredan el error. Mitigación: verificación por otra persona y
  avisos R111.
- **Calidad de los datos históricos de ServiceMET** (textos libres, técnico sin
  identificar): normalización y avisos; no bloquear los servicios antiguos.
- **Diferencias con certificados ya emitidos**: la corrida paralela mostrará
  diferencias por los errores corregidos; el laboratorio decide si alguno
  requiere revisar certificados emitidos (7.10, trabajo no conforme).
- **`DATA_EQUIPOS_CAL` sin clave primaria** y con registros heredados que no
  coinciden: resolverlos antes de colgar piezas y valores de los equipos.
- **Migraciones en `DataMET_prueba`** aplicadas sin registrar: revisar antes de
  ejecutar el migrador.

## Configuración inicial (versión 1, por aprobar)

| Parámetro | Valor propuesto | Origen |
|---|---|---|
| Probabilidad de cobertura | 95,45 % | Decisión 2 |
| k | t de Student con νeff | Decisión 2 |
| Redondeo de U | 2 cifras significativas, hacia arriba | Decisión 3 |
| Fórmula del aire | CIPM-2007 | R111 Enmienda 2025 |
| u(t), u(HR), u(p) | U del certificado del THB (k declarado) + variación inicio-fin / √12 | Decisión 5 |
| Incertidumbre del empuje | 7.1.2-5b (con ρa1 si se conoce; si no, 7.1.2-5a) | Decisión 1 |
| Deriva de las pesas | D = kD·U, kD = 1 (configurable 1–3); sin historial, D = emp | EURAMET 7.1.2-10 |
| Convección | Activa en pesas F1 o mejores; ΔT por el tiempo de estabilización | EURAMET 7.1.2.4, F |
| Excentricidad | Método 3 | Detalle resuelto |
| Repetibilidad | s por intervalo; ν = n − 1 de la s usada | EURAMET 7.1.1.3 |
| Sustitución | 7.1.2-15a/b | Decisión 8 |
| Regla conservadora | \|E\| + U(E) ≤ T | Decisión 7 |
| Avisos | Excentricidad > 2d; lectura vs carga > 4d; U > 3d | Alertas actuales de RECA |
| Composición de cargas | Menos piezas; desempate a confirmar | Decisión 4 |
