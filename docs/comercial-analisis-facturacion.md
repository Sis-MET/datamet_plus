# Análisis del control de facturación en Excel (2026 FACTURACION metrica.xlsx)

Análisis del libro `2026 FACTURACION metrica.xlsx` (carpeta `D:\Comercial`)
con el que Comercial lleva el registro de facturas, cobros, márgenes y
comisiones. Sirve de base para el apartado **Comercial** de DataMET+.

**Cómo se analizó.** Se leyeron las 10 hojas (valores y unas 145 000
fórmulas), las 9 tablas, las 51 tablas dinámicas, las 19 segmentaciones y los
28 gráficos directamente del archivo, sin abrir Excel. Los clientes se
cruzaron con `DATA_CLIENTES` de `DataMET_prueba` y las cotizaciones con el
formato de `DATA_COTIZACION`. Bitrix24 se consultó en modo solo lectura con el
webhook de ServiceMET: negociaciones desde 2025, empresas y datos fiscales
(§6).
Cada hallazgo cita la hoja, la fila o la columna. El libro estaba guardado el
2026-11-18.

## Resumen

- **Una fila por factura con 353 columnas.** Se escriben a mano unas 130: la
  cabecera de la factura, el monto repartido en **51 categorías de ingreso**,
  hasta 4 pagos, 15 costos de almacén, 3 cotizaciones, 12 personas, 17
  cantidades de equipos y datos del cliente. El resto (224 columnas, 133 340
  fórmulas) calcula totales, saldo, mora, utilidad, margen y comisión.
- **Casi todo lo que se escribe ya existe en otro sistema**: la factura en el
  sistema de facturación, el cliente y su NIT en `DATA_CLIENTES`, la cotización
  y el responsable en Bitrix24 o en el cotizador, quién ejecutó y cuántas
  balanzas en ServiceMET, el costo en almacén. El Excel los **vuelve a
  copiar**.
- **La cotización es la llave.** El código de cotización lleva el código del
  cliente de DataMET (`0114-C04-25 1` → cliente `0114`). En 502 de 578
  facturas vigentes ese código coincide con el cliente facturado; con eso una
  factura se puede enlazar sola con el cliente, la cotización y los servicios.
- **Bitrix24 ya tiene buena parte de lo que se copia** (§6): 525 de las 578
  facturas encuentran su negociación por la cotización; el responsable coincide
  en el 99 % y el nº de balanzas, la regional, el técnico y la nota de salida
  entre 93 % y 98 %. Bitrix24 **no** tiene el número de factura, los pagos, el
  costo de almacén ni el desglose por categoría, y sus etapas no reflejan si
  algo se facturó o cobró.
- **Errores que hoy están en el libro** (§4): una factura registrada con el
  número de otra, la utilidad de software calculada sobre obra civil, un hueco
  en la regla de comisión y Bs 760 860 de venta de producto sin costo, que se
  ven con margen de 84 % y comisionan al 1 %.
- **Cobranza:** 58 facturas pendientes por Bs 1 129 402,10; Bs 250 785 con
  más de 90 días (12 facturas). La mora se cuenta desde la emisión, sin plazo
  de crédito.
- **Propuesta** (§7): tablas `COM_*` en DataMET con factura, líneas por
  categoría, pagos aplicados a facturas, referencias y personas; alta asistida
  desde la cotización; importación desde el sistema de facturación;
  sincronización de lectura con Bitrix24; reportes en vivo en lugar de las 51
  tablas dinámicas.

## 1. Cómo funciona hoy

```text
Cotización (0114-C04-25 1, 0195-S01-1-26…)     Sistema de facturación (SIN)
        │                                             │ se emite la factura
        ▼                                             ▼
   FACTURAS 2026 (Tabla17) ◄── se copia a mano: Nº, fecha, monto, razón social,
        │                       centro de costo, monto por categoría, cotización,
        │                       responsables, rubro, ciudad, nº de balanzas…
        │◄── pagos: depósito / QR / efectivo, verificado con «comprobante en
        │    Bitrix» (202) o con el extracto del mes (el resto)
        │◄── costo de almacén y nota de salida (ventas de producto)
        ▼
   224 columnas de fórmulas: total, estado, saldo, días de mora, utilidad,
   margen, comisionable azul (0,6 %) / verde (1 %), totales por área
        ▼
   51 tablas dinámicas (actualizar a mano) ─► REP 2026, REPORTE 2026,
   REPORTE COM, REPORTE COM (2) + 28 gráficos
```

## 2. Mapa de hojas

| Hoja | Estado | Función | Notas |
|---|---|---|---|
| FACTURAS 2026 | visible | Registro de facturas (`Tabla17`, A3:MO598). | 595 filas, 353 columnas, 12 MB de XML. |
| REP 2026 | visible | 11 tablas dinámicas y 5 gráficos: facturación por mes y área, pagado / por cobrar. | |
| REPORTE 2026 | visible | 36 tablas dinámicas y 23 gráficos: por categoría, rubro, ciudad, responsable, aportes entre áreas, cantidades. | |
| REPORTE COM | visible | Tabla dinámica por factura con montos y márgenes por área y costo de almacén. | Las columnas AB:AC (suma y `EXACT`) están **al lado** de la tabla dinámica: si cambia de tamaño, quedan desalineadas. |
| REPORTE COM (2) | visible | 3 tablas dinámicas filtradas por responsable y mes (base de comisiones). | |
| NIT CORREOS | visible | Maestro de clientes: razón social, NIT, rubro, correo de facturación (+6 columnas «Columna1…6» para más correos). | 185 filas. |
| CORREOS FACT | oculta | Correos de recepción de facturas y **ventana de recepción** («hasta el 25 de cada mes», «del 1 al 22»). | 14 empresas. |
| FACT2021, FACT2022, FACT2023 | ocultas | Años anteriores, cada uno con **otras columnas**. | 2024 y 2025 no están en el libro. |

## 3. La tabla `FACTURAS 2026`

| Columnas | Contenido | Origen hoy |
|---|---|---|
| A:G | #, tipo (SERVICIO / VENTA), Nº, fecha, monto, razón social, centro de costo | A mano, copiado de la factura. |
| H:BF | **51 categorías de ingreso** (6 STIL, 6 STAC, grúas, logística, IBMETRO, compras; 6 CAL; 15 productos; obra civil, logística de venta, 5 «compras internas» entre áreas, alquiler) | A mano, repartiendo el monto. |
| BG:BI | Total, `igual` (`EXACT` monto = total), estado | Fórmula. |
| BJ:BW | Tipo de pago, 4 pagos con fecha, total pagado, saldo, días de mora, pago verificado | A mano + fórmula. |
| BX:BZ, KK:LJ | Totales por área y aportes entre áreas | Fórmula. |
| CA:CR | Nota de salida con su fecha, 15 costos de almacén y su total | A mano + fórmula. |
| CS:FI | Utilidad % (CS:DH) y Bs (DI:DX) de productos, utilidad de servicios (DY:FH) y total (FI) | Fórmula. |
| FJ:GD | 3 cotizaciones con quién las elaboró, responsable Bitrix, ejecutores y apoyo ST/CAL, regional que atendió, observaciones, tipo y rubro de empresa | A mano. |
| GE:HG | Costo real de IBMETRO y compras; margen por categoría | A mano + fórmula. |
| HH:KJ | Comisionable azul (HH:IU, margen 20–30 %, 0,6 %) y verde (IV:KI, > 30 %, 1 %) por categoría | Fórmula. |
| LK:MO | 17 cantidades de equipos (balanzas y pesas por servicio), ciudad, cliente nuevo o regular, regional que cotizó, márgenes por área | A mano + fórmula. |

**Reglas que contienen las fórmulas** (a confirmar con Comercial y
Contabilidad):

- **Neto de impuestos:** monto × 0,84 (IVA 13 % + IT 3 %). Lo que el libro llama
  «utilidad» de un servicio es ese neto: no resta ningún costo.
- **Producto:** utilidad % = (monto × 0,84 − costo de almacén) / monto.
- **Logística:** monto × 0,80 (columnas «-20 %»).
- **IBMETRO y compras para el cliente:** (monto × 0,84 − costo × 0,87) / monto
  (el 0,87 descuenta el crédito fiscal del costo).
- **Comisión:** margen ≤ 19 % no comisiona; 20 % a 30 % → «azul», 0,6 %;
  más de 30 % → «verde», 1 %. Como el margen de un servicio es siempre 84 %,
  **todo servicio comisiona al 1 %**.
- **Estado:** «ANULADO» si la razón social dice ANULADO; «PAGADO» si el total
  pagado es igual al monto; si no, «PENDIENTE».
- **Días de mora:** `HOY() − fecha de emisión` mientras haya saldo.

### Cifras de 2026 (hasta el 18 de noviembre)

| Indicador | Valor |
|---|---|
| Filas / facturas vigentes / anuladas | 595 / 578 / 17 |
| Facturado | Bs 5 801 268,65 (servicio 449 filas, venta 146) |
| Pagadas / pendientes | 520 / 58 (Bs 1 129 402,10) |
| Antigüedad del saldo | 0–30 d: Bs 784 139,60 · 31–60: Bs 71 172,50 · 61–90: Bs 23 305 · > 90: Bs 250 785 (12 facturas, una de Bs 207 120) |
| Pagos | 549 en 521 facturas: 494 con un pago, 26 con dos, 1 con tres; **nunca 4** |
| Pagos anteriores a la factura | 235 de los 547 con fecha (43 %): anticipos; mediana 4 días antes, 19 con más de 30 días |
| Días de cobro (pagos posteriores) | mediana 13, percentil 90: 48 |
| Categorías usadas | 25 de las 51 aparecen en 5 facturas o menos (3 nunca). 463 de las 578 facturas vigentes usan 1 o 2. |
| Centros de costo | 17 combinaciones escritas a mano (`CAL`, `MNT`, `VENT-INST-CAL`, `ALQ-INST-CAL`…) |
| Clientes facturados | 227 razones sociales |

## 4. Hallazgos

### 4.1 Errores en los datos y las fórmulas (corregibles ya en el Excel)

| # | Dónde | Qué pasa | Efecto |
|---|---|---|---|
| 1 | FACTURAS 2026, fila 152 | La factura **149** está registrada con Nº **144** (la columna # dice 149). | Hay dos 144 y falta la 149. |
| 2 | Columna DW «UTILIDAD BS SOFTWARE» | `=AU4*(DG4/100)` multiplica **obra civil** (AU) en lugar de software (AT). | Facturas 99 y 579 muestran Bs 191 637,60 y 156 794,40 (son Bs 2 541 y 2 079); 207 y 566 muestran 0 (son Bs 672 y 7 560). No entra al total de utilidad, pero sí a quien lea la columna. |
| 3 | Comisión azul (HH:IU) | `IF(x<=19,0,IF(AND(x>=20,x<=30),…))`: un margen entre 19 % y 20 % no cae en ningún tramo. | Factura 116 (19,37 %) no comisiona ni en azul ni en verde. |
| 4 | Ventas sin costo de almacén | Si el costo está vacío, el margen sale 84 %. | Facturas 99, 216, 531, 547, 548, 576, 577 y 579: Bs 760 860 de producto con margen desconocido, comisionable al 1 % (≈ Bs 7 609). Casi todas dicen «FALTA NOTA DE SALIDA». |
| 5 | Factura 433 | Dividida en dos filas (La Paz y Santa Cruz) para repartir el monto entre regionales. | Las tablas dinámicas cuentan 2 facturas. Una fila no puede tener dos regionales. |
| 6 | Filas 102, 137, 436, 437, 583 | Sumas escritas como fórmula dentro de celdas de datos (`=3105+325`, `=302500-3025+60390`). | El dato real queda escondido en la fórmula. |
| 7 | Ventas 115 y 425 | Utilidad negativa (−43 % y −22,7 %). | Revisar costo o precio. |
| 8 | Textos libres | `NEUVA`, `pendiente` / `PENDIENTE`, `SIN TECNCO ASIGNADO` / `SIN TECNICO ASIGNADO`, ciudades como «ORURO challapata», responsables combinados con y sin espacio (`A - B`, `A-B`). | Las tablas dinámicas los separan; no se sabe cómo se reparte la comisión entre dos responsables. |
| 9 | «ANULADO» | Se escribe en razón social, tipo de pago, responsable, cotizaciones… | No es un estado: es texto en 10 columnas. |
| 10 | TIPO EMPRESA | «PRIVADA» en las 595 filas. | Columna sin información. |
| 11 | NIT CORREOS | 2 NIT repetidos; correos `…@gmail,com` y `(en blanco)`. | Envíos de factura fallidos. |

### 4.2 Problemas de diseño

- **Retipeo.** La cabecera de la factura se copia del sistema de facturación; el
  cliente, su NIT y su rubro se escriben en cada factura aunque estén en
  `DATA_CLIENTES`; la cotización y el responsable están en Bitrix24; el
  ejecutor y la cantidad de balanzas, en ServiceMET.
- **Categorías como columnas.** Cada año cambian (2021: ~13; 2022: 23; 2023:
  28; 2026: 51), así que **no se pueden comparar años**. Agregar una categoría
  obliga a agregar una columna de monto, de utilidad %, de utilidad Bs, de
  comisionable azul, de comisionable verde y de total.
- **Pagos en 4 casillas.** No admite un pago que cubre varias facturas (está
  en OBS: «CLIENTE REALIZÓ EL PAGO… POR LOS SERVICIOS DE CAL Y MNT»), saldos a
  favor (comentario en FACT2021!N193), devoluciones («depositó Bs 41 000 y se devolvió
  36 900») ni anticipos, que son el 43 % de los pagos.
- **Mora sin plazo.** Cuenta desde la emisión: una factura a 30 días aparece «en
  mora» desde el día 1. Las ventanas de recepción de factura de los clientes
  (CORREOS FACT) tampoco se usan.
- **Maestro de clientes incompleto y duplicado.** NIT CORREOS cubre 102 de los
  227 clientes facturados (6 más con errores de tipeo). `DATA_CLIENTES` cubre
  193 por nombre exacto y 9 parecidos (25 sin ficha) y tiene NIT en 586 de 723
  clientes, pero correo solo en 124 y rubro en 63.
- **Reportes que no se actualizan solos.** 51 tablas dinámicas sobre la misma
  tabla, 19 segmentaciones y 28 gráficos; `HOY()` en G2 cambia la mora cada
  día. Un archivo de 12 MB de hoja (+3 MB de cadena de cálculo) que solo una
  persona puede editar a la vez, sin historial de quién cambió qué.
- **Comisión ligada a un margen que no es margen.** Para servicios el «margen»
  es el neto de impuestos (84 %), y para productos depende de que alguien
  cargue el costo; si falta, la venta comisiona como si fuera de alto margen.

## 5. Qué se puede dejar de escribir

| Dato del Excel | Fuente | Cómo |
|---|---|---|
| Nº, fecha, monto, razón social, NIT, anulación | Sistema de facturación | Importar el registro de ventas (archivo o API, según el sistema; ver §8). |
| Cliente, NIT, rubro, correos | `DATA_CLIENTES`, `DATA_CONTACTOS` | Enlace por código de cliente. Ficha de facturación propia (correos, ventana de recepción, plazo) en `COM_CLIENTES`. |
| Cotizaciones, regional | Negociación de Bitrix24 (COTIZACIÓN, Regional) | Al elegir la negociación (525 de 578 facturas la encuentran). Más adelante, el cotizador de DataMET (`DATA_COTIZACION`, en desarrollo: `260001.COT01`). El código de cliente dentro de la cotización enlaza al cliente (87 %). |
| Monto por categoría (51 columnas) | Ítems de la cotización (`DATA_COTIZACION_ITEMS`, `…_ITEMS_LOGISTICA`) | Bitrix24 solo tiene el total. DataMET+ **propone** las líneas desde la sub área y el tipo de servicio de la negociación, o desde los ítems del cotizador, y la persona ajusta. |
| Responsable Bitrix | Negociación de Bitrix24 (`ASSIGNED_BY_ID`) | Coincide en el 99 % (§6.2). Quién elaboró cada cotización sigue a mano hasta que exista el cotizador. |
| Ejecutor y apoyo ST, nº de balanzas y pesas, ciudad | Negociación de Bitrix24; ServiceMET (servicios, informes, RIM) y `DATA_PLANTAS` | Coinciden con el Excel entre 93 % y 98 % (§6.2). En Calibración, el ejecutor sale de ServiceMET. La ejecución del RIM ya guarda el N.º de factura. |
| Nota de salida | Negociación de Bitrix24 (NOTA DE SALIDA y su fecha) | Coincide en 121 de 123. |
| Costo de almacén | Sistema de almacén | Por confirmar (§8). |
| Cliente nuevo o regular | Historial de facturas | Calculado: primera factura del cliente. |
| Estado, saldo, mora, utilidad, margen, comisión, totales por área | — | Calculados en el servidor; no se guardan a mano. |
| Pago verificado | Extracto bancario / comprobante en Bitrix24 | Conciliación: importar el extracto y sugerir el pago que corresponde. |

## 6. Bitrix24

**Lo que ya existe.** El backend de ServiceMET (`ServiceMET/backend/src/bitrix`)
habla con el Bitrix24 de Métrica por un **webhook entrante** con permiso `crm`:
cliente con reintentos ante el límite de velocidad, sin mostrar nunca el
secreto, y script de verificación `pnpm bitrix:discover`
(`backend/docs/bitrix24-configuracion.md`). Crea **Prospectos** (leads) desde
calibración y soporte y guarda una copia en `form_bitrix` (en
`DataMET_prueba` está vacía). Ese webhook **también lee negociaciones**; no
lee usuarios (`user.get` responde sin permiso: el alcance es solo `crm`).

**Cómo se revisó.** El 2026-11-18, en modo solo lectura y con ese webhook: los
embudos, las etapas y los campos; las 2 788 negociaciones creadas desde 2025,
las 1 306 empresas y sus 614 requisitos (datos fiscales); y, en muestras, los
comentarios, las actividades y las filas de productos. Lo leído quedó en un
archivo local fuera del repositorio; aquí solo van conteos.

### 6.1 Cómo usa Comercial el CRM

**Embudos (negociaciones creadas en 2026: 1 405).**

| Embudo | 2026 | Etapas de facturación y cobro |
|---|---|---|
| Ventas | 538 | Entrega y/o Facturación, Con pendiente de cierre, Cerrado Ganado |
| Calibración | 412 | Para Facturar, Pendiente de pago, Cerrado Ganado |
| Soporte Técnico | 299 | Servicio Concluido, Pre-Factura, Facturado, Cerrado Ganado |
| GOA | 65 | Factura y cierre, Pendiente de pago, Saldo pendiente de pago (también Declaración jurada / licitación, Adjudicación, Contrato) |
| Ejecución de CAL | 41 | Del programado a «CERTs enviados» |
| Ejecución de ST | 41 | De solicitudes internas a «Informes pendientes» |
| Ventas Exwork | 9 | Fabricación, Transporte, Instalación |

**Campos propios que repiten columnas del Excel** (46 campos propios; llenado
en las 1 405 negociaciones de 2026):

| Campo de Bitrix24 | Llenas | Columna del Excel |
|---|---|---|
| COTIZACIÓN (`UF_CRM_1681094866257`) | 1 115 | Las 3 cotizaciones (mismos formatos; 80 con el prefijo «COT »). Además «Cotización servicio interno instalación / calibración» (129 / 123). |
| Persona responsable (`ASSIGNED_BY_ID`) | 1 405 | RESPONSABLE BITRIX |
| Total (`OPPORTUNITY`) | 1 405 | MONTO (el cotizado o ganado, no el facturado) |
| Regional | 826 | REG COTIZÓ / REG ATENDIÓ |
| Ciudad o localidad | 692 | CIUDAD DE SERVICIO |
| Num Balanzas / Num Pesas | 414 / 41 | NRO BLZ … / NRO PSP … |
| Sub área (STIL / STAC), Tipo de servicio ST | 328 / 322 | Categorías H:T |
| Técnico responsable / Técnicos de apoyo | 235 / 238 | RESPONSABLE EJECUCIÓN ST / PERSONAL APOYO ST |
| Nota de salida y su fecha | 155 / 125 | NOTA DE SALIDA, FECHA NOTA DE SALIDA |
| Orden de compra y su fecha, Condiciones de facturación (HES…), Mes a facturar | 615 / 805, 230, 458 | — (no están en el Excel) |
| ¿Está facturado? | 27 | ESTADO (casi no se usa) |
| Ingreso | 0 | — |

**No hay en Bitrix24:** número ni fecha de factura, pagos (las facturas de
Bitrix24 y las cotizaciones del CRM están vacías: 0 y 3), costo de almacén ni
desglose por categoría (en 45 negociaciones ganadas revisadas no hay filas de
productos; el catálogo tiene 9).

### 6.2 Cruce con el Excel 2026

Por el código de cotización (sin la revisión: `0114-C04-25 1` = `114-C04-25`):

| Qué | Resultado |
|---|---|
| Facturas vigentes que encuentran su negociación | **525 de 578** (servicio 391 de 438; venta 134 de 140). 97 encuentran dos o más. |
| Responsable igual al del Excel | **496 de 502** facturas con un solo responsable (99 %); 23 tienen dos. |
| Monto | Igual al de una negociación en 463, a la suma de varias en 11, a menos de 5 % en 4; distinto en 47 (facturación parcial o en varias facturas). |
| Nº de balanzas calibradas | 192 de 201 |
| Regional | 414 de 444 |
| Nota de salida | 121 de 123 |
| Técnico de ST | 181 de 187 |

**Las etapas no reflejan la facturación.** De las negociaciones que ya tienen
factura en el Excel, 70 de Calibración siguen en «Para Facturar», 22 que
comparten cotización con una factura están en «Cerrado Perdido» y «¿Está
facturado?» está marcado en 27 de 650. Al revés, 20 de Calibración en «Para
Facturar» (Bs 78 666) no tienen factura en 2026: pueden estar por facturar o
haberse facturado en 2025.

**GOA:** 14 negociaciones ganadas en 2026 y ninguna factura del Excel con su
cotización; 4 en «Factura y cierre» (Bs 555 900) y 4 con «Saldo pendiente de
pago» (Bs 356 893). Falta saber si GOA factura por otro lado (§8).

**Comprobantes de pago.** En 40 negociaciones de facturas marcadas «COMPROBANTE
EN BITRIX», 12 tienen comentarios con archivos (22 PDF y 11 imágenes) y 5,
actividades con archivo. No hay un campo fijo: se pueden **enlazar**, pero no
leer como pago.

**Empresas ↔ `DATA_CLIENTES`.** El campo «Codigo cliente» de la empresa
(lleno en 473 de 1 306) guarda casi siempre el **código de planta**
(`0458-11`); su primer tramo existe en `DATA_CLIENTES` en 413. 34 clientes de
DataMET tienen más de una empresa en Bitrix24 (una por planta). El NIT está en
los requisitos (`RQ_VAT_ID`, 380 empresas): igual al de `DATA_CLIENTES` en 337,
distinto en 14, solo en DataMET en 45. El sector de actividad (992 empresas)
puede dar el rubro.

### 6.3 Cómo integrarlo

| Paso | Método | Para |
|---|---|---|
| Embudos, etapas y campos | `crm.category.list`, `crm.status.list`, `crm.deal.fields` | Al iniciar y una vez al día. |
| Negociaciones | `crm.deal.list` con `>DATE_MODIFY` desde la última sincronización, en `batch` de 50 | Copia en `COM_BITRIX_NEGOCIACIONES`. |
| Empresas y NIT | `crm.company.list`, `crm.requisite.list` | Enlace con `DATA_CLIENTES` por código y NIT; avisar los NIT distintos. |
| Comprobantes | `crm.timeline.comment.list`, `crm.activity.list` | Mostrar en la ficha del pago el enlace al archivo. |
| Responsables | Tabla de equivalencia ID de Bitrix24 ↔ `DATA_USERS` (11 personas en el cruce) | `user.get` necesita además el permiso `user`. |

DataMET+ está en la red de la oficina (`192.168.1.5`), así que Bitrix24 no
puede avisarle (webhooks salientes); lo práctico es **sincronizar cada 10–15
minutos** lo modificado y guardar la copia, para que los reportes no dependan
de que Bitrix24 responda. Conviene un **webhook propio de Comercial**, solo de
lectura, distinto del de ServiceMET, para poder revocarlo por separado.

**Escribir de vuelta (fase posterior, otro permiso):** al registrar la factura,
marcar «¿Está facturado?», pasar la negociación a «Pendiente de pago» o
«Facturado» y dejar el número de factura en un campo nuevo; al cobrarse,
«Cerrado Ganado». Así el CRM refleja la facturación sin que nadie la mueva a
mano.

## 7. Propuesta para DataMET+

### 7.1 Datos (migración `034_comercial.sql`, tablas `COM_*`)

| Tabla | Contenido |
|---|---|
| `COM_CATEGORIAS` | Catálogo de las categorías de ingreso: área (ST, CAL, VENT, ALQ), subárea (STIL, STAC…), **regla de margen** (neto de impuestos, logística, producto con costo, costo de tercero), vigencia. Mapeo de las columnas de 2021–2026 para comparar años. |
| `COM_FACTURAS` | Número, fecha, tipo, cliente (`DATA_CLIENTES`), NIT y razón social tal como salen en la factura, monto, código de la factura del SIN si se importa, estado (vigente / anulada con motivo), origen (manual / importada). Número único. |
| `COM_FACTURA_LINEAS` | Categoría, monto, cantidad de equipos, **regional que atiende** (resuelve la factura 433), ciudad, costo de almacén o de tercero, nota de salida. El servidor exige Σ líneas = monto (reemplaza `igual`). |
| `COM_FACTURA_REFERENCIAS` | Cotizaciones, nota de salida, RIM, OTST, certificado, negociación de Bitrix24: varias por factura. |
| `COM_FACTURA_PERSONAS` | Responsable comercial, quién cotizó, ejecutores y apoyo, con `DATA_USERS` y **porcentaje** (dos responsables → 50 / 50 u otro reparto). |
| `COM_PAGOS` y `COM_PAGO_APLICACIONES` | Cada pago (fecha, monto, medio, banco, referencia, comprobante, verificación) y a qué facturas se aplica. Admite anticipos, pagos de varias facturas, saldos a favor y devoluciones. |
| `COM_CLIENTES` | Datos de facturación que no están en `DATA_CLIENTES`: correos de recepción, ventana de recepción, **plazo de crédito**. No se modifica `DATA_CLIENTES`, que es de DataMET. |
| `COM_COMISION_REGLAS` y `COM_COMISION_CIERRES` | Tramos de margen y porcentaje con vigencia; cierre mensual congelado (una corrección posterior no cambia una comisión ya pagada). |
| `COM_BITRIX_NEGOCIACIONES` | Copia de las negociaciones (campos de §6.1, etapa, fecha de modificación) y equivalencia de responsables con `DATA_USERS`. Se actualiza sola; no se edita en DataMET+. |
| `COM_HISTORIAL` | Cada alta, corrección y anulación con usuario, hora del servidor y motivo, como en el RIM y Soporte técnico. Nada se borra. |

Estado, saldo, mora (desde el vencimiento: emisión + plazo), margen y
comisionable se calculan en consultas, no se escriben.

### 7.2 Apartado

Área `comercial` en `MODULOS` (`backend/src/services/access.areas.js`) y en
`APP_VIEWS` (`src/shared/components/layout/navigation.js`), con:

- **Facturas:** lista con búsqueda, filtros y chips de estado (pendiente,
  parcial, pagada, anulada); ficha con líneas, pagos, referencias, personas e
  historial; **nueva factura asistida** (elegir cotización → cliente, líneas y
  personas propuestas); importar del sistema de facturación.
- **Cobranzas:** cuentas por cobrar con antigüedad, registro de pagos y
  aplicación a facturas, conciliación con el extracto, aviso a quien cobra.
- **Reportes:** facturación por mes y área, categoría, rubro, ciudad,
  responsable, cliente nuevo o regular, aportes entre áreas; exportación a
  Excel para Contabilidad (el Excel pasa a ser una **salida**, no la fuente).
- **Comisiones** (permiso de Gestión de permisos): por responsable y mes, con
  cierre.
- **Configuración** (jefe del área): categorías, reglas de margen y comisión,
  integración Bitrix24.

### 7.3 Fases

**Estado (2026-11-19):** la fase 1 está programada (migración `034`, apartado
Comercial e importador; ver README, *Comercial*), sin aplicar todavía en la
base. `COM_COMISION_REGLAS` y `COM_BITRIX_NEGOCIACIONES` quedan para las
fases 2 y 4.

1. **Base y migración:** tablas, importador del Excel 2026 (y 2021–2023 con el
   mapeo de categorías), facturas, pagos y cobranzas. Corrida en paralelo con el
   Excel uno o dos meses, comparando totales por mes y saldos.
2. **Bitrix24 y menos retipeo:** sincronización de lectura de negociaciones y
   empresas; **alta asistida desde la negociación** (cotización, cliente,
   responsable, regional, técnicos, balanzas, nota de salida); enlace con
   ServiceMET para Calibración.
3. **Sistema de facturación:** importar las facturas emitidas y anuladas;
   escribir de vuelta en Bitrix24 el estado de facturación y cobro. Las
   facturas se emiten con **Mastersoft**; el importador espera una
   exportación real. La escritura en Bitrix24, con confirmación de
   Comercial, está programada (migración `036`; ver README, *Actualizar
   Bitrix24*).
4. **Reportes y comisiones** con cierre mensual; conciliación bancaria; envío
   de la factura al correo de recepción del cliente (`mailer.service.js`).
   Los reportes, la exportación a Excel para Contabilidad y las comisiones
   con cierre mensual y reglas configurables están programados (migración
   `037`; README, *Comercial*). Decisiones de Comercial para las comisiones
   (2026-11-20): se ganan **al facturar** (por mes de emisión); los
   porcentajes y tramos son **configurables** en una pantalla por Comercial o
   Administración, con los del Excel por omisión (menos de 20 % no comisiona,
   20 % a 30 % el 0,6 %, más de 30 % el 1 %; servicios al 1 %; Calibración,
   logística y «Otros (ST)» no comisionan; una venta sin costo no comisiona
   hasta tener costo), y cada responsable comisiona según el porcentaje
   registrado en la factura (solo los responsables comerciales). La
   conciliación espera un extracto bancario de ejemplo y el envío de facturas,
   el PDF de MiPOS.

## 8. Preguntas abiertas

1. ¿Con qué sistema se emiten las facturas (SIAT del SIN, un proveedor de
   facturación electrónica, el sistema contable)? ¿Exporta el registro de
   ventas o tiene API?
2. ¿Dónde se registran las notas de salida y el costo de almacén?
3. Bitrix24: ¿GOA factura por Métrica (sus negociaciones ganadas no aparecen en
   el Excel)? ¿Quién mueve las etapas de facturación y cobro? ¿Se puede crear
   un webhook propio de Comercial (y dar el permiso `user`)?
4. Reglas: ¿los tramos de comisión son < 20 %, 20–30 % y > 30 %? ¿La logística
   se toma al 80 %? ¿Los servicios comisionan siempre al 1 %? Las columnas de
   comisionable (HH:KI) no incluyen Calibración (Z:AE), la logística (U, AV,
   AW, AZ, BB) ni «Otros (ST)» (Y): ¿esas categorías no comisionan? ¿Cómo se
   reparte entre dos responsables?
5. ¿Quién registra y quién consulta (Contabilidad, Gerencia)? ¿Hay plazos de
   crédito por cliente?
6. ¿La regional (La Paz / Santa Cruz) se asigna por factura o por línea?
