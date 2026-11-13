---
name: euramet-cg-18
description: EURAMET cg-18 versión 4.0 (11/2015), Guía para la calibración de instrumentos de pesaje de funcionamiento no automático (balanzas y básculas) — método de calibración, ensayos de repetibilidad, error de indicación y excentricidad, error E = I − mref, presupuesto de incertidumbre, empuje del aire, cargas de sustitución, factor de cobertura, incertidumbre en uso, pesada mínima y contenido del certificado; una de las cinco normas que Métrica Ltda. (laboratorio acreditado por DTA-IBMETRO) debe cumplir en Calibración. Úsala al diseñar, programar o revisar la toma de datos, los cálculos o la emisión de certificados de calibración de balanzas en DataMET+.
---

# EURAMET cg-18 v4.0 (11/2015) — Calibración de IPFNA

> Resumen con palabras propias para guiar el desarrollo; no es el texto oficial.
> EURAMET prohíbe reproducirla parcialmente: no copies su texto en el código, en
> los certificados ni en documentos. Ante una duda o en una auditoría manda el
> documento original. Los números entre paréntesis son las ecuaciones de la guía.

## Identidad del documento

- **EURAMET Calibration Guide No. 18, versión 4.0 (11/2015)**, *Guidelines on the
  Calibration of Non-Automatic Weighing Instruments* (ref. I-CAL-GUI-018/v4.0).
  Ediciones: 1ª 2009, 2ª 2010, 3ª 2011, **4ª 2015 (vigente)**.
- Traducción oficial al español del **CEM** (España): *Guía para la calibración
  de instrumentos de pesaje de funcionamiento no automático*.
  - Español (CEM): https://www.cem.es/sites/default/files/euramet_cg-18_calibracionipfna.pdf
  - Inglés: buscar «Calibration Guide No. 18» en https://www.euramet.org (publicaciones).
- No es obligatoria por sí misma: es la referencia de buenas prácticas; para
  Métrica es obligatoria porque el laboratorio la declara. La **Guía SIM** (skill
  `guia-sim-ipfna`) es la traducción de la versión 2.0 de esta misma guía.
- No fija límites de incertidumbre: el laboratorio y el cliente acuerdan la
  incertidumbre adecuada al uso (2).

Detalle de la incertidumbre en uso (7.4–7.5) y de los anexos A, B, C, E, F, G
y H: [uso-y-anexos.md](uso-y-anexos.md).

## Cómo encajan las cinco normas

| Norma | Qué aporta |
|---|---|
| ISO/IEC Guide 98-3:2008 (GUM) — skill `gum-iso-iec-guide-98-3` | Marco de incertidumbre en el que se apoya esta guía. |
| **EURAMET cg-18 v4.0** — esta skill | Método vigente de calibración de balanzas y contenido del certificado. |
| Guía SIM MWG7/cg-01 (2009) — skill `guia-sim-ipfna` | Versión anterior (v2.0) del mismo método; ver sus diferencias. |
| OIML R76-1:2006 — skill `oiml-r76` | Vocabulario del instrumento (Max, Min, d, e, clases, emp). |
| OIML R111-1:2004 — skill `oiml-r111` | Pesas patrón y densidad del aire. |

## 4 Aspectos generales

**4.1 Elementos.** Calibrar = aplicar cargas en condiciones especificadas,
determinar el error (o la variación) de la indicación y evaluar su
incertidumbre.

- **Rango (4.1.1):** de cero a Max salvo que el cliente pida Min′–Max′ o cargas
  puntuales; en multi-rango el cliente elige los rangos.
- **Lugar (4.1.2):** normalmente in situ. Si el instrumento se traslada después
  (gravedad, ambiente, transporte), la calibración puede dejar de valer y el
  certificado no debería aceptarse como evidencia de trazabilidad, salvo
  inmunidad demostrada.
- **Condiciones previas (4.1.3):** identificable; sin daños ni suciedad que
  afecten; indicación sin ambigüedad; condiciones normales de uso adecuadas;
  encendido el tiempo de calentamiento; nivelado; cargado al menos una vez
  (mejor varias) cerca de la carga máxima de ensayo.
- Si el instrumento se ajusta habitualmente antes de usarlo, se ajusta antes de
  calibrar (salvo que el cliente diga otra cosa), con los medios del cliente o
  del fabricante (pesas externas o internas). En balanzas de alta resolución
  (mejor que 1×10⁻⁵ de la escala) conviene ajustar justo antes de calibrar y
  justo antes de usar. Cero automático / seguimiento de cero: como diga el
  cliente. In situ, el usuario asegura las condiciones normales, para que
  corrientes de aire o vibraciones queden dentro de la incertidumbre.

**4.2 Carga e indicación.** I = ks·m·g·(1 − ρa/ρ) (4.2.1-1). Masa convencional:
mc = m·(1 − ρ0/ρ)/(1 − ρ0/ρc), ρ0 = 1,2 kg/m³, ρc = 8 000 kg/m³ (4.2.2-2). La
indicación solo coincide con mc cuando ρa = ρas = ρ0, o cuando se pesa al mismo
aire del ajuste un cuerpo de la densidad de la pesa de ajuste (4.2.2-3 a -6).
La variación del aire pesa más que la de la densidad del cuerpo.

- **Convección (4.2.3, Anexo F):** una pesa a distinta temperatura que el aire
  cambia su masa aparente (signo opuesto a ΔT, mayor en pesas grandes). Aclimatar
  hasta que sea despreciable o incluirla en la incertidumbre; relevante en
  pesas F1 o mejores.
- **Empuje sobre la masa de referencia (4.2.4):** E = I − Iref, con
  mref = mcCal + δmB + … (4.2.4-2). Corrección general (4.2.4-3); **tanto si se
  ajustó justo antes como si se ajustó aparte** con aire desconocido, se aplica
  δmB = −mcCal·(ρaCal − ρ0)·(1/ρCal − 1/ρc) (4.2.4-4).

**4.3 Cargas de ensayo.**

- **Patrones de masa (4.3.1):** trazables, con mc (o δmc = mc − mN) y U95, o
  confirmados dentro de emp: mN − (emp − U95) ≤ mc ≤ mN + (emp − U95). Densidad
  cercana a 8 000 kg/m³, superficie y magnetismo adecuados: lo cumplen las pesas
  OIML R111. Su emp o incertidumbre debe ser compatible con d y con lo que pide el
  cliente.
- **Otras cargas (4.3.2):** para repetibilidad, excentricidad, precarga, tara o
  sustitución: fáciles de manejar, centro de gravedad estimable, masa constante,
  densidad estimable; las de baja densidad (arena, grava) requieren vigilar
  temperatura y presión.
- **Cargas de sustitución (4.3.3):** cuando no alcanzan las pesas. La balanza se
  usa como comparador: LT1 = mref; Lsub1 = mref + ΔI1; LT2 = 2·mref + ΔI1; …
  **LTn = n·mref + ΔI1 + … + ΔIn−1** (4.3.3-5a). Con mref formada por varias
  pesas se pueden armar cargas parciales LTn,k = (n − 1)·mref + mref,k + ΣΔI
  (4.3.3-5b). Cada sustitución aumenta mucho la incertidumbre.

**4.4 Indicaciones.** I = IL − I0 (4.4.1-1a). Con deriva lineal:
I = IL − (I0 + I0i)/2, con I0 antes e I0i después (4.4.1-1b). Leer solo con
indicación estable; si no se estabiliza, registrar la media y la variabilidad.
**Registrar las indicaciones originales, no los errores.** Resolución mayor que
d (con acuerdo del cliente): modo servicio dT < d, o método del punto de salto
con cargas de dT = d/5 o d/10: **IL = I′ + d/2 − ΔL** (4.4.2-1); aplicarlo
también sin carga.

## 5 Ensayos

Más mediciones bajan la incertidumbre y suben el costo. El laboratorio y el
cliente pueden acordar detalles, siempre respetando estos mínimos.

**5.1 Repetibilidad.** Misma carga, mismas condiciones. Carga de ensayo sin
calibrar (salvo que sirva para el error), de preferencia de una sola pieza.
Al menos una carga LT, típicamente **0,5 Max ≤ LT ≤ Max** (menor en básculas de
varias toneladas; cerca de Max1 en multi-escalón; cerca del máximo del rango de
escalón menor en multi-rango; otro valor por acuerdo). Puede hacerse en varios
puntos. Cero antes; **≥ 5 aplicaciones, o ≥ 3 si LT ≥ 100 kg**; registrar ILi;
comprobar el cero tras cada retiro (recomendable registrar I0i) y el estado del
dispositivo de cero.

**5.2 Errores de indicación.** **kL ≥ 5 cargas** repartidas en el rango normal o
en los puntos acordados:

- kL = 5: cero o Min; 0,25; 0,5; 0,75 Max; Max (desviación hasta 0,1 Max, con al
  menos 0,2 Max entre cargas consecutivas).
- kL = 11: cero o Min y 10 pasos de 0,1 Max (desviación hasta 0,05 Max, al menos
  0,08 Max entre consecutivas).
- Rango reducido: ≥ 3 puntos incluyendo Min′ y Max′, sin pasos mayores que
  0,15 Max.
- Solo patrones de masa o cargas de sustitución. Cero antes; cada carga una vez,
  de una de estas formas: (1) creciente con descarga entre cargas (uso habitual);
  (2) creciente sin descarga; (3) creciente y luego decreciente (como la
  verificación R76); (4) decreciente desde Max (tolvas). Las 2–4 pueden incluir
  deriva. Multi-escalón: con taras crecientes y cargas ≤ Max1 para leer con d1.
- Puede repetirse para combinarlo con la repetibilidad. Comprobar el cero tras
  cada retiro (recomendable registrar I0j).

**5.3 Excentricidad.** Posiciones (fig. 5.3-1): **1 centro, 2 delante izquierda,
3 atrás izquierda, 4 atrás derecha, 5 delante derecha** (o equivalentes según la
forma del plato; si no se puede usar el centro, solo las otras). Carga
**Lecc ≈ Max/3 o mayor** (o Min′ + (Max′ − Min′)/3), considerando al fabricante
y la R76 para receptores especiales. Multi-rango: solo en el rango de mayor Max
pedido. Carga sin calibrar salvo que sirva para el error. Métodos:

1. Cero; carga en 1 y luego en las otras 4 en cualquier orden.
2. Carga en 1 y tara; luego las otras 4.
3. Cero; carga en 1, retirar, siguiente posición, retirar…; comprobar (y anotar)
   el cero tras cada retiro.
4. Carga en 1 y tara; siguiente posición y de vuelta a 1, alternando; registrar
   cada lectura central IL1i aparte.

Métodos 3 y 4 si hay deriva apreciable; en 2 y 4, cero automático y seguimiento
de cero desconectados.

**5.4 Mediciones auxiliares.** Temperatura del aire cerca del instrumento al
menos una vez (y su rango si el ambiente es controlado); presión o al menos
altitud. Diferencia de temperatura pesas–instrumento o tiempo de aclimatación
(un termómetro en la caja de pesas ayuda). En alta resolución, prueba magnética:
pesar una pesa con un separador no metálico encima y debajo; si difiere,
advertirlo en el certificado.

## 6 Resultados

- **Repetibilidad:** s(Ij) = √[Σ(Iji − Īj)²/(n − 1)] (6.1-1), con la media
  (6.1-2).
- **Error:** **Ej = Ij − mref,j** (6.2-1), con Ij la media si hubo varias
  lecturas; mref,j = mN,j (6.2-2) o mc,j = mN,j + δmc,j (6.2-3); con varias pesas,
  sumas de mN y de δmc.
- **Característica (6.2.2):** función E = f(I) por mínimos cuadrados (6.2-5),
  considerando u(Ej), con un modelo que refleje el instrumento y comprobando su
  consistencia (Anexo C). Puede usarse IN,j = mN,j en lugar de Ij.
- **Excentricidad (6.3):** ΔIecc,i = ILi − IL1 (métodos 1 y 2, 6.3-1);
  ΔIecc,i = (ILi − I0i) − IL1 (método 3, 6.3-2); ΔIecc,i = ILi − IL1i (método 4,
  6.3-3).

## 7 Incertidumbre de la calibración

Se desprecian términos de segundo orden salvo que los de primer orden se
cancelen (JCGM 101). urel = incertidumbre / valor (7-1, 7-2).

**Modelo:** **E = I − mref** (7.1-1); **u²(E) = u²(I) + u²(mref)** (7.1-2); con
sustitución, mref se reemplaza por LTn o LTn,k. Todas las entradas se consideran
no correlacionadas.

### 7.1.1 Indicación: I = IL + δIdigL + δIrep + δIecc − I0 − δIdig0

| Corrección | Incertidumbre típica | Ecuación |
|---|---|---|
| Redondeo en cero δIdig0 | d0/(2√3), o dT/(2√3) con resolución aumentada | 7.1.1-2a/b |
| … instrumento con aprobación R76, cero tras puesta a cero o tara | d0/(4√3) | 7.1.1-2c |
| Redondeo con carga δIdigL | dI/(2√3), o dT/(2√3) (en multi-escalón dI cambia con I) | 7.1.1-3a/b |
| Repetibilidad δIrep (normal) | s(Ij) | 7.1.1-5 |
| … si Ij es la media de N lecturas del ensayo de error | s(Ij)/√N | 7.1.1-6 |
| Excentricidad δIecc (rectangular) | I·\|ΔIecc,i\|máx /(2·Lecc·√3) | 7.1.1-10 |

- Un solo ensayo de repetibilidad con lecturas únicas vale para todo el rango.
  Con varios s, usar **el mayor de los dos puntos que encierran** la indicación.
  En multi-escalón o multi-rango, un s por escalón o rango. El certificado debe
  aclarar si s es de una lectura o de una media.
- Excentricidad: se supone que ΔIecc es proporcional a la distancia y a la carga
  y que el centro de gravedad real no se desvía más de la mitad de la distancia a
  las posiciones del ensayo (7.1.1-9). En notación relativa
  urel(δIecc) = |ΔIecc,i|máx/(2·Lecc·√3) (7.1.1-11).

**u²(I) = d0²/12 + dI²/12 + s²(I) + u²rel(δIecc)·I²** (7.1.1-12).

### 7.1.2 Masa de referencia: mref = mN + δmc + δmB + δmD + δmconv (+ δmK)

- **Certificado de la pesa δmc:** u = U/k (7.1.2-2). Si solo se sabe que está en
  tolerancia y se usa el nominal: δmc = 0 y u = Tol/√3 (7.1.2-3), con Tol = emp
  R111. **Varias pesas: las incertidumbres se suman linealmente**, no en
  cuadratura (se suponen correlacionadas).
- **Empuje δmB:** δmB = −mN·(ρa − ρ0)·(1/ρ − 1/ρc) (7.1.2-4);
  u²rel(δmB) = u²(ρa)·(1/ρ − 1/ρc)² + (ρa − ρ0)²·u²(ρ)/ρ⁴ (7.1.2-5a).
  - Más exacta, útil **en altitud** (si no, la anterior sobreestima): 
    u²rel(δmB) = u²(ρa)·(1/ρ − 1/ρc)² + (ρa − ρ0)·[(ρa − ρ0) − 2(ρa1 − ρ0)]·u²(ρ)/ρ⁴,
    con ρa1 = densidad del aire cuando se calibraron las pesas (7.1.2-5b).
  - ρ y u(ρ): del certificado, del fabricante o del Anexo E1. ρa y u(ρa): de
    temperatura y presión (la humedad influye poco) o de la altitud (Anexo A).
  - **Pesas R111 sin datos de ρ ni ρa** (sin corrección): ajustada justo antes,
    urel ≈ emp/(4·mN·√3) (7.1.2-5c); no ajustada antes,
    urel ≈ (0,1·ρ0/ρc + emp/(4·mN))/√3 (7.1.2-5d); conociendo la variación
    máxima de temperatura ΔT del lugar,
    urel ≈ √(1,07×10⁻⁴ + 1,33×10⁻⁶ K⁻²·ΔT²)·ρ0/ρc + emp/(4·mN·√3) (7.1.2-5e).
    En la 5e solo el término del emp se divide por √3: el texto extraído es
    ambiguo, pero así lo calcula el ejemplo H1 (50 g E2, ΔT = 5 K →
    u(δmB) = 0,103 mg; 220 g → 0,446 mg), verificado al escribir esta skill.
    Son cotas superiores; si frente a d/Max son pequeñas, no hace falta más.
    **Suponen aire dentro de ±10 % de 1,2 kg/m³** (nota al pie de la R111): no
    sirven en el altiplano boliviano (ver «Altitud»).
- **Deriva δmD:** límite D de la diferencia entre certificados sucesivos; si no,
  D = kD·U(δmc) con kD entre 1 y 3 (7.1.2-10); sin información, D = emp R111.
  Sin corrección, rectangular: u = D/√3 (7.1.2-11); relativa Drel/√3 (7.1.2-12).
- **Convección δmconv:** límite Δmconv del Anexo F según ΔT y masa;
  u = Δmconv/√3 (7.1.2-13). Solo relevante en F1 o mejores.
- **u²(mref) = u²(δmc) + u²(δmB) + u²(δmD) + u²(δmconv)** (7.1.2-14).
- **Con sustitución (7.1.2.6):**
  u²(LTn) = n²·u²(mref) + 2·[u²(I1) + … + u²(In−1)] (7.1.2-15a);
  u²(LTn,k) = [(n − 1)·u(mref) + u(mref,k)]² + 2·[u²(I1) + … + u²(In−1)]
  (7.1.2-15b), con u(Ij) de 7.1.1-12 en I = ILTj, **incluso si ΔIj = 0**. Si u(I)
  es constante: n²·u²(mref) + 2(n − 1)·u²(I) (7.1.2-16a) y
  [(n − 1)·u(mref) + u(mref,k)]² + 2(n − 1)·u²(I) (7.1.2-16b). Pueden hacer falta
  más términos (excentricidad, empuje de cargas de baja densidad).

### 7.1.3 Error, expandida y característica

- u²(E) = u²(δIdig0) + u²(δIdigL) + u²(δIrep) + u²(δIecc) + u²(δmc) + u²(δmB) +
  u²(δmD) + u²(δmconv) (7.1.3-1a); en relativo, con I y mref ≈ IN (7.1.3-1b);
  con sustitución, u²(LTn,k) en lugar de los términos de la pesa (7.1.3-1c).
- Agrupado: **u²(E) = α² + β²·I²** (7.1.3-2) (términos absolutos y
  proporcionales).
- **7.2:** si se da una función E = f(I), la incertidumbre debe ser coherente con
  la aproximación (varianza adicional o matriz de covarianzas) y comprobarse la
  consistencia del modelo (mínimo χ², Anexo C).
- **7.3:** **U(E) = k·u(E)** con k para una **probabilidad de cobertura de
  95,45 %** (Anexo B): k = 2 si la distribución es normal (≥ 3 contribuciones
  comparables de distribuciones «bien comportadas») y u(E) es fiable (ninguna
  contribución tipo A con menos de 10 observaciones; p. ej. repetibilidad con
  ≥ 10 repeticiones). Si no, νeff por Welch-Satterthwaite y k de la t al 95,45 %.
  Con una componente no normal dominante (uR ≤ 0,3·u1): k = 1,65 rectangular,
  1,90 triangular, 1,41 en U, trapezoidal por (B4-1). **Con la repetibilidad
  mínima de 5 lecturas (ν = 4) dominando, k puede salir mayor que 2: el sistema
  debe calcular νeff, no fijar k = 2.**

## 8 Certificado de calibración

Coherente con ISO/IEC 17025, que tiene preferencia (para Métrica, la NB/ISO/IEC
17025:2018, punto 7.8 en la skill `nb-iso-17025`). La norma agrega a lo de
abajo, entre otros: declaración de trazabilidad, resultados antes y después del
ajuste si se tienen, identificación de los datos que dio el cliente, regla de
decisión acordada para la conformidad, **ninguna recomendación de intervalo o
«próxima calibración» sin acuerdo con el cliente** y reglas para enmendar o
reemitir un certificado emitido.

- **8.1 General:** laboratorio; acreditación (organismo y número);
  identificación del certificado (número, fecha de emisión, páginas); firmas
  autorizadas; cliente; instrumento (fabricante, tipo, Max, d, lugar de
  instalación); aviso de que solo se reproduce completo salvo autorización
  escrita.
- **8.2 Procedimiento:** fecha de las mediciones; lugar; condiciones ambientales
  o de uso que influyan; información del instrumento (ajuste realizado, **interno
  o externo y con qué pesa**, anomalías, configuración de software relevante);
  referencia o descripción del procedimiento si no es obvio (p. ej. tiempos
  entre cargas); acuerdos con el cliente (rango reducido, especificaciones para
  conformidad); trazabilidad.
- **8.3 Resultados:** indicaciones y/o errores por carga (discretos o por
  ecuación de aproximación); detalles de carga si hace falta para entenderlos;
  desviaciones típicas **identificadas como de una sola indicación**;
  **información del ensayo de excentricidad**; U del error; **k con su
  probabilidad de cobertura y la razón si k ≠ 2**. Si no se usaron lecturas
  normales (lecturas únicas con la resolución normal), advertir que la
  incertidumbre declarada es menor que con lecturas normales.
- **8.4 Información adicional:** la incertidumbre esperada **en uso** (y sus
  condiciones) va en un anexo **que no forma parte del certificado**: W = R −
  E(R) ± U(W) con la ecuación de E(R) (8.4-1), o W = R ± Ugl(W) (8.4-2), diciendo
  que la U cubre al menos el 95 %. Opcional: conformidad W = R ± Tol (8.4-3), con
  los resultados en el certificado o conservados por el laboratorio, y
  comentario de que resultado + U están dentro de los límites; pesada mínima
  (Anexo G); consejos para clientes (definición del error, cómo corregir
  lecturas, cómo leer valores con más dígitos que d); U(W*) por error o para
  E(R).
- **7.4 (regla):** las estimaciones basadas en información no medida por el
  laboratorio **no se presentan como parte del certificado**; pueden darse si
  quedan claramente separadas.

## 9 Masa o masa convencional del objeto pesado

W estima la masa convencional del objeto. Con ρ (o V = W/ρ) y su
incertidumbre conocidos:

- Masa: m = W·[1 + ρa·(1/ρ − 1/ρc)] (9.1-1);
  u²rel(m) = u²(W)/W² + u²(ρa)·(1/ρ − 1/ρc)² + ρa²·u²(ρ)/ρ⁴ (9.1-2).
- Masa convencional más exacta: mc = W·[1 + (ρa − ρ0)·(1/ρ − 1/ρc)] (9.2-1);
  u²rel(mc) = u²(W)/W² + u²(ρa)·(1/ρ − 1/ρc)² + (ρa − ρ0)²·u²(ρ)/ρ⁴ (9.2-2).

## Altitud: lo que significa en Bolivia

- El aire del altiplano (La Paz ≈ 0,77–0,79 kg/m³; Cochabamba ≈ 0,88; Santa Cruz
  ≈ 1,14) se aparta mucho de ρ0 = 1,2 kg/m³. Tabla de ciudades y efectos por
  material en la skill `oiml-r111`.
- Consecuencia práctica: medir temperatura, presión y humedad en cada
  calibración (5.4), calcular ρa (Anexo A o CIPM-2007), aplicar
  **δmB = −mN·(ρa − ρ0)·(1/ρ − 1/ρc)** con la densidad real de cada pesa y su
  incertidumbre por (7.1.2-5a) o mejor (7.1.2-5b), y **no** usar las cotas
  simplificadas (7.1.2-5c/5d/5e), pensadas para aire dentro de ±10 % de ρ0.
- Si el instrumento se calibra en una ciudad y se usa en otra de distinta altura
  (gravedad y aire), la calibración puede no valer (4.1.2).
- Por la R111 10.2.2, pesas E (y F1 sobre 800 m) necesitan su densidad con
  incertidumbre en el certificado.

## Cómo usar esta skill en DataMET+

1. **Registro (NB/ISO/IEC 17025 7.5):** guardar las indicaciones originales
   (IL, I0, I0i), la carga y las pesas usadas en cada punto, el método de carga y
   de excentricidad, las condiciones ambientales, el estado de cero/ajuste, d o
   dT, y quién y cuándo. Los errores y la incertidumbre se calculan, no se
   digitan.
2. **Cálculo:** implementar las ecuaciones con su número en un comentario, sin
   redondear valores intermedios; redondear solo al presentar (GUM 7.2.6).
   Guardar cada componente del presupuesto, su distribución y sus grados de
   libertad para poder reproducir el resultado.
3. **Validación (7.11.2 y 7.11.6):** los ejemplos del Anexo H (y del Apéndice G
   de la Guía SIM) son casos de prueba automáticos obligatorios para el motor de
   cálculo. Ver [uso-y-anexos.md](uso-y-anexos.md).
4. **Donde la guía da opciones** (forma de carga, método de excentricidad,
   lecturas normales o con resolución aumentada, ajuste antes de calibrar,
   cálculo de k, presentación discreta o por función, incertidumbre global), no
   elijas tú: pregunta al usuario qué fija el procedimiento de Métrica y anótalo
   en «Decisiones del laboratorio».

## Decisiones del laboratorio

Tomadas por el usuario el 2026-11-05 (detalle y pendientes en
`docs/calibracion-analisis-excel.md`, sección 9):

1. **Esta guía (v4.0) rige el cálculo**; la Guía SIM se sigue citando y, donde
   difieren, manda EURAMET. Empuje: δmB = −mN·(ρa − ρ0)·(1/ρ − 1/ρc) haya o no
   ajuste previo, con 7.1.2-5a/5b y la densidad real de cada pesa.
2. **k = t de Student al 95,45 % con νeff**, calculado e impreso por punto.
3. **U con dos cifras significativas redondeadas hacia arriba**; el error al
   mismo decimal.
4. **El técnico solo elige el juego de pesas; DataMET+ arma cada carga** con
   las piezas del juego (regla fija y documentada: la de menos piezas) y quien
   elabora el certificado la puede corregir antes de emitir. Los certificados de
   pesas (por pieza) y de termohigrómetros (por magnitud) se transcriben al
   gestor de equipos y los verifica otra persona.
5. **u(t), u(HR), u(p)**: U del certificado del termohigrobarómetro + variación
   inicio-fin.
6. **Clase del instrumento: dato registrado**, no deducido. Sin clase marcada,
   para el emp NB 23001 vale la clase que pide el cliente (dato del cliente).
7. **Regla conservadora con U(E)** de calibración: |E| + U(E) ≤ T.
8. **Sustitución: 7.1.2-15a/b.** ServiceMET no registra las ΔIj: la
   sustitución llega como una carga declarada que no se arma con las piezas, y
   DataMET+ toma ΣΔI = carga − n·paso, con su u(Ij) en cada paso (incluso si
   ΔIj = 0). El **«Método 1» del laboratorio** (explicado por el personal el
   2026-11-13) es la cadena de 4.3.3-5a: el técnico valida una carga con pesas
   (p. ej. 500 kg, E = +0,5), la reemplaza por material hasta la misma
   indicación, vuelve a poner las pesas y así sigue; LTn = n·mref + ΣΔI. Con
   Método 1 el paso es siempre la mayor carga del ensayo armada solo con
   pesas, aunque la carga no supere el total de las pesas, y nunca se usa
   15b. Sin método: con resto armado con piezas, (n − 1)·mref + mref,k con
   mref = todas las pesas (15b; sin resto, 15a); si no, la cadena con el paso
   (todas las pesas o la mayor carga de pesas) que deja la ΣΔI más chica. En
   ambos casos, hasta un 25 % del paso por paso. El **«Método 2»** (también
   explicado el 2026-11-13) no está en EURAMET, la Guía SIM ni la R76, que solo
   describen la cadena: con las pesas se halla E = Iref − mref (500 lee 499,5:
   E = −0,5); cada carga sustitutiva se pesa sola y su masa es su indicación
   menos ese mismo E (495 → 495,5); luego se suben una por una junto con las
   pesas: LT = mref + Σ (Is,j − E) = (k + 1)·mref + Σ Is,j − k·Iref.
   DataMET+ reparte el material (carga − mref) en las menos cargas de hasta
   mref, iguales entre sí (ServiceMET no guarda cada una), y aplica la GUM a
   ese modelo: u²(LT) = (k + 1)²·u²(mref) + Σ u²(Is,j) + k²·u²(Iref)
   (`cargaMetodo2`). Las pesas y la lectura Iref entran en cada carga
   sustitutiva, por eso se suman linealmente; la lectura propia de cada una,
   en cuadratura. Con u(I) parecida en todo el rango da más U que la cadena
   (k² frente a 2(n − 1)). La planilla sumaba todo linealmente. El
   procedimiento P-VMET-02-7.2 debe describir el Método 2 por ser una
   modificación del método normalizado (NB/ISO/IEC 17025 7.2.2).
9. Editable por el laboratorio: **parámetros, tablas y textos** con versión y
   aprobación; las fórmulas en código, con pruebas.
10. Se **autoriza en DataMET+**; la firma digital del PDF se hace fuera y el PDF
    firmado se archiva en DataMET+. **La fecha de emisión es la de la firma
    digital.**
11. **Excentricidad: método 3** de 5.3, ΔIecc,i = (ILi − I0i) − IL1 (ServiceMET
    guarda la indicación y el retorno de cada posición).
