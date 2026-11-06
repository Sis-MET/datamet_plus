---
name: oiml-r111
description: OIML R 111-1:2004 (con su Enmienda 2025), Pesas de clases E1, E2, F1, F2, M1, M1-2, M2, M2-3 y M3 — requisitos metrológicos y técnicos, calibración de pesas y densidad del aire; una de las cinco normas que Métrica Ltda. (laboratorio acreditado por DTA-IBMETRO) debe cumplir en Calibración. Úsala al registrar o validar pesas patrón (clase, valor nominal, emp, densidad, certificado), al calcular la masa de referencia o el empuje del aire en la calibración de balanzas, al calibrar pesas (ciclos ABBA/ABA/AB1…BnA e incertidumbre), al calcular la densidad del aire (CIPM-2007) o al emitir certificados de pesas.
---

# OIML R 111-1:2004 (+ Enmienda 2025) — Pesas patrón

> Resumen con palabras propias para guiar el desarrollo; no es el texto oficial.
> Ante una duda o en una auditoría manda la Recomendación de la OIML.

## Identidad del documento

- **OIML R 111-1, Edición 2004 (E)**: *Weights of classes E1, E2, F1, F2, M1,
  M1–2, M2, M2–3 and M3. Part 1: Metrological and technical requirements*. La
  Parte 2 (R 111-2) es el formato del informe de ensayo.
- **Enmienda 2025** (vigente junto con la edición 2004): corrige textos y
  ecuaciones del Anexo B, la Tabla B.2, la nota de C.4, la referencia de C.6.1.3
  y adopta la fórmula del aire **CIPM-2007** (ver «Densidad del aire»).
- Fuentes oficiales (gratuitas):
  - https://www.oiml.org/en/files/pdf_r/r111-1-e04.pdf
  - https://www.oiml.org/en/files/pdf_r/r111-1-e04_amend25.pdf
- En el PDF de la OIML varias ecuaciones son imágenes. Las marcadas con
  **(transcrita)** se escribieron con la notación estándar de la norma y deben
  contrastarse con el PDF y con un caso resuelto antes de implementarlas.

## Cómo encajan las cinco normas

| Norma | Qué aporta |
|---|---|
| ISO/IEC Guide 98-3:2008 (GUM) — skill `gum-iso-iec-guide-98-3` | Marco de incertidumbre. |
| EURAMET cg-18 v4.0 — skill `euramet-cg-18` | Método de calibración de balanzas; usa la R111 para las pesas. |
| Guía SIM MWG7/cg-01 (2009) — skill `guia-sim-ipfna` | Versión anterior del mismo método. |
| OIML R76-1:2006 — skill `oiml-r76` | Instrumento: clases, emp, ensayos. Pide pesas R111 con error ≤ 1/3 del emp. |
| **OIML R111-1:2004** — esta skill | Pesas patrón y densidad del aire. |

## Alcance, clases y uso previsto (1.2–1.3)

De **1 mg a 5 000 kg**. Uso previsto de cada clase (1.3.1):

| Clase | Para |
|---|---|
| E1 | Trazabilidad entre patrones nacionales y E2 (siempre con certificado). |
| E2 | Calibrar F1; instrumentos clase I (siempre con certificado). |
| F1 | Calibrar F2; instrumentos clases I y II. |
| F2 | Calibrar M1 (y quizá M2); instrumentos clase II en transacciones importantes. |
| M1 | Calibrar M2; instrumentos clase III. |
| M2 | Calibrar M3; comercio general; instrumentos clase III. |
| M3 | Instrumentos clases III y IIII. |
| M1–2, M2–3 | Pesas de 50 kg a 5 000 kg de menor exactitud para clase III. |

Además rige la R76 3.7.1: el error de la pesa ≤ 1/3 del emp de la balanza para
esa carga. Valores nominales: 1, 2 o 5 × 10ⁿ kg; secuencias de juegos (1;1;2;5),
(1;1;1;2;5), (1;2;2;5), (1;1;2;2;5) × 10ⁿ (4.2–4.3).

## Errores máximos permitidos — Tabla 1 (± δm en mg)

Relativos a la **masa convencional**. No se extrapolan fuera de la tabla: una
pesa de 50 mg no puede ser M2 (sería M1).

| Nominal | E1 | E2 | F1 | F2 | M1 | M1–2 | M2 | M2–3 | M3 |
|---|---|---|---|---|---|---|---|---|---|
| 5 000 kg | | | 25 000 | 80 000 | 250 000 | 500 000 | 800 000 | 1 600 000 | 2 500 000 |
| 2 000 kg | | | 10 000 | 30 000 | 100 000 | 200 000 | 300 000 | 600 000 | 1 000 000 |
| 1 000 kg | | 1 600 | 5 000 | 16 000 | 50 000 | 100 000 | 160 000 | 300 000 | 500 000 |
| 500 kg | | 800 | 2 500 | 8 000 | 25 000 | 50 000 | 80 000 | 160 000 | 250 000 |
| 200 kg | | 300 | 1 000 | 3 000 | 10 000 | 20 000 | 30 000 | 60 000 | 100 000 |
| 100 kg | | 160 | 500 | 1 600 | 5 000 | 10 000 | 16 000 | 30 000 | 50 000 |
| 50 kg | 25 | 80 | 250 | 800 | 2 500 | 5 000 | 8 000 | 16 000 | 25 000 |
| 20 kg | 10 | 30 | 100 | 300 | 1 000 | | 3 000 | | 10 000 |
| 10 kg | 5,0 | 16 | 50 | 160 | 500 | | 1 600 | | 5 000 |
| 5 kg | 2,5 | 8,0 | 25 | 80 | 250 | | 800 | | 2 500 |
| 2 kg | 1,0 | 3,0 | 10 | 30 | 100 | | 300 | | 1 000 |
| 1 kg | 0,5 | 1,6 | 5,0 | 16 | 50 | | 160 | | 500 |
| 500 g | 0,25 | 0,8 | 2,5 | 8,0 | 25 | | 80 | | 250 |
| 200 g | 0,10 | 0,3 | 1,0 | 3,0 | 10 | | 30 | | 100 |
| 100 g | 0,05 | 0,16 | 0,5 | 1,6 | 5,0 | | 16 | | 50 |
| 50 g | 0,03 | 0,10 | 0,3 | 1,0 | 3,0 | | 10 | | 30 |
| 20 g | 0,025 | 0,08 | 0,25 | 0,8 | 2,5 | | 8,0 | | 25 |
| 10 g | 0,020 | 0,06 | 0,20 | 0,6 | 2,0 | | 6,0 | | 20 |
| 5 g | 0,016 | 0,05 | 0,16 | 0,5 | 1,6 | | 5,0 | | 16 |
| 2 g | 0,012 | 0,04 | 0,12 | 0,4 | 1,2 | | 4,0 | | 12 |
| 1 g | 0,010 | 0,03 | 0,10 | 0,3 | 1,0 | | 3,0 | | 10 |
| 500 mg | 0,008 | 0,025 | 0,08 | 0,25 | 0,8 | | 2,5 | | |
| 200 mg | 0,006 | 0,020 | 0,06 | 0,20 | 0,6 | | 2,0 | | |
| 100 mg | 0,005 | 0,016 | 0,05 | 0,16 | 0,5 | | 1,6 | | |
| 50 mg | 0,004 | 0,012 | 0,04 | 0,12 | 0,4 | | | | |
| 20 mg | 0,003 | 0,010 | 0,03 | 0,10 | 0,3 | | | | |
| 10 mg | 0,003 | 0,008 | 0,025 | 0,08 | 0,25 | | | | |
| 5 mg | 0,003 | 0,006 | 0,020 | 0,06 | 0,20 | | | | |
| 2 mg | 0,003 | 0,006 | 0,020 | 0,06 | 0,20 | | | | |
| 1 mg | 0,003 | 0,006 | 0,020 | 0,06 | 0,20 | | | | |

## Incertidumbre y masa convencional (5.2–5.3, 2.7, 12.4)

- **U (k = 2) ≤ δm/3** para cada pesa (5.2-1).
- **m0 − (δm − U) ≤ mc ≤ m0 + (δm − U)** (5.3-1). En E1 y E2 el usuario debe
  usar la desviación real mc − m0 de su certificado (5.3.2).
- El emp de verificación posterior lo fija cada Estado; si es mayor que la
  Tabla 1, la pesa no puede llamarse de esa clase (5.1.2).
- **Condiciones de referencia (12.4):** densidad de referencia ρc = 8 000 kg/m³,
  aire ρ0 = 1,2 kg/m³, equilibrio en aire a 20 °C sin corregir empuje.
- **Masa convencional:** mc = m·(1 − ρ0/ρ)/(1 − ρ0/ρc), donde ρ es la densidad de
  la pesa (misma definición en EURAMET cg-18, 4.2.2-2).

## Densidad (10) — Tabla 5, ρmin–ρmax en 10³ kg/m³

Regla: la densidad debe ser tal que un desvío de ±10 % del aire respecto de
1,2 kg/m³ no produzca un error mayor que **δm/4**. De ahí (derivado):
|1/ρ − 1/ρc| ≤ (δm/m0) / (4 · 0,12 kg/m³).

| Nominal | E1 | E2 | F1 | F2 | M1 | M1–2 | M2 | M2–3 |
|---|---|---|---|---|---|---|---|---|
| ≥ 100 g | 7,934–8,067 | 7,81–8,21 | 7,39–8,73 | 6,4–10,7 | ≥ 4,4 | > 3,0 | ≥ 2,3 | ≥ 1,5 |
| 50 g | 7,92–8,08 | 7,74–8,28 | 7,27–8,89 | 6,0–12,0 | ≥ 4,0 | | | |
| 20 g | 7,84–8,17 | 7,50–8,57 | 6,6–10,1 | 4,8–24,0 | ≥ 2,6 | | | |
| 10 g | 7,74–8,28 | 7,27–8,89 | 6,0–12,0 | ≥ 4,0 | ≥ 2,0 | | | |
| 5 g | 7,62–8,42 | 6,9–9,6 | 5,3–16,0 | ≥ 3,0 | | | | |
| 2 g | 7,27–8,89 | 6,0–12,0 | ≥ 4,0 | ≥ 2,0 | | | | |
| 1 g | 6,9–9,6 | 5,3–16,0 | ≥ 3,0 | | | | | |
| 500 mg | 6,3–10,9 | ≥ 4,4 | ≥ 2,2 | | | | | |
| 200 mg | 5,3–16,0 | ≥ 3,0 | | | | | | |
| 100 mg | ≥ 4,4 | | | | | | | |
| 50 mg | ≥ 3,4 | | | | | | | |
| 20 mg | ≥ 2,3 | | | | | | | |

(Las tres últimas filas son de E1: lo confirma la regla de 10.1; por ejemplo,
E1 de 100 mg, δm/m0 = 5×10⁻⁵ → ρ ≥ 4 364 kg/m³.)

M3: sin límite. Densidades supuestas cuando solo se conoce el material (Tabla
B.7, incertidumbre con k = 2): platino 21 400 ± 150; alpaca 8 600 ± 170; latón
8 400 ± 170; acero inoxidable 7 950 ± 140; acero al carbono 7 700 ± 200; hierro
7 800 ± 200; fundición blanca 7 700 ± 400; fundición gris 7 100 ± 600; aluminio
2 700 ± 130 kg/m³. Si solo se sabe que cumple la Tabla 5, usar 8 000 kg/m³
(C.5.1.1). Metales de ajuste (B.7.9.4.2, corregido en 2025): tungsteno 18 800 ±
200; plomo 11 300 ± 150; molibdeno 10 000 ± 150; estaño 7 300 ± 100 kg/m³.

**10.2 Corrección por empuje cuando el aire se aparta más de ±10 % de
1,2 kg/m³** y la pesa en ensayo tiene distinta densidad que la de referencia:
término C = (ρa − ρ0)(1/ρt − 1/ρr) **(transcrita)**, aplicado como en C.5.

**10.2.2 Pesas usadas para calibrar o verificar balanzas en altura:** la altitud
cambia la densidad del aire y afecta el error al usar la masa convencional, así
que **debe aplicarse la corrección por empuje**, lo que exige conocer la densidad
de la pesa. **Pesas clase E usadas por encima de 330 m y F1 por encima de 800 m
deben venir con su densidad y su incertidumbre.** Si no, el fabricante debe tener
en cuenta el menor empuje en altura al asignar la clase.

## Magnetismo y superficie (9, 11)

Polarización máxima µ0M (µT), Tabla 3: E1 2,5 · E2 8 · F1 25 · F2 80 · M1 250 ·
M1–2 500 · M2 800 · M2–3 1 600 · M3 2 500.

Susceptibilidad máxima χ, Tabla 4:

| Masa | E1 | E2 | F1 | F2 |
|---|---|---|---|---|
| m ≤ 1 g | 0,25 | 0,9 | 10 | — |
| 2 g ≤ m ≤ 10 g | 0,06 | 0,18 | 0,7 | 4 |
| 20 g ≤ m | 0,02 | 0,07 | 0,2 | 0,8 |

Dentro de estos límites el efecto magnético es < 1/10 del emp y su incertidumbre
puede despreciarse (9.3, C.6.4.5).

Rugosidad máxima, Tabla 6 (µm): Rz 0,5 / 1 / 2 / 5 y Ra 0,1 / 0,2 / 0,4 / 1 para
E1 / E2 / F1 / F2; el doble para pesas > 50 kg. E y F: superficie no porosa y
brillante (11.1.2).

## Certificados de pesas (15.2)

Solo los emiten laboratorios autorizados o acreditados, con trazabilidad.
Contenido mínimo: **masa convencional mc de cada pesa, si la pesa se ajustó antes
de calibrarla, U y k** (15.2.1). E1: además la densidad o el volumen de cada pesa
y si se midió o se estimó (15.2.2.1). E2: mc, U y k, o lo de E1 si se usará como
E1 (15.2.2.2). Las pesas E siempre llevan certificado. Con certificado de
calibración no hacen falta marcas de control (16.1). Si Métrica emite el
certificado, también debe cumplir la NB/ISO/IEC 17025 7.8 (skill
`nb-iso-17025`).

## Calibración de pesas (Anexos B y C)

**Preparación (B.4):** limpiar sin alterar la superficie. Estabilización tras
limpiar (Tabla B.1): alcohol E1 7–10 días, E2 3–6 días, F1 1–2 días, F2–M3 1 h;
agua destilada E1 4–6 días, E2 2–3, F1 1, F2–M3 1 h. **Estabilización térmica**
mínima según ΔT inicial, tamaño y clase (Tabla B.2, corregida por la Enmienda
2025: para 1 000 kg en E2 ahora 93 h con ΔT = 20 °C, 51 h con 5 °C, 16 h con
2 °C; F2 1 000–5 000 kg con 20 °C, 7 h). Guía práctica: esperar 24 h.

**Condiciones ambientales (C.2.1, Tabla C.1):** variación de temperatura por hora
(máximo en 12 h): E1 ±0,3 °C (±0,5); E2 ±0,7 (±1); F1 ±1,5 (±2); F2 ±2 (±3,5);
M1 ±3 (±5). Humedad relativa 40–60 %, con variación máxima en 4 h de ±5 % (E1),
±10 % (E2), ±15 % (F). E1 y E2: entre 18 °C y 27 °C. **Si el aire se aparta más
de 10 % de 1,2 kg/m³, calcular con masas (no masas convencionales) y derivar la
masa convencional al final (C.2.1.2).**

**Patrón de referencia (C.2.3):** de clase superior a la pesa a calibrar; debe
cumplir 5.2 y 5.3.

**Ciclos (C.4)** — A = referencia (r), B = pesa en ensayo (t); n secuencias:

- **ABBA:** ΔIi = (It1,i − Ir1,i − Ir2,i + It2,i)/2 (C.4.1-1). Clases E y F.
- **ABA:** ΔIi = It1,i − (Ir1,i + Ir2,i)/2 (C.4.1-2). Clases E y F.
- **AB1…BnA** (hasta 5 pesas del mismo nominal; invertir el orden en cada
  secuencia salvo deriva ≤ 1/3 de la incertidumbre requerida):
  ΔIi(j) = It(j),i − (Ir1,i + Ir2,i)/2 (C.4.2-1). Clases M; en E y F solo con
  comparador de intercambio automático en cámara cerrada.
- Intervalos de tiempo constantes. Sensibilidad: ABBA modificado Ir, It, It+ms,
  Ir+ms.

Mínimo de ciclos (Tabla C.3):

| Clase | E1 | E2 | F1 | F2 | M1, M2, M3 |
|---|---|---|---|---|---|
| ABBA | 3 | 2 | 1 | 1 | 1 |
| ABA | 5 | 3 | 2 | 1 | 1 |
| AB1…BnA | 5 | 3 | 2 | 1 | 1 |

**Análisis (C.5):**

- Δmc,i = ΔIi + mcr·Ci (C.5.1-2), con Ci = (ρa,i − ρ0)(1/ρt − 1/ρr)
  **(transcrita)**.
- Δm̄c = media de los n ciclos; mct = mcr + Δm̄c **(transcrita)**.
- Si la corrección de empuje es despreciable puede omitirse, pero su
  incertidumbre quizá no (C.5.1.2, C.6.3.1).
- En verificación, si no se conoce mcr se usa su valor nominal (C.5.4.1).

**Incertidumbre (C.6)** — todas **(transcrita)** salvo donde se indica:

- Proceso de pesada (tipo A): uw(Δm̄c) = s(Δmc,i)/√n.
  - F2, M1, M2, M3 sin historial: s ≈ (máx Δmc,i − mín Δmc,i)/(2√3) con n ≥ 3.
  - E1, E2, F1: varianza experimental con n − 1 grados de libertad; con pocas
    mediciones usar una s combinada (pooled) de mediciones anteriores
    (Anexo D.2, referencia corregida en 2025); si no, n ≥ 5. J series:
    s² = media de las s²j, con J(n − 1) grados de libertad.
- Pesa de referencia (tipo B): u(mcr) = √[(U/k)² + u²inst(mcr)], donde uinst es
  la inestabilidad (de calibraciones sucesivas o de la experiencia). Pesa F1 o
  inferior solo con certificado de conformidad: u(mcr) = δm/√3. Varias pesas de
  referencia sin covarianzas conocidas: **u(mcr) = Σ u(mcr,i)** (suma lineal,
  C.6.2-3, verificada).
- Empuje (tipo B): u²b = m²cr·[(ρr − ρt)/(ρr·ρt)]²·u²(ρa) + m²cr·(ρa − ρ0)²·u²(ρt)/ρt⁴
  + m²cr·(ρa − ρ0)·[(ρa − ρ0) − 2(ρal − ρ0)]·u²(ρr)/ρr⁴, con ρal = densidad del
  aire cuando se calibró la pesa de referencia; usar la misma u(ρr) que en esa
  calibración. Se incluye si ub ≥ uc/3. Despreciable en M1–M3. Si no se mide el
  aire y se usa la media del lugar: u(ρa) = 0,12/√3 kg/m³ (o menor con datos);
  a nivel del mar se supone 1,2 kg/m³. En clase E el aire se mide.
  Sensibilidades de ρa (C.6.3.6, verificadas): ∂ρa/∂p = 10⁻⁵ ρa/Pa,
  ∂ρa/∂t = −3,4×10⁻³ ρa/K, ∂ρa/∂hr = −10⁻² ρa (hr como fracción); u de la
  fórmula CIPM ≈ 10⁻⁴ ρa.
- Balanza (tipo B): sensibilidad us² = Δm̄c²·[u²(ms)/ms² + u²(ΔIs)/ΔIs²];
  resolución digital **ud = (d/2)/√3 · √2** (dos lecturas); excentricidad
  uE = (d1/d2)·D/(2√3), con D = diferencia máx − mín del ensayo de excentricidad,
  d1 = distancia entre centros de las pesas, d2 = del centro a una esquina
  (normalmente ya cubierta por uw); magnetismo uma = 0 si cumplen la R111.
  uba = √(us² + ud² + uE² + uma²).
- Combinada: uc(mct) = √(uw² + u²(mcr) + ub² + uba²). Si no se aplicó la
  corrección de empuje, agregar su contribución (C.6.5-2).
- **U = k·uc**, normalmente k = 2. Si no hay s combinada de historial y
  uw > uc/2, k sale de la t de Student al 95,45 % con νeff (Welch-Satterthwaite;
  con tipo B de grados infinitos, νeff = (n − 1)·uc⁴/uw⁴). Tabla C.4: νeff 1 →
  13,97; 2 → 4,53; 3 → 3,31; 4 → 2,87; 5 → 2,65; 6 → 2,52; 8 → 2,37; 10 → 2,28;
  20 → 2,13; ∞ → 2,00.

**Control estadístico (Anexo D):** patrón de verificación (check standard) y
precisión de la balanza para vigilar el proceso y obtener s combinadas.

## Densidad del aire (Anexo E y Enmienda 2025)

**Fórmula CIPM-2007** (la Enmienda 2025 la adopta; EURAMET también la cita).
Forma **(transcrita)**, constantes **verificadas** de las Tablas E.2–E.4 y de la
enmienda:

```text
ρa = (p·Ma / (Z·R·T)) · [1 − xv·(1 − Mv/Ma)]
T = t + 273,15 (K);  p en Pa;  hr como fracción
Ma = [28,965 46 + 12,011·(xCO2 − 0,0004)] × 10⁻³ kg/mol   (Ma/R = 3,483 51 × 10⁻³ kg·K/J con xCO2 = 0,0004)
R  = 8,314 462 618 J/(mol·K)   (exacto desde el SI de 2019)
Mv = 18,015 28 × 10⁻³ kg/mol
xv = hr · f · psv / p
psv = 1 Pa · exp(A·T² + B·T + C + D/T)
   A = 1,237 884 7 × 10⁻⁵ K⁻²   B = −1,912 131 6 × 10⁻² K⁻¹
   C = 33,937 110 47           D = −6,343 164 5 × 10³ K
f = α + β·p + γ·t²   α = 1,000 62   β = 3,14 × 10⁻⁸ Pa⁻¹   γ = 5,6 × 10⁻⁷ K⁻²
Z = 1 − (p/T)·[a0 + a1·t + a2·t² + (b0 + b1·t)·xv + (c0 + c1·t)·xv²] + (p²/T²)·(d + e·xv²)
   a0 = 1,581 23 × 10⁻⁶ K/Pa   a1 = −2,933 1 × 10⁻⁸ Pa⁻¹   a2 = 1,104 3 × 10⁻¹⁰ K⁻¹·Pa⁻¹
   b0 = 5,707 × 10⁻⁶ K/Pa      b1 = −2,051 × 10⁻⁸ Pa⁻¹
   c0 = 1,989 8 × 10⁻⁴ K/Pa    c1 = −2,376 × 10⁻⁶ Pa⁻¹
   d  = 1,83 × 10⁻¹¹ K²/Pa²    e  = −0,765 × 10⁻⁸ K²/Pa²
```

**Aproximación (E.3-1):** ρa = [0,348 48·p − 0,009·hr·exp(0,061·t)] / (273,15 + t),
con p en hPa, hr en %, t en °C. La R111 le da 2×10⁻⁴ de incertidumbre relativa
solo para **900 hPa < p < 1 100 hPa**, 10–30 °C, hr < 80 %. EURAMET cg-18 (A1.1-1)
la extiende a 600–1 100 hPa, 15–27 °C, 20–80 % con 2,4×10⁻⁴.

**Por altitud (E.3-2):** ρa = ρ0·exp(−ρ0·g·h/p0), con p0 = 101 325 Pa,
ρ0 = 1,2 kg/m³, g = 9,81 m/s², h en m. Solo cuando no se mide el aire; en E1
siempre se mide.

## Altitud: lo que significa en Bolivia

Ejemplos con la fórmula por altitud (20 °C, 50 % HR; ilustrativos, el aire real
varía con el clima):

| Lugar | Altitud | p aprox. | ρa aprox. |
|---|---|---|---|
| Santa Cruz | 416 m | 964 hPa | 1,14 kg/m³ |
| Cochabamba | 2 558 m | 745 hPa | 0,88 kg/m³ |
| Sucre | 2 810 m | 723 hPa | 0,86 kg/m³ |
| La Paz | 3 640 m | 655 hPa | 0,77–0,79 kg/m³ |
| El Alto / Potosí | ≈ 4 050 m | ≈ 623 hPa | ≈ 0,74 kg/m³ |

Consecuencias:

1. Salvo en el llano, el aire se aparta **más de 10 %** de 1,2 kg/m³ (en La Paz
   ≈ −35 %). Ya no valen las simplificaciones que suponen ±10 % (C.2.1.2, 10.2;
   EURAMET 7.1.2-5c/5d); hay que calcular el empuje con la densidad real de la
   pesa.
2. Efecto relativo δmB/m = −(ρa − ρ0)(1/ρ − 1/ρc) con ρa ≈ 0,79 kg/m³: latón
   (8 400) ≈ −2,4 mg/kg; inoxidable (7 950) ≈ +0,3 mg/kg; acero al carbono
   (7 700) ≈ +2,0 mg/kg; fundición gris (7 100) ≈ +6,5 mg/kg. Comparado con los
   emp relativos (≥ 100 g): E2 1,6; F1 5; F2 16; M1 50 mg/kg. Un juego E2 de
   latón en La Paz tiene un efecto de empuje mayor que su propio emp.
3. Por 10.2.2, las pesas E (y F1 sobre 800 m) que use Métrica fuera del llano
   necesitan **densidad con incertidumbre** en su certificado; el sistema debe
   guardar ρ y u(ρ) de cada pesa patrón, no solo su clase.
4. Para la fórmula del aire a 620–760 hPa usa CIPM-2007 (o la aproximación con
   el rango que le da EURAMET, no el de la R111). Por debajo de 600 hPa ninguna
   aproximación tiene rango declarado: usar CIPM-2007.

## Cómo usar esta skill en DataMET+

1. Cada pesa patrón guarda: identificación, juego, valor nominal, clase, mc (o
   corrección δmc), U, k, fecha y certificado, **densidad ρ y u(ρ)** (o material
   para usar la Tabla B.7, dejando claro que es supuesta), y el historial de mc
   para estimar la deriva.
2. Valida con la Tabla 1 y 5.2–5.3: U ≤ δm/3 y |mc − m0| ≤ δm − U. Avisa si una
   pesa no cumple su clase; no la reclasifiques sola.
3. Para elegir pesas para una balanza combina esta skill con la R76 (1/3 del emp
   del instrumento) y con EURAMET 4.3.1.
4. Si se calibran pesas, el certificado sigue 15.2 y los cálculos el Anexo C;
   contrasta cada fórmula marcada «(transcrita)» con el PDF antes de programarla.
