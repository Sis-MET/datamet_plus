# Análisis del registro de calibración en Excel (F-VMET-02-7.2 v.24)

Análisis del libro `F-VMET-02-7.2 Registro de calibración v.24 (2026) MGC.xlsm`
que usa Calibración para registrar las calibraciones de balanzas y emitir sus
certificados. Sirve de base para llevarlo a DataMET+.

**Cómo se analizó.** Se leyeron las 24 hojas (valores y unas 36 800 fórmulas), las
consultas de Power Query, los vínculos, los gráficos y los 35 módulos VBA
directamente del archivo, sin abrir Excel ni ejecutar macros. Cada hallazgo
indica la hoja y la celda. Las referencias normativas remiten a las skills del
proyecto (`euramet-cg-18`, `guia-sim-ipfna`, `oiml-r76`, `oiml-r111`,
`gum-iso-iec-guide-98-3`, `nb-iso-17025`). El ejemplo cargado en el libro es
una balanza de 600 g, d = 0,01 g, calibrada en El Alto (630 hPa) el 2026-10-26.

## Resumen

- **El libro hace bien lo esencial**: sigue el modelo de la Guía SIM / EURAMET
  (E = I − mref; incertidumbre de la indicación y de la masa de referencia;
  Welch-Satterthwaite; empuje del aire con la densidad medida; convección;
  deriva; cargas de sustitución; reglas de decisión simple y conservadora;
  pesada mínima; USP <41>) y ya lee los datos de ServiceMET desde SQL.
- **Tiene errores de cálculo que llegan al certificado.** Los más graves:
  1. el «riesgo asociado %» impreso está mal calculado (10,56 % en el ejemplo;
     el cálculo correcto del propio libro da 1,43 %);
  2. la corrección por empuje del aire se aplica con el **signo invertido**;
  3. k se calcula al 95 % (1,97) y no al 95,45 % de EURAMET, y **el
     certificado no imprime k**;
  4. la U se redondea a decimales fijos y puede quedar con una sola cifra y
     redondeada hacia abajo.
- **Pierde datos de ServiceMET**: solo 12 de hasta 60 puntos de linealidad
  (14 servicios tenían más), 5 de 6 posiciones de excentricidad (28 servicios)
  y no registra qué pesas formaron cada carga (las deduce un algoritmo).
- **El registro no cumple bien 7.5 / 7.11 / 8.4**: una copia del libro por
  ingeniero, el registro vigente se sobrescribe al corregir, el historial no
  dice quién ni por qué, la identidad es el usuario de Windows, la contraseña
  de protección está en el código VBA, los datos maestros viven en una base
  Access en OneDrive y la autorización y la fecha de emisión quedan fuera
  (firma digital externa).
- **La arquitectura de Soporte técnico sirve casi tal cual**: originales de
  ServiceMET intactos, correcciones superpuestas con historial, avisos antes de
  emitir, emisión con copia congelada, reemisión con revisiones (7.8.8) y PDF
  archivado con huella. Lo nuevo es el **motor de cálculo** y los **datos
  maestros metrológicos** (pesas con corrección, U, densidad; termohigrómetros
  con su U).

## 1. Cómo funciona hoy

```text
ServiceMET (teléfono del técnico)
   └─► SQL DataMET.dbo.DATA_SERVICIOS_DATOS_CALIBRACION   (1 fila ancha por balanza)
          └─► Power Query → hoja CSV
                 └─► macro «CopiarDatos_Servicios»: pide el SECA, filtra por la persona
                     dueña del archivo (MGC, JOR, AGF) y por cada balanza:
                        RECA (formulario) ─► CÁLCULOS + VALORES + CALC
                        ALLDATA (1 fila de ~750 campos) ─► CARE (registro vigente)
                                                         └─► REOR (copia por guardado)
   CERT / CALC / INCO leen CARE por número de certificado
          └─► macro «GUARDARARCHIVO» → PDF en OneDrive\...\PC-EMIN\2026\
                 └─► firma digital (fuera del libro; verificación en digicert.bo)
```

Otras fuentes:

| Origen | Tablas | Uso |
|---|---|---|
| SQL `DataMET` | `DATA_SERVICIOS_DATOS_CALIBRACION`, `DATA_CLIENTES`, `DATA_PLANTAS` | Servicios, clientes y plantas. |
| Access `BASE DE DATOS CENTRAL.accdb` en `D:\OneDrive\...\PA-CDGI\` | `PERS`, `ICLI`, `EQPE`, `EQTE`, `EQUI_VIGENTE` | Personal, instrumentos de clientes (con los puntos de ensayo acordados), juegos de pesas, termohigrómetros y certificado vigente de cada juego (corrección, U y emp por valor nominal). |
| Libro externo `Efecto de convección.xlsx` | — | Solo lo usan cuatro gráficos de CÁLCULOS; ninguna fórmula depende de él. |

Al abrir, el libro pregunta «1 Registrar nueva calibración / 2 Emisión de
certificados». La carga es **en lote por SECA**: todas las balanzas de la orden
se pasan a RECA, se calculan y se registran en CARE sin revisión intermedia; la
revisión ocurre después, en CERT.

## 2. Mapa de hojas

| Hoja | Función | Notas |
|---|---|---|
| IDEN | Identificación del formulario: código F-VMET-02-7.2, versión 24, aprobación 2023-05-04, subformularios. | |
| CSV | Consulta a `DATA_SERVICIOS_DATOS_CALIBRACION` (2 384 servicios del 2025-06-23 al 2026-10-30). | Agrega `SECA MOD` (clave derivada del SECA). |
| RECA | Formulario del registro: cliente, instrumento, patrones, precarga, ajuste, condiciones, ensayos, sustitución, emp, regla de decisión, observaciones. | Contiene alertas «REVISAR». |
| CÁLCULOS | Motor de cálculo: aire, excentricidad, repetibilidad, emp/tolerancias, errores, presupuesto de incertidumbre, conformidad y riesgo, curvas E(I), U(I), pesada mínima, convección, redondeo. | 3 622 fórmulas. |
| VALORES | Inventario de pesas (≈243 piezas) y armado automático de cada carga: mc, U, emp y densidad combinada. | 17 173 fórmulas. |
| CALC | Resultados formateados para el certificado y datos de los gráficos. | Lee CARE por número de columna. |
| ALLDATA (oculta) | Una fila con ~750 campos (entradas y resultados) para copiar a CARE. | |
| CARE | Registro de certificados (233 en esta copia). | Se sobrescribe al corregir. |
| REOR | Copia de cada guardado (277 filas). | Historial sin autor ni motivo. |
| RERE | Recupera un certificado de CARE al formulario para corregirlo. | |
| CERT | Certificado (3 hojas A4). | Lista de revisión manual al pie. |
| INCO | Información complementaria: USP <41>, pesada mínima, curvas. | **Rota (#REF!)**. |
| TRAZ | Control de trazabilidad por SECA: patrones usados, certificado, enlace al PDF en OneDrive, fecha, intervalo. | |
| COMP | Comparación interlaboratorio (registro 22-01, 2022). | Independiente del certificado. |
| Hoja2 / EQUI_VIGENTE / EQPE2 / EQTE / PERS / ICLI / DATA_* | Datos maestros copiados de Access y SQL. | |
| DATOS DE RELLENO, Hoja3 | Listas desplegables, figuras de plataformas. | |

## 3. Datos que llegan de ServiceMET

`DATA_SERVICIOS_DATOS_CALIBRACION` es una fila de ~425 columnas por balanza:

- **Identificación:** `codigo_registro`, cliente, planta, `personal`, `seca`,
  `n_reca`, `sticker`, `cod_metrica`, `cod_int`, `tipo_servicio` (CAL.B, CAL.BL).
- **Patrones:** `equipo1..5` (juegos de pesas) con certificado, ente,
  estado y `cantidad` (piezas en clase M); `equipo6..7` son los
  termohigrómetros (TERM1/TERM2).
- **Instrumento:** tipo, marca, modelo, serie, unidades, ubicación y hasta tres
  rangos (`cap_max`, `d`, `e`, `dec` 1..3).
- **Lugar:** fecha, hora de inicio, tiempo de estabilización de pesas y de
  balanza, 14 condiciones (vibración, polvo, temperatura, nivelación…) con foto
  y comentario.
- **Precarga:** 6 cargas con su indicación (as found).
- **Ajuste:** si se ajustó, tipo y pesas usadas.
- **Ambiente:** hora, HR, t y presión al inicio y al final.
- **Excentricidad:** forma de la plataforma, indicador, carga, **6 posiciones**
  con indicación y retorno.
- **Repetibilidad:** **3 cargas × 10 lecturas** con retorno a cero.
- **Linealidad:** método y método de carga (sustitución), **hasta 60 puntos**
  con carga, indicación y retorno.
- **Cierre:** recomendaciones, observaciones, emp, % de tolerancia, factor de
  seguridad, **regla de aceptación**, foto, estados, `session_id`.

Lo que el Excel no aprovecha o pierde:

| Dato de ServiceMET | Excel | Servicios afectados |
|---|---|---|
| Puntos de linealidad 13–60 | Solo carga 12 | 14 (13–14 puntos) |
| Posición 6 de excentricidad | Solo 5 | 28 |
| Retorno a cero de cada punto | Se copia pero no se usa en el cálculo | todos |
| Fotos y comentarios de condiciones | No se usan | todos |
| Qué pesas formaron cada carga | No existe: VALORES lo deduce | todos |

Calidad de los datos (2 384 servicios):

- Textos libres con variantes del mismo valor: método «Ascenso evaluando ceros /
  a ceros / continúo / continuo / contínuo»; regla «Simple / SIMPLE /
  Conservadora / Conservada / Ninguna»; emp «Sí / Si / S� / NB 23001».
- **Caracteres dañados** («S�», «m�todo 1»): problema de codificación al subir.
- **Técnico sin identificar**: 278 servicios con «Usuario» o «Usuario sin datos»,
  y el mismo técnico escrito de 3 o 4 formas.
- Uso real: 4,7 % multirango; 9,6 % con sustitución (Método 1: 203, Método 2:
  26); regla de decisión Ninguna 1 082, Simple 1 066, Conservadora 105;
  **ajuste antes de calibrar en el 66 %**; repetibilidad con 5 lecturas en la
  mayoría (3 en 559, 10 en 233).

## 4. Cálculos, uno por uno

Marca: ✔ correcto según la norma · ⚠ discutible o incompleto · ✖ error.

### 4.1 Densidad del aire (CÁLCULOS A1:F6)

- ✔ Fórmula aproximada (EURAMET A1.1-1 = R111 E.3) con la media de las
  condiciones inicial y final. En El Alto (630 hPa) está dentro del rango que da
  EURAMET (600–1 100 hPa), no del de la R111 (900–1 100 hPa).
- ✖ u(HR): la diferencia inicial-final está en %, pero el coeficiente de
  sensibilidad (−9×10⁻³) es por unidad de fracción: esa componente sale 100
  veces mayor. Hoy sobreestima u(ρa) (en el ejemplo, la mitad de la varianza
  viene de ahí).
- ⚠ u(p) fija en 20 hPa aunque la presión se mide; u(t) y u(HR) solo con la
  variación inicial-final: falta la incertidumbre del termohigrobarómetro
  (certificados LP-CC-T/H/P ya registrados en EQTE).
- ⚠ u de la fórmula 2,2×10⁻⁵ (la de CIPM-2007) para la fórmula aproximada,
  cuya incertidumbre es 2,4×10⁻⁴.

### 4.2 Masa de referencia (VALORES y CÁLCULOS C36:W64)

- ⚠ **Composición de cada carga deducida, no registrada.** VALORES recorre las
  pesas de los juegos declarados de mayor a menor y arma cada carga (algoritmo
  codicioso). Si el técnico usó otras piezas (2 × 100 g en vez de 200 g), mc, U
  y emp no son los reales. NB/ISO/IEC 17025 7.5.1 pide registrar lo necesario
  para repetir la medición.
- ✔ mc = nominal + corrección; U y emp de la carga **sumados linealmente**
  (EURAMET 7.1.2.1, correlación supuesta); densidad combinada armónica.
- ✔ Opciones para u(δmc): U/2, emp/√3 o clase M3 (selector J65). ⚠ U/2 supone
  k = 2 en todos los certificados de pesas.
- ✔ Deriva D = kD·U con kD 1, 2 o 3 (selector N65), u = D/√3 (EURAMET
  7.1.2-10/11).
- ✖ **Empuje con el signo invertido**: mref = mc − δmB (F36), cuando la guía
  dice mref = mc + δmB (EURAMET 7.1.2-1; SIM 4.2.4). En el altiplano δmB es
  apreciable: con pesas de fundición gris (7 100 kg/m³) ≈ 6,5 mg/kg, que el
  signo duplica a 13 mg/kg de error (un 26 % del emp de una pesa M1).
- ✖ «Caso B» (balanza sin ajustar): suma una constante 0,02/8 000 que no se
  multiplica por la masa (en el ejemplo, a 1 g domina la corrección). La Guía
  SIM (caso B1) usa −m·δρas/ρc, y propone tomar δρas = 0 con su incertidumbre.
  En la incertidumbre aparece otra constante sin documentar (0,00545526 kg/m³).
- ⚠ Incertidumbre del empuje: fórmula desarrollada correcta (EURAMET 7.1.2-5a),
  pero u(ρ) fija en 70 kg/m³ para todas las pesas (H3), aunque una de fundición
  gris tiene 300; las densidades de cada pieza están escritas a mano en
  VALORES, no vienen del certificado. La opción «límites» (R65 ≠ 1) usa las
  cotas para pesas R111 (5c/5d), que no valen fuera de ±10 % de 1,2 kg/m³: en
  el altiplano no deberían ofrecerse.
- ⚠ Convección: interpola la tabla F2.1 de EURAMET (parábolas por tres puntos)
  con un ΔT que no se mide (se deduce del tiempo de estabilización declarado).

### 4.3 Indicación (CÁLCULOS A8:E31 y B53:F64)

- ✔ Repetibilidad: s por carga; se usa la mayor de las tres para todos los
  puntos (más conservador que EURAMET, que toma la mayor de las dos que
  encierran la indicación). ⚠ Los grados de libertad (B66) salen de la carga con
  más lecturas, no de la s que se usa.
- ✔ Redondeo d0/√12 y dL/√12. ⚠ En multirango, para d0 se usa la d del rango de
  la carga (debería ser la de cero, d1) y la selección de d compara primero
  contra el Max del último rango: con rangos en orden creciente, toda carga toma
  la d del rango más alto. Hay que confirmarlo con un caso multirango real.
- ✔ Excentricidad: diferencia de cada posición respecto del centro,
  u = I·|ΔI|máx/(Lecc·√12) = EURAMET 7.1.1-10. ⚠ Solo 5 posiciones.

### 4.4 Error, incertidumbre y k (CÁLCULOS F36:AA64, RECA K95:L107)

- ✔ E = I − mref, con I = IL − I0. ✔ u(E) = √(u²(I) + u²(mref)).
  ✔ νeff por Welch-Satterthwaite.
- ✖ **k = T.INV.2T(0,05; νeff)**: 95 % (1,97 con ν = 200). EURAMET v4.0 pide
  95,45 % (2,00); la tabla correcta está en CÁLCULOS Y87:Z92 y no se usa. La
  Guía SIM admite «aproximadamente 95 %», pero la regla debe ser una sola y
  declarada.
- ✖ El certificado no imprime k por punto ni su razón cuando k ≠ 2 (GUM 7.2.3 d;
  EURAMET 8.3). Solo dice «nivel de confianza aproximado del 95 %».
- ⚠ Alerta «REVISAR» si U > 3d (RECA M95): útil, pero arbitraria y no
  documentada.
- ✖ RECA L95: el redondeo usa `$F$434` (debía ser `$F$34`).

### 4.5 Cargas de sustitución (RECA A110:K125, VALORES BW246:CD265, macro DATAMET)

- ✔ Método 1: u²(LTn) = n²·u²(mref) + 2(n − 1)·u²(I) (EURAMET 7.1.2-16a).
- ✖ La macro reconoce la sustitución solo si existe una carga **exactamente
  igual a 500**: cualquier otra carga patrón no se procesa.
- ⚠ Método 2 suma las incertidumbres de las sustituciones linealmente: no
  coincide con EURAMET 7.1.2-15 (suma en cuadratura). Hay que documentar su
  fundamento o corregirlo.
- ⚠ Densidad de la carga de sustitución fija (7 100 ± 300 kg/m³), aunque el
  texto del certificado habla de agua.

### 4.6 Tolerancias y clase (CÁLCULOS G24:AB39)

- ⚠ **La clase se deduce de n = Max/e** (≤ 1 000 IIII; ≤ 10 000 III; ≤ 100 000
  II; si no, I). La R76 asigna la clase por e y n juntos (Tabla 3) y, en un
  instrumento aprobado, la marca el fabricante. En multirango usa los umbrales
  500/5 000/50 000, que son los de la Tabla 4 (otra cosa).
- ✔ emp «NB 23001» = emp en servicio de la R76 (1e, 2e, 3e por tramos),
  por rango. Alternativas: % de la carga o tolerancias por tramos.

### 4.7 Conformidad y riesgo (CÁLCULOS I36:R47, CALC F35:N46)

- ✔ Regla simple: conforme si |E| ≤ T. Regla conservadora: |E| + U(E) ≤ T.
  ✔ Riesgo en CÁLCULOS: probabilidad de que el error real esté fuera de ±T con
  una normal de media E y desviación u(E).
- ✖ **El riesgo impreso viene de CALC!H35**, que mezcla una celda vacía (σ ≈ 0)
  y la **U expandida y redondeada** como si fuera la desviación típica. En el
  ejemplo el certificado dice 10,56 % y el valor correcto es 1,43 %.
- ⚠ La regla conservadora usa U(E) de calibración. EURAMET 7.5.3 formula la
  conformidad con U(W) en uso. Ambas se usan; la elegida debe quedar documentada
  (NB/ISO/IEC 17025 7.1.3 y 7.8.6).

### 4.8 Curva E(I), U(I), incertidumbre global y pesada mínima

- ✖ E(I) y U(I) se ajustan con LINEST **sin ponderar ni test χ²** (EURAMET
  Anexo C pide mínimo χ² ponderado). Las filas vacías entran al ajuste como
  puntos falsos en I = 0 con el último error copiado. La elección
  recta/parábola por correlación siempre favorece la recta.
- ⚠ U(W=0) y U(W=Max) (AH25:AH26) no siguen término a término EURAMET 7.4.5-1a:
  a cero incluye la excentricidad de la carga máxima y omite dL.
- ✖ Pesada mínima: con tolerancia 0 % da −1 409 g (AH30); INCO, que la
  presenta, está rota (#REF!).
- ✔ USP <41>: 2s/m ≤ 0,10 % con s ≥ 0,41d (en INCO, hoy rota).

### 4.9 Redondeo y presentación

- ✖ U se redondea a «decimales de d + 1» (tabla CÁLCULOS M93:M150):
  0,008 14 g → «0,008» (una cifra significativa y hacia abajo). GUM 7.2.6 pide
  a lo sumo dos cifras significativas y es práctica no redondear U hacia abajo.
- ⚠ Los resultados se guardan en CARE como **texto ya redondeado con coma** y
  luego se reutilizan en cálculos (riesgo, gráficos).
- ✖ Número de certificado con `YEAR(TODAY())` (RECA F13, ALLDATA A2) y `-26`
  fijo (RECA F8): una calibración de diciembre emitida en enero cambia de año.
- ✖ CERT A121 siempre dice «REVISAR» (compara un texto con 15).

## 5. El certificado frente a NB/ISO/IEC 17025 7.8 y EURAMET §8

| Requisito | Estado en CERT |
|---|---|
| Título, laboratorio, n.º único en cada hoja, fin del certificado | ✔ |
| Cliente y dirección | ✔ (sin contacto) |
| Lugar, fecha de calibración | ✔ (lugar = ubicación del instrumento) |
| Fecha de emisión | ⚠ «la de la firma digital»: no la registra el sistema |
| Método | ✔ «P-VMET-02-7.2 elaborado en base a SIM MWG7/cg-01/V.00» |
| Condiciones ambientales | ✔ (media de inicio y fin) |
| Patrones y trazabilidad | ✔ texto por juego (sin bloquear patrones vencidos) |
| Resultados con unidades: excentricidad, repetibilidad, errores, U | ✔ |
| **k y probabilidad de cobertura** | ✖ sin k; «aprox. 95 %» |
| **Resultados antes y después del ajuste** (7.8.4.1 d) | ✖ el «as found» de precarga se calcula pero no se imprime (66 % se ajusta) |
| Declaración de conformidad con regla y a qué aplica | ✔ texto de la regla; ✖ riesgo mal calculado |
| Datos del cliente identificados (7.8.2.2) | ⚠ la tolerancia y el rango de uso del cliente no se marcan como tales |
| Elaborado / autorizado por | ⚠ autorización por firma digital externa; «Rev. por» son iniciales escritas a mano en una celda |
| Reproducción solo completa | ✔ |
| Sin intervalo de recalibración | ✔ |
| Información adicional en anexo (incertidumbre en uso, pesada mínima) | ✖ INCO rota |

## 6. Registro, correcciones y control

- **Una copia del libro por persona** (el nombre del archivo filtra al técnico):
  CARE queda repartido, la numeración RECA vive en cada copia y no hay una vista
  única de lo emitido.
- **CARE se sobrescribe** al corregir (busca el número y pisa la fila). **REOR**
  agrega una fila por guardado: es el único historial, pero sin autor ni motivo
  (7.5.2).
- Autor: usuario de Windows o de Office (`Environ("UserName")`,
  `Application.UserName`), no una cuenta del sistema (7.5.1, 7.11.3 a).
- La protección de hojas usa una contraseña escrita en claro en el VBA.
- Datos maestros en Access sobre una ruta local de OneDrive, copiados al libro
  al actualizar; los intervalos de calibración de las pesas se deducen de la
  primera letra del código (E 24 meses, F 12, M 6) en vez del plan del
  laboratorio; el libro muestra los días desde la calibración del patrón pero no
  impide usar uno vencido.
- La revisión previa a emitir es una lista de «SÍ» escritos a mano (CERT
  B121:H121); no hay estados ni quién autorizó en el registro.
- 35 módulos VBA, de los cuales `BORRADORES` (1 822 líneas) es código comentado.

## 7. Errores y brechas priorizados

| # | Dónde | Problema | Efecto | Prioridad |
|---|---|---|---|---|
| 1 | CALC H35 | Riesgo con U expandida como σ y celda vacía | Riesgo impreso falso (10,56 % vs 1,43 %) | Alta |
| 2 | CÁLCULOS F36 | Empuje con signo invertido | Error en mref de 2·δmB (hasta ~13 mg/kg en altura) | Alta |
| 3 | RECA K95 / CERT | k al 95 % y sin imprimir | U menor que la exigida por EURAMET; certificado incompleto | Alta |
| 4 | Macro DATAMET | 12 puntos y 5 posiciones como máximo | Datos medidos que no llegan al certificado | Alta |
| 5 | VALORES | Composición de cargas deducida | mc/U/emp pueden no ser los reales; no reproducible | Alta |
| 6 | CÁLCULOS M93:M150 | Redondeo de U a decimales fijos, hacia abajo | U subdeclarada | Alta |
| 7 | CERT | Sin resultados antes del ajuste | Incumple 7.8.4.1 d | Alta |
| 8 | Proceso | Copias por persona, CARE sobrescrito, sin autor ni motivo | 7.5.2, 7.11.3, 8.4 | Alta |
| 9 | CÁLCULOS E36, Q53 | Constantes del caso B sin fundamento | Corrección e incertidumbre incorrectas sin ajuste | Media |
| 10 | CÁLCULOS F6 | u(HR) en % con coeficiente por fracción; u(p) fija; sin U del THB | u(ρa) mal estimada | Media |
| 11 | CÁLCULOS H3, VALORES J | u(ρ) única y densidades a mano | Empuje mal evaluado en clase M | Media |
| 12 | Macro DATAMET | Sustitución solo con carga 500 | Sustituciones con otro patrón no se procesan | Media |
| 13 | CÁLCULOS A72:D83 | E(I) sin ponderar, con puntos falsos | Curva y ejemplos erróneos | Media |
| 14 | CÁLCULOS AH30, INCO | Pesada mínima negativa; INCO rota | Información complementaria inútil | Media |
| 15 | CÁLCULOS G24 | Clase deducida de n | Emp de otra clase | Media |
| 16 | CÁLCULOS C53:D53 | d0 y d en multirango | Incertidumbre de redondeo errónea | Media (verificar) |
| 17 | VALORES CB254 | Método 2 suma lineal | Sin fundamento normativo documentado | Media |
| 18 | RECA F13, F8 | Año del certificado con TODAY() y «-26» fijo | Número con el año del registro, no de la calibración (se mantiene por decisión del laboratorio; DataMET+ reproduce la regla sin el «-26» fijo) | Baja |
| 19 | RECA L95, CERT A121 | Referencia errónea y una alerta que siempre salta | Ruido en la revisión | Baja |

## 8. Cómo llevarlo a DataMET+

### 8.1 Principios

1. **Mismo esquema que Soporte técnico**: la fila de
   `DATA_SERVICIOS_DATOS_CALIBRACION` es la observación original y no se toca;
   las correcciones se superponen (campo → valor) con historial; la emisión
   congela una copia completa; la reemisión abre revisiones con motivo
   (NB/ISO/IEC 17025 7.5.2 y 7.8.8). Reutilizar `soporte.revisiones.js`, el
   avisador previo a emitir (`domain/avisos.js`), la hoja A4, el PDF y su
   archivado con huella (`ST_INFORMES_DOCUMENTOS`).
2. **Un modelo de datos limpio entre ServiceMET y el cálculo.** Un adaptador
   convierte la fila ancha en un objeto estructurado (instrumento con rangos[];
   condiciones inicio/fin; patrones usados; precarga[]; excentricidad
   {plataforma, carga, posiciones[]}; repetibilidad[{carga, lecturas[],
   ceros[]}]; errores[{carga, cero, indicación, retorno}]; sustitución; ajuste;
   criterio {emp, tolerancia, regla}). Sin límite de 12 puntos ni 5
   posiciones. El adaptador tiene versión: cuando ServiceMET cambie de columnas,
   se agrega un mapeo nuevo sin tocar el motor.
3. **Motor de cálculo puro y probado**: una función que recibe el modelo, los
   datos maestros y la **configuración del método**, y devuelve resultados y el
   presupuesto completo (cada componente con valor, distribución, u, ν y
   origen). Sin redondeos intermedios; el redondeo es otra capa.
4. **Lo editable es la configuración, versionada y aprobada**: políticas (k
   fijo o t al 95,45 %; probabilidad; u(p) por defecto; uso de la U del THB;
   kD; convección sí/no; fórmula del aire; caso A/B; regla de redondeo;
   umbrales de alertas; textos del certificado; reglas de decisión), cada una
   con vigencia y aprobación en el control de cambios (`APP_CAMBIOS`, 7.11.2).
   Cada certificado guarda la versión del motor y de la configuración con que se
   calculó, para reproducirlo años después. Si más adelante se quiere que las
   fórmulas mismas sean editables (expresiones), cada edición pasa a ser una
   versión nueva que hay que validar; conviene decidirlo con el laboratorio
   (sección 9).
5. **Datos maestros metrológicos en SQL** (reemplazan Access y las hojas
   copiadas), integrados con `DATA_EQUIPOS_CAL` / `CAL_CERTIFICADOS`:
   - juegos de pesas y **piezas** (nominal, identificación, clase, material,
     densidad y u(ρ) —medida o supuesta R111 B.7—);
   - **certificado de cada juego por pieza**: corrección, U, k, emp, apto, con
     las condiciones de su calibración (ρa1 para EURAMET 7.1.2-5b) y vigencia;
   - termohigrobarómetros con la U de t, HR y p de su certificado;
   - instrumentos de clientes (puntos acordados de excentricidad, repetibilidad y
     linealidad, hoy en ICLI);
   - firmantes autorizados y personal (7.8.2.1 o).
6. **Registro único**: un solo registro para todo el laboratorio, sin copias por
   persona. La numeración y los nombres de archivo se mantienen tal cual
   (decidido el 2026-11-05; ver
   [calibracion-fase0-propuesta.md](calibracion-fase0-propuesta.md), sección 3).
7. **Flujo con estados y permisos**: pendiente (dato de ServiceMET) → en
   elaboración → revisado (otra persona, con la lista de revisión convertida en
   avisos automáticos y confirmación) → emitido/autorizado por un firmante →
   revisiones. Quién y cuándo, del servidor (7.5.1, 7.8.1.1). Bloquear la
   emisión si un patrón o el THB estaba vencido el día de la calibración.
8. **Certificado conforme a 7.8**: agregar k y probabilidad por punto, resultados
   antes y después del ajuste, identificación de los datos del cliente, regla de
   decisión aplicada y riesgo bien calculado; el anexo de información adicional
   (incertidumbre en uso, pesada mínima, USP <41>) separado del certificado.

### 8.2 Validación (7.11.2, 7.11.6)

- Pruebas automáticas con los ejemplos resueltos de EURAMET (Anexo H; H1 ya está
  como vector en la skill `euramet-cg-18`) y de la Guía SIM (Apéndice G).
- **Corrida paralela con el Excel**: recalcular en DataMET+ un lote de
  certificados ya emitidos (los 233 de esta copia y los de las otras) y explicar
  cada diferencia. Las diferencias por los errores 1, 2, 3, 6, 9 y 10 son
  esperadas y deben documentarse en el informe de validación.
- Casos de borde: multirango, sustitución (Método 1 y 2), unidades mg/g/kg,
  cero en lecturas, 3/5/10 repeticiones, más de 12 puntos, 6 posiciones,
  presión < 600 hPa (fuera del rango de la fórmula aproximada).

### 8.3 Migración

- Importar CARE y REOR de cada copia del libro como registros heredados de solo
  lectura (para consultas, trazabilidad y reemisión), con su PDF de OneDrive
  enlazado.
- Cargar los datos maestros desde Access y desde EQUI_VIGENTE, revisando
  densidades y certificados pieza por pieza.

## 9. Decisiones del laboratorio (2026-11-05)

Tomadas por el usuario el 2026-11-05. Están también en la sección «Decisiones
del laboratorio» de las skills `euramet-cg-18` y `guia-sim-ipfna`.

| # | Tema | Decisión | Qué implica |
|---|---|---|---|
| 1 | Guía de referencia | **EURAMET cg-18 v4.0**; la Guía SIM se sigue citando y, donde difieren, manda EURAMET. | Empuje: una sola corrección δmB = −mN(ρa − ρ0)(1/ρ − 1/ρc) haya o no ajuste previo (sin la constante del «caso B»), con incertidumbre 7.1.2-5a o 5b con la densidad real de cada pesa; excentricidad por el **método 3** de EURAMET 5.3: ΔIecc,i = (ILi − I0i) − IL1; s por intervalo según 7.1.1.3. El laboratorio debe actualizar el procedimiento P-VMET-02-7.2 y el texto «Método utilizado» del certificado (documentos controlados, 8.3). |
| 2 | Factor k | **t de Student al 95,45 % con νeff** (Welch-Satterthwaite). | k calculado por punto y **impreso en el certificado** con la probabilidad de cobertura (y la razón si k ≠ 2). |
| 3 | Redondeo de U | **Dos cifras significativas, hacia arriba**; el error al mismo decimal. | Una sola función de redondeo para todo el sistema, con pruebas; los valores sin redondear se guardan. |
| 4 | Piezas de cada carga | **El técnico solo elige el juego** (p. ej. F1-001); **DataMET+ arma cada carga** con las piezas del juego según una regla fija y documentada (la de menos piezas) y quien elabora el certificado la puede corregir antes de emitir. | Los certificados de pesas y termohigrómetros se transcriben al gestor de equipos de DataMET+ (ver abajo). La composición de cada carga queda en el registro; cada corrección, en el historial. |
| 5 | u(t), u(HR), u(p) del aire | **U del certificado del termohigrobarómetro + variación inicio-fin.** | Los datos maestros guardan la U de t, HR y p de cada THB con su vigencia; se corrige el error de unidades de la HR. |
| 6 | Clase del instrumento | **Dato registrado** (placa o aprobación). Sin clase marcada, si el cliente pide conformidad NB 23001, **vale la clase que pide el cliente** como requisito acordado (7.1.3). | Campo nuevo en el instrumento con su origen (placa/aprobación o pedida por el cliente); la pedida se identifica en el certificado como dato del cliente (7.8.2.2). DataMET+ sugiere la clase compatible con la Tabla 3 de la R76 (con e = d) y avisa si la registrada no encaja. |
| 7 | Regla conservadora | **\|E\| + U(E) ≤ T** con la U de calibración (banda de guarda ILAC G8). | Se corrige el riesgo impreso: probabilidad bilateral con u(E) = U/k. |
| 8 | Método 2 de sustitución | **EURAMET 7.1.2-15a/b para ambos métodos.** | Desaparece la suma lineal del Excel. |
| 9 | Qué es editable | **Parámetros, tablas y textos**, con versión y aprobación del jefe de Calibración; las fórmulas en código, validadas con pruebas. | Tabla de «configuración del método» versionada; cada certificado guarda la versión del motor y de la configuración usadas. |
| 10 | Autorización y firma | **Se autoriza en DataMET+** (quién y cuándo); el firmante firma el PDF con su firma digital fuera y lo sube; DataMET+ guarda el PDF firmado con su huella y fecha. **La fecha de emisión es la de la firma digital** (como hoy: «corresponde a la fecha de la firma digital»). | Estados «autorizado» y luego «emitido (firmado)»; DataMET+ registra la fecha de la firma al recibir el PDF firmado y lo archiva como en Soporte técnico. |

Detalles resueltos el mismo día (ya incorporados en la tabla): la composición
de las cargas la arma DataMET+ a partir del juego elegido (reemplaza la
decisión original de que el técnico marcara las piezas), la excentricidad se
calcula por el método 3, la fecha de emisión es la de la firma digital y, sin
clase marcada, vale la clase que pide el cliente.

**Transcripción de certificados al gestor de equipos.** Hoy el gestor del
módulo Calibración (`DATA_EQUIPOS_CAL`, `CAL_CERTIFICADOS`) guarda por equipo el
número de certificado, la fecha, el período, el vencimiento y el ente. Falta lo
que el Excel tenía en EQUI_VIGENTE y VALORES:

- **Juegos de pesas**: las piezas del juego (valor nominal, marca para los
  duplicados, material) y, por certificado, la corrección, U y k de cada pieza,
  el emp y si está apta; densidad y u(ρ) de cada pieza (medida o supuesta por
  material, R111 Tabla B.7, diciendo cuál); condiciones ambientales de la
  calibración del juego (para ρa1).
- **Termohigrobarómetros**: por certificado y magnitud (t, HR, p), los puntos
  calibrados con su corrección, U y k.
- La transcripción la registra una persona y **la verifica otra** antes de que
  el certificado de la pesa pueda usarse en un cálculo (NB/ISO/IEC 17025
  7.11.6; mismo patrón de revisión que ya usan los certificados del módulo).
- Al calcular, DataMET+ usa el certificado que estaba vigente **en la fecha de
  la calibración** y bloquea la emisión si no había uno vigente.

## 10. Cambios sugeridos en ServiceMET

- Enviar **códigos**, no textos libres (método, regla, sí/no, plataforma) y
  números como números; corregir la codificación (UTF-8).
- Identificar al técnico por su usuario, nunca «Usuario sin datos».
- Elegir los juegos de pesas y el termohigrobarómetro **de la lista del gestor
  de equipos de DataMET+** (mismo código), no como texto libre.
- Mantener el «as found» (precarga o lecturas antes del ajuste) como ensayo con
  sus cargas, para imprimirlo.
- Declarar la clase y la aprobación del instrumento si las tiene.
- Registrar la versión de ServiceMET en la fila (ya se controla en
  `CAL_SERVICEMET_VERSIONES`) para elegir el mapeo del adaptador.

## Apéndice: columnas de ServiceMET usadas por el Excel

| Bloque | Columnas | Destino en RECA |
|---|---|---|
| General | `planta`, `n_reca`, `sticker`, `cod_metrica`, `fecha_servicio`, `personal` | A3, B9, D9, I8, C11, C12 |
| Negociación | de `SECA MOD` (caracteres 7–8) | B8 |
| Instrumento | `tipo_equipo`, `marca`, `modelo`, `serie`, `cod_int`, `ubicacion`, `unidades` | B16:B22, B30 |
| Rangos | `cap_max1..3`, `d1..3`, `e1..3`, `dec1..3` | B31:F34 (multirango si `cap_max2` ≠ 0) |
| Patrones | `equipo1..5` y `cantidad1..5` (solo clase M) | D37:E41 |
| Termohigrómetros | `equipo6`, `equipo7` | E76:E77 |
| Ajuste y tiempos | `ajuste`, `tipo`, `cargas_pesas`, `tiempo_estab`, `t_ope_balanza` | C51:D56 |
| Ambiente | `hora`, `hri`, `ti`, `patmi` / `hora_fin`, `hri_fin`, `ti_fin`, `patmi_fin` | B76:B79 / B129:B132 |
| Precarga | `precarga1..5`, `p_indicador1..5` | A44:B48 (la 6.ª se pierde) |
| Excentricidad | `tipo_plataforma`, `puntos_ind`, `carga`, `indicacion1..5`, `retorno1..5` | B84:F89 (la 6.ª se pierde) |
| Repetibilidad | `repetibilidad1..3`, `indicacion{1..3}_{1..10}`, `retorno…` | E93:J104 |
| Linealidad | `metodo`, `metodo_carga`, `lin1..12`, `ind1..12`, `retorno_lin1..12` | B93, A109, A96:C107 (13–60 se pierden) |
| Cierre | `mant_soporte`, `venta_pesas`, `reemplazo`, `observaciones`, `emp`, `indicar`, `factor`, `regla_aceptacion` | B136:B138, A141, C146:C149 |
