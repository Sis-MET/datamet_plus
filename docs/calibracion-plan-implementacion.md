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

**Estado (2026-11-06):** adaptador y lectura construidos (sin pantalla: la
lista llega en la fase 4).

- `calibration.fuente.js`: `modeloDeFila(fila, contexto)` → `{ modelo, avisos }`,
  función pura con las secciones de arriba. Avisos con nivel `error` (no se
  podría calcular), `aviso` (revisar) o `info` (corregido solo o nota).
- `calibration.servicios.js`: fila vigente, contexto (usuarios sin contraseñas,
  patrones del gestor con su historial de certificados y el estado de sus
  valores de la fase 1), `GET /calibracion/servicios` (filtros `desde`,
  `hasta`, `q`, `tecnico`) y `GET /calibracion/servicios/:codigo`.
- `npm run servicios:revisar -- --anio 2026` (en `backend`): lee todos los
  servicios del período y resume los avisos. Solo lee.
- Pruebas: `calibration.fuente.test.js` (filas sintéticas: multirango, 13+ y
  60 puntos, 6 posiciones, sustitución, textos dañados, patrones).

Resultado contra `DataMET_prueba`: los 1 658 servicios se leen sin fallar
(844 de 2026); 108 tienen errores que impedirían calcular (sin fecha, sin
ensayos, sin pesas, sin unidad). Los avisos más frecuentes son de patrones:
códigos que el gestor de prueba no tiene y valores de certificados aún sin
transcribir (fase 1), y 257 servicios con el técnico sin identificar
(«Usuario», «Usuario sin datos»).

Lo que mostraron los datos reales (para la fase 3 y para ServiceMET):

- **SECA** tuvo tres formatos: `3001-C01-25`, `25-0095-32-C08` y
  `0090-11-C08-26`. La fórmula «SECA MOD» del libro solo arma bien el último;
  el adaptador reconoce los tres.
- **Rangos:** ServiceMET pone primero el rango mayor (Max total). El modelo
  los ordena de menor a mayor (OIML R76, EURAMET) y conserva la columna de
  origen.
- **`certificado1..7` guarda la fecha** de emisión del certificado del patrón,
  no su número. Se compara con el certificado que regía en DataMET+ ese día.
- **Carga de excentricidad sin decimales:** la columna `carga` es entera (2,5
  kg se guarda como 2). El adaptador avisa cuando no coincide con sus
  indicaciones; la fase 3 debe tomar la carga de las indicaciones o de las
  pesas, no de esa columna.
- **Sustitución:** los puntos de sustitución llegan con carga y sin indicación
  (p. ej. punto 13 = 523 con «Método 2»). El modelo los conserva tal cual; su
  interpretación (EURAMET 7.1.2-15a/b) es de la fase 3.
- `metodo_carga` trae además `cargas_validadas:N` y
  `validacion_pesas_pendiente` (validación de cargas de versiones recientes de
  ServiceMET).
- Códigos de patrones que el gestor no tiene o escribe distinto (`M1-05XX`,
  `M1-055X`, `M1-20XX`, `E2-104 (g)`): se avisan; no se inventan
  equivalencias. `M1-05XX` y los demás códigos viejos solo existen en
  `DataMET_prueba`; la base oficial ya no los tiene (confirmado el
  2026-11-06).

**Puntos de ensayo acordados (decidido el 2026-11-06):** todo pasa a SQL,
nada queda en Excel ni en Access. Las cargas acordadas de cada balanza del
cliente (excentricidad, repetibilidad y error) estaban en Access (ICLI) y en
`DATA_SERVICIOS_LEC`; ahora están en `CAL_PUNTOS_ACORDADOS` (migración 017),
las mantiene Calibración con historial y motivo, y son una **referencia**:
DataMET+ avisa si el técnico usó otras cargas; el certificado usa lo medido.

- `calibration.puntos.js`, `GET/PUT /calibracion/puntos-acordados/:codMetrica`
  (la pantalla para editarlos llega con la fase 4).
- Avisos del adaptador: `PUNTOS_ACORDADOS_FALTAN` (error y repetibilidad),
  `EXCENTRICIDAD_DISTINTA` y, como nota, `SIN_PUNTOS_ACORDADOS`.
- Carga inicial: `npm run puntos:importar -- "<libro .xlsm>"` lee ICLI del
  libro y `DATA_SERVICIOS_LEC` de SQL; para cada instrumento gana la más
  reciente (ICLI no tiene fecha: se toma la del libro o `--fecha-icli`). Con
  el libro MGC y `DataMET_prueba`: 1 906 instrumentos (ICLI gana en los 1 215
  que están en ambas; LEC aporta 104), 600 filas de ICLI sin código Métrica
  que no se pueden asociar y 96 repetidas. Cubre 503 de los 844 servicios de
  2026.

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

**Avance (2026-11-06):** núcleo del motor en
`backend/src/services/calibracion/motor/` (puro, sin base):

- `estadistica.js`: t de Student al 95,45 % calculada (coincide con la Tabla
  G.2 de la GUM a dos decimales; ν no entero se trunca, G.6.4), νeff por
  Welch-Satterthwaite (B3-1), U con dos cifras hacia arriba y el error al mismo
  decimal.
- `aire.js`: CIPM-2007 con R = 8,314 462 618 (coincide con la fórmula
  aproximada dentro de 2,4×10⁻⁴ en todo su rango; La Paz ≈ 0,782 kg/m³) y
  u(ρa) con la U del termohigrómetro más la variación inicio-fin (decisión 5).
- `referencia.js`: δmc con u = U/k (o emp/√3 sin certificado), δmB con 5a/5b
  (y las cotas 5c/5d/5e solo para validar), deriva D = kD·U, convección por la
  Tabla F2.1; las incertidumbres de las pesas de una carga se suman
  linealmente.
- `indicacion.js`: s y su ν, s por intervalo (el mayor de los dos ensayos que
  encierran la carga), excentricidad por el método 3 y u(I) (7.1.1-12; sin
  carga solo d0 y s).
- `error.js`: E, u(E), νeff, k y U por punto con el presupuesto completo.
- `tolerancia.js`: emp NB 23001 (R76 Tabla 6 × 2 en servicio), tolerancia en
  %, rango que corresponde a una carga, conformidad simple o conservadora y
  riesgo bilateral con u = U/k.
- `CONFIGURACION_V1` con los valores de «Configuración inicial».

Validación (`tests/motor.euramet.test.js`): el ejemplo H1 de EURAMET punto por
punto (u(I), u(E), νeff, k y U sin redondear dentro del 1 %; en 150 g la guía
da u(E) 0,5 % menor por la cota 5d de la carga combinada). Con la decisión 3
la U impresa queda en dos cifras hacia arriba (0,001 80 → 0,0019 g), más
estricta que la de la guía, que imprime tres cifras.

Segunda entrega (2026-11-06):

- `cargas.js`: cada carga se arma con las piezas de los juegos elegidos, con
  la combinación de **menos piezas**; desempates propuestos: piezas grandes
  primero y, en un mismo valor, sin marca, «*», «**» (falta que el laboratorio
  los confirme). Si un juego no tiene piezas registradas se supone la serie
  5-2-2-1 de su clase con valores nominales (u = emp/√3, 7.1.2-3) y el cálculo
  queda **provisional**.
- `sustitucion.js`: LTn y LTn,k con 7.1.2-15a/b.
- `aire.js`: corrección de las lecturas con los puntos del certificado del
  termohigrómetro (interpolación lineal; fuera del rango, el punto más cercano
  con aviso).
- `servicio.js`: cálculo completo de un servicio desde su modelo: aire, ρa1
  de cada juego (con las condiciones transcritas de su certificado → 5b; si no,
  5a), repetibilidad por intervalo, excentricidad por método 3 (con la mediana
  de las indicaciones si la carga de ServiceMET perdió los decimales),
  I = IL − (I0 + I0i)/2 con «ascenso evaluando ceros», composición, mref,
  E, U, k, tolerancia (emp NB 23001 con la clase, o % del cliente) y
  conformidad; avisos de RECA (error > 4d, U > 3d, excentricidad > 2d).
- `calibration.calculo.js` y `GET /calibracion/servicios/:codigo/calculo`:
  vista previa con los datos de los patrones vigentes en la fecha del servicio.
  En el detalle del servicio, «Resultados (vista previa)» con la tabla por punto
  y el presupuesto desplegable (componente, u, ν, aporte y ecuación).

Contra `DataMET_prueba`: el motor calcula 823 de los 844 servicios de 2026
(9 506 de 9 640 puntos); todos provisionales mientras no estén registradas las
piezas de los juegos y transcritos los certificados de pesas y termohigrómetros
(fase 1).

**Sustitución (aclarado el 2026-11-06):** en ServiceMET «Método 1 / Método 2 /
Sin método» es solo una lista de registro, no cambia ningún dato. En los
datos, la sustitución llega como un punto normal cuya carga supera lo que
suman las pesas llevadas (198 de los 200 servicios marcados con método 1 o 2
tienen todas sus indicaciones). DataMET+ la reconoce así: si la carga no se
arma con las piezas y supera su total, L = (n − 1)·mref + mref,k con mref =
todas las pesas y el resto armado con piezas (7.1.2-15b; sin resto, 15a).
ServiceMET no registra las diferencias ΔIj: se toman como cero y su u(Ij)
cuenta en cada paso. Los puntos sin indicación no se calculan.

Falta: convección (falta la diferencia de temperatura pesas–aire), la
incertidumbre en uso y la pesada mínima (anexo del certificado) y los ejemplos
H2/H3 y de la Guía SIM.

**Avance (2026-11-09, cierre de la fase 3):**

- **Convección** (7.1.2-13, Anexo F) en pesas E1, E2 y F1: el ΔT pesas–aire
  sale del tiempo de estabilización que registra ServiceMET (más de 30 min →
  3 K; más de 15 min → 5 K; sin dato → 7 K). Valores **por aprobar**; quedan
  en la configuración del método (fase 6).
- **Incertidumbre en uso, global y pesada mínima** (`motor/uso.js`, 7.4, 7.5,
  C2.2-16, G-9): u²(W) = αW² + βW²·R² con s de una lectura, excentricidad con
  su efecto completo (7.4.4-10), temperatura (7.4.3-1, KT del fabricante o el
  límite de la R76 por la clase) y empuje (7.4.3-4); el ajuste u²(E) = A + B·I²;
  la recta E = a1·R por el origen; U(W) ≈ U(0) + C·R y Ugl ≈ U(0) + C·R +
  |a1·R| por rango, y la pesada mínima por exactitud y factor de seguridad.
  Supuestos **por aprobar**: ΔT del lugar 5 K, KT de la R76 con factor 1,
  k = 2. Va en el **anexo** del certificado (los dos modelos), que no forma
  parte del certificado y se agrega a pedido del cliente (casilla en el
  registro).
- **Validación**: H2 (multi-escalón, opción 1) y H3 (sustitución,
  7.1.2-15a/b) en `motor.euramet.test.js`; los ejemplos G1, G2 y G3 de la
  Guía SIM en `motor.sim.test.js`. La guía combina valores redondeados y toma
  ν = 100 para las componentes tipo B; con esa convención el motor da sus
  u(E), νeff, k y U; sin redondear en el camino (y ν = ∞, como EURAMET v4) su
  U queda hasta 4,5 % menor en G1 y dentro del 1 % en G2. Términos de uso que
  la Guía SIM 2009 trata distinto que EURAMET v4 (tara, linealización por
  intervalo) no se validan con ella.

## Fase 4 — Registro de calibración: lista, editor y revisión

**Base de datos** (migración `018_calibracion_registros.sql`; no usar
`CAL_CERTIFICADOS`, que ya es de los equipos):

- `CAL_REGISTROS`: uno por servicio (código de ServiceMET), correcciones
  superpuestas por columna (JSON), clase con su origen, estado, huella del
  envío, versión, observación, la composición elegida a mano para cada carga
  y, al aprobar, la configuración del método y el resultado del cálculo. El
  número y la revisión del certificado llegan con la fase 5.
- `CAL_REGISTROS_HISTORIAL`: cada creación, corrección, envío, retiro,
  aprobación, observación y reapertura, con valor anterior y nuevo por campo,
  usuario y hora del servidor (7.5.2).
- `CAL_APROBADORES` (migración 019, como `ST_APROBADORES` de Soporte): a
  quién delega el jefe de Calibración la revisión, con versión e historial.

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

**Avance (2026-11-06):** Calibración › Certificados (`ServiciosPanel`,
`ServicioModal`, `domain/servicios.js`). Lista de los servicios de ServiceMET
del período (por defecto, el año en curso) agrupada por SECA del libro, con
búsqueda, técnico, fechas y filtros por calidad de los datos (con errores, con
avisos, técnico sin identificar, sin observaciones). Cada servicio abre su
detalle de solo lectura en el orden de RECA, con los avisos en la sección a la
que pertenecen, el estado de cada patrón en la fecha del servicio y los puntos
acordados del instrumento, que Calibración edita ahí mismo
(`PuntosAcordadosModal`, con motivo e historial). Falta lo que convierte la
lista en registro: correcciones, composición de cargas, cálculo, revisión y
aprobación (ver el avance siguiente).

**Avance (2026-11-06, registro):** cada servicio de la lista tiene su
registro (`calibration.registros.js`, rutas `/calibration/registros/:codigo`).
El detalle permite **corregir** cada sección (`CorreccionesModal`): los datos de
ServiceMET no se tocan, la corrección se guarda aparte con motivo y queda en el
historial; la sección «Correcciones» muestra el valor de ServiceMET junto al
corregido y lo restaura. Los campos que en ServiceMET son una lista (método,
regla, ajuste, Sí/No, unidad) se corrigen con la misma lista. La clase del
instrumento se declara con su origen (placa, aprobación de modelo o pedida por
el cliente). El servicio corregido vuelve a pasar por el adaptador y el motor,
así que avisos y resultados se rehacen al guardar. Estados: Borrador → En
revisión (requiere un cálculo; se guarda la huella de los datos) → Aprobado u
Observado; el técnico puede retirarlo de revisión y el jefe de Calibración
reabrir uno aprobado con motivo. Revisa el jefe de Calibración, que no puede
aprobar lo que envió él mismo; para aprobar, el cálculo no puede ser
provisional ni haber cambiado los datos desde el envío. La lista muestra el
estado de cada registro. Probado en DataMET_prueba (migración 018 aplicada):
corregir, enviar, retirar y restaurar. La aprobación no se pudo probar ahí
porque todos los cálculos de prueba son provisionales (faltan piezas y valores
de termohigrómetros).

**Avance (2026-11-06, cierre de la fase 4):**

- **Composición de cada carga:** en el presupuesto de cada punto, «Elegir
  piezas» abre las piezas registradas de los juegos del servicio; se guarda
  solo si suman exactamente la carga, con motivo e historial, y entra en la
  huella del envío. El motor la usa en lugar de la regla; si deja de servir
  (se corrigió la carga, cambió el juego) avisa y vuelve a la regla
  (`COMPOSICION_INVALIDA`). «Volver a la regla» la quita. No se ofrece en
  cargas de sustitución ni con piezas supuestas.
- **Avisos antes de enviar:** «Enviar a revisión» abre una confirmación con
  los errores y avisos de los datos y del cálculo (sin repetir), cada uno con
  enlace a su sección, y advierte si el cálculo es provisional. Los avisos de
  RECA ya los da el adaptador o el motor (excentricidad > 2d, lectura lejos de
  la carga > 4d, U > 3d, patrones sin certificado o sin verificar, técnico sin
  identificar, textos dañados, puntos sin indicación, carga de excentricidad).
  El de rango reducido sin Min′ o Max′ queda para cuando ServiceMET registre
  ese alcance.
- **Diagrama de excentricidad:** la plataforma como la dibuja ServiceMET
  (posiciones de `soporte/domain/plataforma.js`, esquema de calibración
  «Rectangular 5F», «Cuadrada A», «5»), con la diferencia de cada posición
  con el centro y en rojo las mayores que 2·d; la tabla suma esa columna.
- **Aprobadores:** el jefe de Calibración los elige en Certificados ›
  Aprobadores (migración 019). Revisan (aprobar u observar) el jefe y sus
  aprobadores, nunca lo propio; reabrir un registro aprobado queda para el
  jefe. Los permisos se leen de DATA_USERS en cada solicitud. La lógica es
  común con Soporte (`services/aprobadores.js`).

Probado en DataMET_prueba (migración 019 aplicada): diagrama, confirmación de
envío con enlace a la sección, envío y retiro. La elección de piezas se vio
con un juego simulado en el navegador, porque en la base de pruebas solo
E2-005 tiene piezas (3, de 200 a 500 mg) y ningún servicio lo usa solo; el
motor la cubre con pruebas. Los aprobadores no se pudieron ver en pantalla
porque el usuario de prueba no es jefe de Calibración (la API responde 403,
como corresponde); el servicio tiene sus pruebas.

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

**Avance (2026-11-09):**

- **Documento** (`components/certificado/CertificadoDocumento.jsx`,
  `certificado.css`): las hojas A4 con el diseño de la hoja CERT (se exportó
  la hoja del libro a PDF como referencia): encabezado con el logotipo, marca
  de agua del símbolo, datos generales, resultados y notas, con los
  logotipos del libro (`src/assets/certificado`). El contenido lo arma el
  servidor (`calibration.certificado.js`) como textos ya formateados y series
  de los gráficos: así se congela al autorizar y se vuelve a dibujar igual.
  Agregados de la propuesta (sección 7 de la fase 0, **textos por aprobar**):
  columna k, clase con su origen («III (placa)», «III *» si la pidió el
  cliente), ajuste del instrumento, errores antes del ajuste (las precargas,
  en una tabla horizontal), gráfico con AS FOUND, nota de incertidumbre al
  95,45 %, «la desviación estándar corresponde a una sola indicación», nota de
  datos del cliente, método citando EURAMET v4.0 y la Guía SIM. Las tablas
  largas siguen en otra hoja con su cabecera; las notas van en hoja aparte
  salvo que los resultados ya ocupen más de una.
- **Reglas de contenido** (para confirmar con el laboratorio): alcance «Min′:
  la menor carga del ensayo hasta Max» si el ensayo llegó a Max (98 %), o
  «hasta Max′: la mayor carga» si no (EURAMET 4.2); patrones con el alcance
  de sus piezas registradas («1 g a 5000 g»), trazabilidad con el
  certificado vigente en la fecha de calibración; condiciones ambientales
  con la media corregida del termohigrómetro; el emp o la tolerancia con los
  decimales del instrumento; error y U con el redondeo de la decisión 3;
  riesgo «< 5,00» por debajo del 5 %, como el libro. El año del número es el
  de la creación del registro en DataMET+ (equivale a «registrar el servicio
  en el libro»).
- **Vista previa y PDF**: «Certificado» en el detalle del servicio, con lo que
  impide autorizarlo (sin número, sin trazabilidad, cálculo provisional) y
  avisos. El PDF es una imagen por hoja (el mismo generador de Soporte,
  `rasterizar.js` ahora admite otro contenedor), con «BORRADOR» hasta emitir.
- **Emisión** (migración 020, `calibration.emision.js`): el jefe de
  Calibración **autoriza** el registro aprobado (se fija el número, se
  comprueba que no lo tenga otro certificado y se congela el contenido en
  `CAL_EMISIONES`); descarga el **PDF para firmar** (lleva en /Keywords la
  huella de la emisión), lo firma con su firma digital y lo **sube**:
  DataMET+ exige la firma, que sea el PDF de esa emisión y la fecha de la
  firma (si no la puede leer, la pide), lo archiva en
  `CAL_DOCUMENTOS_DIR\<año>` con el nombre del libro y su huella, sin
  sobrescribir, y el certificado queda **emitido**. Antes de firmar se puede
  **anular la autorización** con motivo (la emisión no se borra y su número
  de emisión se vuelve a usar).
- **Reemisión**: «Abrir revisión» con motivo devuelve el registro a borrador;
  la emisión siguiente (02, 03…) repite revisión, aprobación, autorización y
  firma; lleva «Revisiones del certificado» y, en el pie de cada hoja, a qué
  emisión reemplaza. Al emitirla, la anterior queda reemplazada (se conserva
  con su PDF). El detalle lista las emisiones con su estado y su PDF.
- Probado: pruebas del contenido, de las reglas de la firma y un flujo
  completo simulado (autorizar, subir firmado, abrir revisión, reemitir,
  anular). En DataMET_prueba (migración 020 aplicada) no se pudo autorizar de
  verdad: los cálculos de prueba son provisionales y el usuario de prueba no
  es jefe de Calibración.

**Avance (2026-11-09, rediseño a pedido del usuario):**

- **Página del registro** en vez de ventanas (`components/registro/`), con la
  dirección `/calibracion/certificados/<servicio>`, como el editor de informes
  de Soporte: encabezado y panel de estado con las acciones que tocan
  (enviar, aprobar, observar, autorizar, subir el firmado, abrir revisión…);
  pestañas «Datos del servicio · Resultados · Vista previa · Historial»; los
  datos de ServiceMET se corrigen en el lugar, sección por sección, con
  «ServiceMET: … · Restaurar» bajo cada dato corregido y las listas de
  ServiceMET donde corresponde; índice de secciones con sus avisos; barra
  «N datos sin guardar · Motivo · Guardar» (Ctrl+S) y aviso al salir. La
  elección de piezas se despliega bajo el presupuesto del punto. Al costado,
  el **pre-informe**: el certificado tal como saldría, que se recalcula en el
  servidor con los cambios sin guardar (`POST …/vista-previa`, no escribe
  nada). Se quitaron `ServicioModal`, `CorreccionesModal`, `ComposicionModal`
  y `CertificadoModal`; quedan ventanas solo para confirmar (enviar,
  autorizar, subir el firmado, motivos).
- **Modelo sugerido de certificado** (`CertificadoProfesional.jsx`,
  `profesional.css`), sin tocar el actual: inspirado en certificados de
  laboratorios acreditados (p. ej. los DAkkS de Mettler-Toledo): portada con
  la identificación, declaraciones de trazabilidad y alcance, resumen de
  resultados (error máximo, U máxima, conformidad) y firmas; encabezado con
  el n.º, la acreditación y la página en cada hoja; secciones numeradas
  (datos de la calibración, resultados, declaraciones); tablas de cabecera
  oscura con masa de referencia, indicación, error, U, k, emp y conformidad;
  gráfico de errores con barras ±U y la banda del emp; patrones y ambiente
  en tabla. La vista previa elige entre «Modelo actual» y «Modelo sugerido»;
  se autoriza y firma con el actual hasta que el laboratorio apruebe el
  sugerido. Sus textos (declaraciones) son una propuesta.

Falta en la fase 5: la carpeta `CAL_DOCUMENTOS_DIR` en el servidor y la
prueba de punta a punta con un certificado real firmado (firma digital de
Digicert/ADSIB). El anexo ya tiene la incertidumbre en uso, la pesada mínima,
la USP ⟨41⟩ y las condiciones del instrumento (2026-11-10, ver la fase 7).

## Fase 6 — Configuración del método

- Pantalla para ver y editar la versión en borrador: parámetros (k, probabilidad,
  redondeo, valores por defecto, umbrales de avisos, componentes activas),
  tablas (emp por tramos, convección, densidades por material) y textos del
  certificado (método, notas, reglas de decisión).
- Aprobación solo del jefe de Calibración; quien la redacta no la aprueba.
  Historial de versiones con diferencias.
- Al aprobar una versión nueva, los registros en borrador se recalculan con
  ella; los emitidos no cambian (conservan su versión).

**Avance (2026-11-09):** Calibración › **Método** (`components/metodo/`,
`calibration.metodo.js`, migración 021 con `CAL_METODO_VERSIONES` y
`CAL_METODO_HISTORIAL`).

- Se editan: incertidumbre del empuje (5a/5b), kD, convección (se aplica,
  clases, ΔT por estabilización y sin dato), densidades por material (con sus
  palabras clave; gana la primera fila), umbrales de avisos, información en
  uso (k, ΔT, KT, factor, cargas de la tabla), pesada mínima (exactitudes y
  factores) y todos los textos del certificado.
- **Reglas de cálculo** (desde 2026-11-10, a pedido del usuario: que el
  laboratorio no dependa del programador): s de repetibilidad en cada carga
  (ensayos que encierran la carga, EURAMET 7.1.1, o la mayor de todos, como
  el libro), factor de cobertura (t de Student con la probabilidad elegida, o
  k fijo), cifras y sentido del redondeo de U, fórmula del aire (CIPM-2007 o
  aproximada), método de excentricidad (3 o 1), factor del emp en servicio
  (2 = NB 23001), banda de guarda de la regla conservadora (|E| + f·U ≤ T),
  umbral del riesgo que se escribe «menor que», regla de la clase sugerida
  (Tabla 3 de la R76 o solo n, como el libro) y los límites de la USP ⟨41⟩.
  Son opciones entre cálculos ya programados y probados, no fórmulas libres:
  cada una tiene su prueba automática y su fila en Validación (caso «Opciones
  de la configuración del método»), así un cambio de configuración no obliga
  a revalidar el programa (7.11.2). Una versión guardada antes recibe cada
  regla nueva con el valor que reproduce su cálculo. La página avisa si el
  texto «Incertidumbre» del certificado no dice la probabilidad o el k que se
  eligió. Las tablas normativas (emp de la R76 y la R111, F2.1) no se editan.
- Borrador → vigente: lo redacta el personal de Calibración (un borrador a la
  vez, con motivo; control de concurrencia por revisión) y lo aprueba el jefe
  de Calibración, que no puede haberlo redactado ni editado. La anterior queda
  reemplazada; las descartadas quedan con su historial. Ninguna se borra.
- La versión 1 la crea el sistema la primera vez que se abre la pantalla, con
  los valores de «Configuración inicial»; el jefe la aprueba ahí.
- Los registros sin aprobar se calculan con la vigente; los aprobados,
  autorizados y emitidos con la suya (`CAL_REGISTROS.configuracion`), también
  sus textos. El contenido congelado de cada emisión guarda la versión.
- Página como la del registro: secciones editables con las marcas (amarillo
  sin guardar, azul distinto de la versión anterior), barra de guardado
  (Ctrl+S), al costado los cambios frente a la versión de la que partió y la
  pestaña Historial con las versiones y sus diferencias.

Migración 021 aplicada y registrada en `DataMET_prueba` (2026-11-09).

Ajustes pedidos antes de las pruebas (2026-11-09):

- En la barra lateral, **Certificados** es un desplegable con **Registros** y
  **Método de cálculo** (la dirección sigue siendo `/calibracion/metodo`).
- Pestaña **«Cómo se calcula»** en el registro (y botón en Resultados): el
  cálculo paso a paso con los números del servicio y la ecuación de cada
  paso: densidad del aire y empuje (5a o 5b según se conozca ρa1),
  repetibilidad, excentricidad y, por punto, m_ref = m_N + δm_c + δm_B, E,
  presupuesto con el aporte de cada componente, νeff, k, U, lo que va al
  certificado y la conformidad con su riesgo. El presupuesto nombra la
  ecuación del empuje que se aplicó de verdad (antes decía 5b aunque faltara
  ρa1) y lecturas iguales dan s = 0 exacto. Desde 2026-11-10 es el cálculo de
  **cada certificado**: su n.º (el emitido o el que llevará), las reglas del
  método con que se calcula (versión y cada regla en palabras), los datos
  registrados (instrumento, patrones con su certificado, ambiente, lecturas de
  repetibilidad, excentricidad y error, y lo corregido en el registro), los
  pasos generales, la tabla de todos los puntos (m_ref, I, E, u, νeff, k, U,
  T, conformidad) y el detalle de cada uno. Desde Certificados › Emitidos,
  «Cómo se calcula» abre el registro en esa pestaña.
- **Certificados › Emitidos** (`GET /calibracion/emitidos`,
  `components/emitidos/`): el libro de certificados. Cada n.º con su emisión
  vigente, el cliente y el instrumento de la emisión firmada (del contenido
  congelado), la fecha de la firma, quién autorizó y la cadena de
  reemisiones con sus motivos; estados Vigente, Por firmar (autorizado sin
  el firmado) y Anulado (autorización anulada antes de firmar). Búsqueda por
  n.º, cliente, instrumento, ID. o serie, filtro por año; abre el registro o
  el PDF firmado. Ahí se agregarán los históricos del Excel (fase 7).
- **Equipos › Patrones** (`GET /calibracion/patrones/estado`,
  `components/patrones/`; está con los equipos porque sus datos se cargan en
  la ficha de cada equipo: esta vista solo los resume, no guarda nada): qué
  le falta hoy a cada juego de pesas y
  termohigrómetro (en el gestor, tipo, piezas, certificado vigente, valores
  transcritos, verificados) y en cuántos servicios del año dejó el cálculo
  provisional, según su estado el día de cada servicio. Ordenados por los
  servicios que destraban; «Piezas y valores» abre su ficha. En
  `DataMET_prueba` (2026-11-09): 35 patrones, ninguno listo; los 844
  servicios de 2026 son provisionales; TH-05 (520), TH-04 (387) y F1-101
  (291) son los primeros a completar.
  En Certificados › Registros, un aviso dice cuántos servicios del año salen
  provisionales por sus patrones y lleva a Equipos › Patrones.
- **Certificados › Validación** (`calibracion/validacion.js`,
  `GET /calibracion/validacion`, migración 022): los ejemplos de EURAMET
  (Anexo H: H1, H2, H3), de la Guía SIM (G1, G2, G3), la tabla G.2 de la GUM
  y CIPM-2007 frente a la fórmula aproximada se recalculan con el motor del
  servidor; cada valor de la guía junto al del sistema, con su criterio
  (8 casos, 189 valores, todos dentro; desde 2026-11-10, 9 casos y 209
  valores con el de las opciones del método). Las pruebas automáticas usan los
  mismos datos. El personal de Calibración registra la corrida como
  evidencia de la versión de la aplicación (CAL_VALIDACIONES: resultados,
  huella SHA-256, quién y cuándo; al verla se comprueba la huella). Base del
  informe de validación de la fase 7.

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

**Avance (2026-11-09, primera corrida paralela):** 106 certificados del libro
(una copia, CARE) recalculados con DataMET+ en `DataMET_prueba`; informe en
[calibracion-corrida-paralela.md](calibracion-corrida-paralela.md). Coinciden
el n.º, s, excentricidad, errores (≤ 0,2 d en el 94 %) y la conformidad donde
ambos la evalúan. Por resolver antes de emitir: clase del instrumento (el libro
la deduce), tolerancias del cliente por rango, regla de la s, USP ⟨41⟩ y
condiciones del instrumento en el anexo, y cargar piezas y valores de los
patrones.

**2026-11-10:** resueltas la clase (sugerida por la R76, confirmada por el
ingeniero; sin ella no se envía ni se aprueba), el emp vacío (NB 23001 por
omisión, como el libro) y las tolerancias del cliente por rango. Segunda
corrida: tolerancia en 937 de 949 puntos y conformidad igual en el 98 % de los
puntos comparables. Después: la regla de la s y las demás decisiones del método
pasan a «Método de cálculo» (fase 6), y el anexo suma la **USP ⟨41⟩** (a pedido
en cada registro: repetibilidad 2s/m con s ≥ 0,41 d a 5 % de Max, exactitud de
5 % a 100 % de Max, adecuación de las pesas con U ≤ ⅓ de la tolerancia y peso
mínimo de muestra; límites en «Método de cálculo») y las **condiciones del
instrumento y la instalación** que revisó el técnico. Los valores de los
patrones los carga el personal de Calibración en producción.

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
| Repetibilidad | s por intervalo (la mayor de los dos ensayos que encierran la carga); ν = n − 1 de la s usada. Configurable: la mayor de todos, como el libro | EURAMET 7.1.1.3 |
| Sustitución | 7.1.2-15a/b | Decisión 8 |
| Regla conservadora | \|E\| + U(E) ≤ T (banda de guarda 1·U) | Decisión 7 |
| emp en servicio | 2 × emp de verificación (R76 Tabla 6) | NB 23001; R76 3.5.2 |
| Riesgo «menor que» | < 5 % | Hoja CERT del libro |
| Clase sugerida | Tabla 3 de la R76 (si admite varias, la de menor exactitud) | Corrida paralela |
| USP ⟨41⟩ | Tolerancia 0,10 %; carga 5 % de Max; s ≥ 0,41 d; 2·s/m; U de las pesas ≤ T/3 | Hoja INCO del libro |
| Avisos | Excentricidad > 2d; lectura vs carga > 4d; U > 3d | Alertas actuales de RECA |
| Composición de cargas | Menos piezas; desempate a confirmar | Decisión 4 |
