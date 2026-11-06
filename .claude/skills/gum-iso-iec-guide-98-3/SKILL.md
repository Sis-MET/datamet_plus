---
name: gum-iso-iec-guide-98-3
description: ISO/IEC Guide 98-3:2008 (= JCGM 100:2008, la GUM), Guía para la expresión de la incertidumbre de medida — modelo de medición, evaluación tipo A y tipo B, ley de propagación, correlación, incertidumbre expandida, grados efectivos de libertad (Welch-Satterthwaite), tabla t y reglas para informar y redondear; una de las cinco normas que Métrica Ltda. (laboratorio acreditado por DTA-IBMETRO) debe cumplir en Calibración. Úsala siempre que DataMET+ calcule, guarde, muestre o redondee una incertidumbre, un factor de cobertura o un resultado de medición, o al revisar un presupuesto de incertidumbre o la forma de declararla en un certificado.
---

# ISO/IEC Guide 98-3:2008 (GUM) — Expresión de la incertidumbre de medida

> Resumen con palabras propias para guiar el desarrollo; no es el texto oficial.
> Ante una duda o en una auditoría manda el documento original.

## Identidad del documento

- **ISO/IEC Guide 98-3:2008**, *Uncertainty of measurement — Part 3: Guide to
  the expression of uncertainty in measurement (GUM:1995)*. Contenido idéntico al
  **JCGM 100:2008** (*GUM 1995 with minor corrections*), del Comité Conjunto de
  Guías en Metrología (BIPM, IEC, IFCC, ILAC, ISO, IUPAC, IUPAP, OIML).
- Fuente oficial gratuita (inglés/francés):
  https://www.bipm.org/documents/20126/2071204/JCGM_100_2008_E.pdf
  El CEM publica la traducción al español (EURAMET cg-18 la cita).
- Documentos de la misma familia: JCGM 101:2008 (Monte Carlo; EURAMET lo cita
  cuando los términos de primer orden se cancelan) y JCGM 200 (VIM).

## Cómo encajan las cinco normas

| Norma | Qué aporta |
|---|---|
| **ISO/IEC Guide 98-3:2008 (GUM)** — esta skill | Marco de incertidumbre que usan todas las demás. |
| EURAMET cg-18 v4.0 — skill `euramet-cg-18` | Aplica la GUM a la calibración de balanzas (presupuesto concreto). |
| Guía SIM MWG7/cg-01 (2009) — skill `guia-sim-ipfna` | Versión anterior del mismo método. |
| OIML R76-1:2006 — skill `oiml-r76` | Límites y vocabulario del instrumento. |
| OIML R111-1:2004 — skill `oiml-r111` | Pesas; su Anexo C aplica la GUM a la calibración de pesas. |

## Modelo de medición (4.1)

Y = f(X1, …, XN) (1); la estimación es **y = f(x1, …, xN)** (2), con cada xi la
mejor estimación de Xi. El modelo incluye las correcciones (de valor esperado
cero si no se aplican) para que su incertidumbre entre al presupuesto: así lo
hace EURAMET con δIdig, δIrep, δmB, etc.

## Evaluación tipo A (4.2)

- Media: q̄ = (1/n)·Σqk (3).
- Varianza experimental: s²(qk) = Σ(qk − q̄)²/(n − 1) (4); s(qk) describe la
  dispersión de **una** observación.
- Varianza de la media: **s²(q̄) = s²(qk)/n** (5). Si xi es la media de n
  lecturas, u(xi) = s(q̄); si en uso se hará **una sola lectura**, la que
  corresponde es s(qk) (por eso EURAMET usa s y no s/√n para una indicación
  única).
- Grados de libertad: **ν = n − 1**.
- Con una medición bajo control estadístico se puede usar una varianza combinada
  (pooled) de series anteriores (4.2.4), con sus grados de libertad.

## Evaluación tipo B (4.3)

| Información disponible | u(xi) | Cláusula |
|---|---|---|
| Certificado con U y k declarados | U/k | 4.3.3 |
| Certificado con nivel de confianza sin k (se supone normal) | U/1,64 (90 %), U/1,96 (95 %), U/2,58 (99 %) | 4.3.4 |
| Solo límites ±a, sin más información (rectangular) | a/√3 (o (a+ − a−)/√12) | 4.3.7, ec. (6), (7) |
| Límites ±a, valores centrales más probables (trapezoidal, cima 2aβ) | a·√[(1 + β²)/6] | 4.3.9, ec. (9a) |
| Triangular (β = 0) | a/√6 | 4.3.9, ec. (9b) |
| Límites ±a que cubren 99,73 % de una normal | a/3 | 4.3.9, nota 1 |
| Resolución de una indicación digital δx (rectangular de ancho δx) | δx/√12 ≈ 0,29·δx | F.2.2.1 |

Si una componente evaluada con información pobre domina, conviene conseguir más
datos (nota de 4.3.7).

## Incertidumbre combinada (5)

- Sin correlación: **u²c(y) = Σ ci²·u²(xi)** (10), con coeficientes de
  sensibilidad **ci = ∂f/∂xi** evaluados en las xi; contribución ui(y) = |ci|·u(xi).
  Pueden obtenerse experimentalmente (5.1.4). Si f es muy no lineal, agregar
  términos de orden superior (5.1.2, nota).
- Modelo producto de potencias Y = c·X1^p1·…·XN^pN: en relativo,
  [uc(y)/y]² = Σ[pi·u(xi)/xi]² (5.1.6).
- Con correlación: **u²c(y) = Σ ci²·u²(xi) + 2·ΣΣ(i<j) ci·cj·u(xi, xj)** (13);
  coeficiente r(xi, xj) = u(xi, xj)/[u(xi)·u(xj)] (14). Con r = +1 y ci = 1 las
  incertidumbres **se suman linealmente**: por eso EURAMET y la R111 suman
  linealmente las incertidumbres de varias pesas calibradas contra el mismo
  patrón.

## Incertidumbre expandida (6)

**U = k·uc(y)** (18); el resultado se expresa **Y = y ± U**. k suele estar entre
2 y 3 (6.3.3). En calibración de masa (EURAMET y R111) la probabilidad objetivo
es **95,45 %**, que para una normal con muchos grados de libertad da k = 2.

## Grados efectivos de libertad y k (Anexo G)

- **Welch-Satterthwaite: νeff = u⁴c(y) / Σ[u⁴i(y)/νi]** (G.2b), con
  ui(y) = |ci|·u(xi) y νeff ≤ Σνi (G.2c).
- Tipo A: νi según el número de observaciones (n − 1 para una media).
- Tipo B: **νi ≈ ½·[Δu(xi)/u(xi)]⁻²** (G.3): confianza de 25 % en u → ν = 8;
  de 50 % → ν = 2. Con límites rectangulares considerados exactos, ν = ∞.
- νeff no entero: interpolar o truncar al entero inferior (G.6.4).
- k = tp(νeff) de la Tabla G.2. Si νeff es grande (más de 10, con contribuciones
  comparables y bien comportadas), k = 2 da ≈ 95 % (G.6.6).
- Si domina una componente rectangular con límites exactos, la t puede no servir
  (G.6.5); EURAMET Anexo B da k para componentes dominantes no normales.

**Tabla G.2 — tp(ν)**

| ν | 68,27 % | 90 % | 95 % | 95,45 % | 99 % | 99,73 % |
|---|---|---|---|---|---|---|
| 1 | 1,84 | 6,31 | 12,71 | 13,97 | 63,66 | 235,80 |
| 2 | 1,32 | 2,92 | 4,30 | 4,53 | 9,92 | 19,21 |
| 3 | 1,20 | 2,35 | 3,18 | 3,31 | 5,84 | 9,22 |
| 4 | 1,14 | 2,13 | 2,78 | 2,87 | 4,60 | 6,62 |
| 5 | 1,11 | 2,02 | 2,57 | 2,65 | 4,03 | 5,51 |
| 6 | 1,09 | 1,94 | 2,45 | 2,52 | 3,71 | 4,90 |
| 7 | 1,08 | 1,89 | 2,36 | 2,43 | 3,50 | 4,53 |
| 8 | 1,07 | 1,86 | 2,31 | 2,37 | 3,36 | 4,28 |
| 9 | 1,06 | 1,83 | 2,26 | 2,32 | 3,25 | 4,09 |
| 10 | 1,05 | 1,81 | 2,23 | 2,28 | 3,17 | 3,96 |
| 11 | 1,05 | 1,80 | 2,20 | 2,25 | 3,11 | 3,85 |
| 12 | 1,04 | 1,78 | 2,18 | 2,23 | 3,05 | 3,76 |
| 13 | 1,04 | 1,77 | 2,16 | 2,21 | 3,01 | 3,69 |
| 14 | 1,04 | 1,76 | 2,14 | 2,20 | 2,98 | 3,64 |
| 15 | 1,03 | 1,75 | 2,13 | 2,18 | 2,95 | 3,59 |
| 16 | 1,03 | 1,75 | 2,12 | 2,17 | 2,92 | 3,54 |
| 17 | 1,03 | 1,74 | 2,11 | 2,16 | 2,90 | 3,51 |
| 18 | 1,03 | 1,73 | 2,10 | 2,15 | 2,88 | 3,48 |
| 19 | 1,03 | 1,73 | 2,09 | 2,14 | 2,86 | 3,45 |
| 20 | 1,03 | 1,72 | 2,09 | 2,13 | 2,85 | 3,42 |
| 25 | 1,02 | 1,71 | 2,06 | 2,11 | 2,79 | 3,33 |
| 30 | 1,02 | 1,70 | 2,04 | 2,09 | 2,75 | 3,27 |
| 35 | 1,01 | 1,70 | 2,03 | 2,07 | 2,72 | 3,23 |
| 40 | 1,01 | 1,68 | 2,02 | 2,06 | 2,70 | 3,20 |
| 45 | 1,01 | 1,68 | 2,01 | 2,06 | 2,69 | 3,18 |
| 50 | 1,01 | 1,68 | 2,01 | 2,05 | 2,68 | 3,16 |
| 100 | 1,005 | 1,660 | 1,984 | 2,025 | 2,626 | 3,077 |
| ∞ | 1,000 | 1,645 | 1,960 | 2,000 | 2,576 | 3,000 |

En código conviene calcular tp(ν) con la inversa de la t de Student (dos colas,
p = 0,9545) en lugar de interpolar la tabla, y probarlo contra esta tabla.

## Cómo informar (7)

**Con incertidumbre expandida (7.2.3)**, el informe debe:

1. describir el mensurando;
2. dar **y ± U** con unidades;
3. incluir U relativa (U/|y|) si conviene;
4. dar **k** (o k y uc);
5. dar el **nivel de confianza aproximado** y cómo se obtuvo;
6. dar la información de 7.2.7 o citar el documento que la contiene.

Ejemplo (7.2.4): un patrón de 100 g se informa como (100,021 47 ± 0,000 79) g,
aclarando que lo que sigue a ± es U = k·uc, con uc = 0,35 mg y k = 2,26 (t de
Student con ν = 9), y que el intervalo tiene un nivel de confianza estimado de
95 %.

Con incertidumbre típica (7.2.1–7.2.2) se usan formas como m = 100,021 47(35) g;
**evitar ± con uc**, porque se confunde con U.

**Cifras y redondeo (7.2.6):** U y uc (y las u(xi)) con **a lo sumo dos cifras
significativas**; a veces conviene redondear hacia arriba (10,47 → 11), con
sentido común (28,05 → 28). **El resultado se redondea a la misma posición
decimal que su incertidumbre** (y = 10,057 62 con uc = 0,027 → 10,058).
Coeficientes de correlación cercanos a 1, con tres cifras. Redondear solo al
final: los cálculos intermedios conservan cifras.

**Registro detallado (7.2.7):** cada xi con su u(xi) y cómo se obtuvo;
covarianzas o correlaciones y su origen; grados de libertad de cada u(xi); la
función del modelo y los coeficientes de sensibilidad (o, si el modelo es un
programa, una referencia clara a él). Esto encaja con los registros técnicos de
la NB/ISO/IEC 17025 7.5 (skill `nb-iso-17025`).

## Procedimiento resumido (8)

1. Escribir el modelo Y = f(X1, …, XN), con las correcciones.
2. Obtener las xi.
3. Evaluar u(xi) por tipo A o tipo B.
4. Evaluar las covarianzas de las entradas correlacionadas.
5. Calcular y = f(x1, …, xN).
6. Combinar en uc(y) (ecuaciones 10 o 13).
7. Si hace falta un intervalo, U = k·uc, eligiendo k por el nivel de confianza
   (Anexo G).
8. Informar y, uc o U, k y cómo se obtuvieron (cláusula 7).

## Cómo usar esta skill en DataMET+

1. Guardar el presupuesto completo de cada resultado: magnitud, estimación,
   tipo (A/B), distribución, u, coeficiente de sensibilidad, contribución,
   grados de libertad y origen (certificado, ensayo, especificación). Permite
   rehacer el cálculo y responder a un auditor.
2. No redondear valores intermedios; redondear solo al mostrar o imprimir, con la
   regla de 7.2.6. Una sola función de redondeo para todo el sistema, con
   pruebas. Decisión del laboratorio (2026-11-05): **U con dos cifras
   significativas redondeadas hacia arriba** y el resultado al mismo decimal.
3. Calcular νeff y k en vez de fijar k = 2. Decisión del laboratorio
   (2026-11-05): **k = t de Student al 95,45 % con νeff**, impreso por punto.
4. En el certificado, declarar siempre U, k y la probabilidad de cobertura; si
   k ≠ 2, la razón (EURAMET 8.3).
5. Relacionado y no cubierto aquí: la política de ILAC sobre incertidumbre en
   calibración (ILAC P14) y los criterios de la DTA-IBMETRO. Si el usuario los
   aporta, agrégalos a esta skill.
