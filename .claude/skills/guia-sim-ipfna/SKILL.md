---
name: guia-sim-ipfna
description: Guía SIM MWG7/cg-01/v.00 (2009) para la calibración de instrumentos para pesar de funcionamiento no automático (balanzas, básculas), traducción SIM de EURAMET cg-18 v2.0, una de las cinco normas que Métrica Ltda. (laboratorio acreditado por DTA-IBMETRO) debe cumplir en Calibración. Úsala al diseñar, programar o revisar la calibración de balanzas, el cálculo de errores e incertidumbre, la redacción o emisión de certificados de calibración, o cuando un procedimiento, certificado o auditor cite la «Guía SIM». Explica qué dice, en qué coincide y en qué difiere de EURAMET cg-18 v4.0 (2015).
---

# Guía SIM MWG7/cg-01/v.00 (2009) — Calibración de IPFNA

> Resumen con palabras propias para guiar el desarrollo; no es el texto oficial.
> El SIM prohíbe reproducirla total o parcialmente sin autorización: no copies
> su texto en el código, en los certificados ni en documentos. Ante una duda o
> en una auditoría manda el documento original.

## Identidad del documento

- **Título:** Guía para la calibración de los instrumentos para pesar de
  funcionamiento no automático. **Código:** SIM MWG7/cg-01/v.00. **Año:** 2009.
- Es la **traducción al español de EURAMET/cg-18/v.02** hecha por el Grupo de
  Trabajo de Masa del SIM (SIM-MWG7). La versión **oficial es la inglesa**; la
  española es una referencia lo más fiel posible.
- Fuentes oficiales (gratuitas):
  - Español: https://sim-metrologia.org/wp-content/uploads/2026/01/SIM_MWG7_cg-01_v00_Spanish.pdf
  - Inglés: https://sim-metrologia.org/wp-content/uploads/2019/10/SIM-Guidelines-on-the-calibration-of-non-automatic-weighing-instruments-2009.pdf
  - Listado de guías SIM: https://sim-metrologia.org/sim-calibration-guidelines/
- A noviembre de 2026 el SIM no publica una versión más nueva de esta guía. Sí
  publicó en 2025 una **Guía SIM para la calibración de microbalanzas** (otro
  alcance; no confundir).
- No es obligatoria por sí misma: propone procedimientos que, si se siguen, dan
  resultados equivalentes entre los miembros del SIM. Para Métrica es
  obligatoria porque el laboratorio la declara en su alcance acreditado.

## Cómo encajan las cinco normas

| Norma | Qué aporta |
|---|---|
| ISO/IEC Guide 98-3:2008 (GUM) — skill `gum-iso-iec-guide-98-3` | Marco de incertidumbre: modelo, tipo A/B, combinación, k, cómo informar. |
| EURAMET cg-18 v4.0 (2015) — skill `euramet-cg-18` | Método vigente de calibración de balanzas: ensayos, fórmulas, certificado, densidad del aire, pesada mínima. |
| **Guía SIM MWG7/cg-01 (2009)** — esta skill | El mismo método en su versión anterior (EURAMET v2.0), en español. |
| OIML R76-1:2006 — skill `oiml-r76` | Vocabulario y características del instrumento: clases, e, d, n, Min, emp, ensayos de verificación. |
| OIML R111-1:2004 — skill `oiml-r111` | Pesas patrón: clases, emp, densidad, magnetismo, calibración de pesas, densidad del aire. |

La Guía SIM y EURAMET cg-18 v4.0 describen **el mismo método**; v4.0 es la
revisión más completa. Usa la skill `euramet-cg-18` para el detalle de cada
fórmula y esta para saber qué cambia cuando el procedimiento o el certificado
citan la Guía SIM.

## Estructura

1 Introducción · 2 Alcance · 3 Terminología · 4 Aspectos generales (elementos,
carga e indicación, cargas de prueba, indicaciones) · 5 Métodos de medición
(repetibilidad, errores de indicación, excentricidad, mediciones auxiliares) ·
6 Resultados · 7 Incertidumbre (valores discretos, curva característica,
expandida, resultado de una pesada) · 8 Certificado · 9 Masa y masa
convencional · 10 Referencias.
Apéndices: A densidad del aire · B factor de cobertura · C fórmulas de error vs
indicación · D símbolos · E empuje del aire · F convección · **G ejemplos**
(G1 200 g / d = 0,1 mg; G2 60 kg multi-intervalo; G3 30 t / d = 10 kg).

## Lo que coincide con EURAMET cg-18 v4.0

Todo esto se aplica igual con cualquiera de las dos guías (detalle y números de
ecuación en la skill `euramet-cg-18`):

- **Elementos de la calibración:** aplicar cargas, determinar el error
  `E = I − mref` y estimar su incertidumbre.
- **Alcance:** de cero a Max salvo que el cliente pida un tramo Min′–Max′ o
  cargas puntuales; en multi-rango el cliente elige los rangos.
- **Lugar:** in situ. Mover el instrumento después puede invalidar la calibración
  (gravedad, ambiente, transporte).
- **Condiciones previas:** identificable, sin daños, lectura sin ambigüedad,
  condiciones normales de uso, encendido el tiempo de calentamiento, nivelado,
  ejercitado con una carga cercana a Max. Si se ajusta antes del uso, se ajusta
  antes de calibrar (salvo acuerdo). Cero automático / seguimiento de cero según
  diga el cliente. Registrar el estado de la configuración del software que el
  cliente pueda alterar.
- **Repetibilidad:** al menos una carga, típicamente 0,5 Max ≤ LT ≤ Max (menor
  en instrumentos de varias toneladas; cerca de Max1 en multi-intervalo); cero
  antes; **≥ 5 repeticiones (≥ 3 si LT ≥ 100 kg)**; comprobar el cero tras cada
  retiro.
- **Errores de indicación:** **kL ≥ 5 cargas** repartidas en el alcance (por
  ejemplo 0 o Min; 0,25; 0,5; 0,75; 1 Max). Alcance reducido: ≥ 3 puntos
  incluyendo Min′ y Max′, pasos ≤ 0,15 Max. Cuatro formas de cargar (con
  descarga entre pasos, continuo creciente, creciente y decreciente, decreciente
  desde Max).
- **Excentricidad:** 5 posiciones (centro, delante izquierda, atrás izquierda,
  atrás derecha, delante derecha); carga ≈ Max/3 o mayor.
- **Incertidumbre:** mismas componentes de la indicación (redondeo en cero y
  con carga, repetibilidad, excentricidad) y de la masa de referencia
  (certificado de la pesa, empuje del aire, deriva, convección); pesas
  combinadas se suman linealmente; cargas de sustitución; `u²(E) = α² + β²I²`;
  curva característica por mínimo χ²; resultado de pesada W = R − E(R) ± U(W) e
  «incertidumbre global»; conformidad si `|E(R)| + U(W(R)) ≤ Tol(R)`.
- **Masa y masa convencional** del objeto pesado (sección 9).

## Diferencias con EURAMET cg-18 v4.0 que cambian el cálculo

| Tema | Guía SIM 2009 | EURAMET cg-18 v4.0 |
|---|---|---|
| Empuje del aire (4.2.4 y 7.1.2.2) | Tres casos: **A** ajustado inmediatamente antes (δmB = −m(ρa−ρ0)(1/ρ − 1/ρc)); **B1** ajustado aparte, in situ, con diferencia δρas entre la densidad del aire al ajustar y al calibrar (agrega δρas/ρc y su incertidumbre u²(δρas)/ρc²); **B2** suponiendo ρas = ρ0 (δmB = −m(ρa−ρ0)/ρ, ŵ² = u²(ρa)/ρ² + (ρa−ρ0)²u²(ρ)/ρ⁴). | Una sola corrección δmB = −mN(ρa−ρ0)(1/ρ − 1/ρc) para ambos casos; agrega la fórmula para altitud con ρa1 (7.1.2-5b) y la versión con ΔT (7.1.2-5e). |
| Empuje simplificado con pesas R111 sin datos de ρ ni ρa | Caso A: ŵ ≈ mpe/(4m√3). Casos B: ŵ ≈ (0,1ρ0/ρc + mpe/(4m))/√3 | Mismos valores (7.1.2-5c y -5d). |
| Ensayo de excentricidad | Un solo método: carga en 1 y luego en las otras 4 en cualquier orden (puede volver a 1); comprobar cero tras cada retiro. ΔIecc,i = Ii − I1; si la carga son pesas patrón, también Eecc,i = Ii − m. | Cuatro métodos (con o sin tara, con o sin retiro entre posiciones, volviendo al centro) con su fórmula de ΔIecc cada uno; métodos 3 y 4 para instrumentos con deriva. |
| Repetibilidad con varias cargas | Permite una s «ponderada» si s depende de la carga: s = constante o s² = s0² + sr²(LT/Max)² (7.1.1-7/8). | Usa la mayor s de los dos puntos que encierran la indicación; una s por intervalo en multi-intervalo/multi-rango. |
| Presentación del error | Siempre referido al valor nominal m: I(m) = I′(mc) − δmc (6.2-4). | No lo exige. |
| Pesas R111 por clase | Tabla 7.1-1 de cclass = mpe/m (≥ 100 g): E1 0,5; E2 1,6; F1 5; F2 16; M1 50; M2 160; M3 500 (×10⁻⁶); para 2×10ⁿ en E2, F2, M2: 1,5; 15; 150. Ejemplo (7.1.2-14a) de ŵ²(mref) en el caso A. | Usa Tol/√3 con el emp de la R111, sin tabla. |
| Deriva de las pesas | D = kD·U (kD de 1 a 3); para pesas R111, D ≤ mpe. | Igual; sin información, D = emp. |
| Cargas de sustitución | Solo LTn = n·mc1 + ΔI1 + … + ΔIn−1. | Agrega cargas parciales LTn,k (4.3.3-5b, 7.1.2-15b/16b). |
| Factor de cobertura (7.3, Apéndice B) | «Aproximadamente 95 %»; k = 2 (≈ 95,5 %) si la distribución es normal y u fiable (ninguna componente tipo A con menos de 10 observaciones); si no, Welch-Satterthwaite; acepta un solo k «del peor caso» para todo el alcance. | 95,45 % explícito, con el mismo Anexo B. |
| Uso: influencias ambientales (7.4.3) | Temperatura y desgaste del ajuste; el empuje se remite a 7.1.2.2 (ŵ²(Rinstr) = ŵ²(Rtemp) + ŵ²(Radj)). | Agrega δRbuoy con fórmulas propias (7.4.3-2 a -5). |
| Densidad del aire (Apéndice A) | A1.1 exponencial (= R111 E.3); A1.2 «versión normal» ρa = [0,348444 p − hr(0,00252 t − 0,020582)]/(273,15 + t), ŵ ≈ 6,79×10⁻⁴; A1.3 Boyle-Mariotte. | A1.1 exponencial y fórmula por altitud; remite a CIPM-2007. |
| Contenido del certificado (8) | 8.2 pide lugar de calibración y de instalación si difieren, y el ajuste realizado. 8.3 no menciona la excentricidad. 8.4: la incertidumbre en uso puede acompañar al certificado **sin ser parte de él**. | 8.2 pide además si el ajuste fue interno o externo y con qué pesa. 8.3 pide **información del ensayo de excentricidad**. 7.4 agrega que las estimaciones basadas en datos no medidos por el laboratorio no se presentan como parte del certificado. |
| Lo que no tiene | Pesada mínima. | Anexo G (pesada mínima) y Anexo H con un cuarto ejemplo (función de aproximación del error). |

## Terminología de la versión SIM

Útil para redactar certificados y pantallas con la terminología que cita el
laboratorio:

| Guía SIM (2009) | EURAMET v4.0 (traducción CEM) |
|---|---|
| carga de prueba | carga de ensayo |
| división de escala, d | escalón, d |
| alcance (de pesada) | rango (de pesaje) |
| multi-intervalo | multi-escalón |
| incertidumbre estándar | incertidumbre típica |
| ŵ (incertidumbre relativa) | urel |
| ajuste a cero / tarar | puesta a cero / tara |

## Cómo usar esta skill

1. Si el procedimiento o el certificado citan la Guía SIM, el cálculo debe ser
   el que la Guía SIM describe. Donde la tabla de diferencias muestra dos
   caminos (empuje del aire, excentricidad, s ponderada, k), **no elijas tú**:
   pregunta al usuario cuál aplica el procedimiento del laboratorio y anótalo en
   la sección «Decisiones del laboratorio» de abajo.
2. Si el laboratorio cita las dos guías, el certificado debe dejar claro qué
   método se aplicó (EURAMET 8.2 pide referir o describir el procedimiento). El
   contenido mínimo del certificado lo fija la NB/ISO/IEC 17025 7.8 (skill
   `nb-iso-17025`), que manda sobre la sección 8 de la guía.
3. Usa los ejemplos del Apéndice G como casos de prueba automáticos de los
   cálculos de DataMET+ (NB/ISO/IEC 17025 7.11.6, skill `nb-iso-17025`).
4. En Bolivia el aire está muy lejos de 1,2 kg/m³: lee la sección de altitud de
   la skill `euramet-cg-18` antes de programar el empuje del aire. Las fórmulas
   simplificadas con pesas R111 suponen ρa dentro de ±10 % de 1,2 kg/m³.

## Decisiones del laboratorio

El 2026-11-05 el usuario decidió que **EURAMET cg-18 v4.0 rige el cálculo** y
que la Guía SIM se sigue citando: en cada fila de la tabla de diferencias se
aplica la columna de EURAMET (empuje sin los casos B1/B2, métodos de
excentricidad de v4.0, s por intervalo, k al 95,45 %, sustitución con
7.1.2-15). El texto «Método utilizado» del certificado y el procedimiento
P-VMET-02-7.2 deben actualizarse para citar ambas. Resto de decisiones en la
skill `euramet-cg-18`.
