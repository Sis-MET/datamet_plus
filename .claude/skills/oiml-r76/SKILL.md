---
name: oiml-r76
description: OIML R 76-1:2006, Instrumentos para pesar de funcionamiento no automático (balanzas y básculas) — requisitos metrológicos y ensayos, una de las cinco normas que Métrica Ltda. (laboratorio acreditado por DTA-IBMETRO) debe cumplir en Calibración. Úsala al registrar o validar las características de una balanza (clase I/II/III/IIII, Max, Min, d, e, n, multi-intervalo, multi-rango), al calcular errores máximos permitidos (emp) en verificación inicial o en servicio, al declarar conformidad, al elegir pesas patrón para una balanza, al revisar ensayos de excentricidad, repetibilidad, discriminación, cero y tara, o al emitir certificados de calibración de balanzas.
---

# OIML R 76-1:2006 — Instrumentos para pesar de funcionamiento no automático

> Resumen con palabras propias para guiar el desarrollo; no es el texto oficial.
> Ante una duda o en una auditoría manda la Recomendación de la OIML.

## Identidad del documento

- **OIML R 76-1, Edición 2006 (E)**: *Non-automatic weighing instruments. Part 1:
  Metrological and technical requirements – Tests*. La Parte 2 (R 76-2:2007) es
  el formato del informe de ensayo. EURAMET cg-18 y la Guía SIM la citan para
  todo el vocabulario del instrumento.
- Fuente oficial (gratuita): https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf
- A noviembre de 2026 la edición 2006 sigue vigente: la OIML (TC9/SC1) tiene la
  revisión en borrador de comité. Si aparece una edición nueva, revisa esta skill.
- Es metrología **legal** (aprobación de modelo y verificación). La calibración
  según EURAMET/SIM **no** aplica los emp de la R76 como criterio de aceptación
  salvo que se haya acordado una declaración de conformidad; la R76 sí aporta las
  definiciones, las clases, los emp y varios valores por defecto que usa la
  estimación de incertidumbre.

## Cómo encajan las cinco normas

| Norma | Qué aporta |
|---|---|
| ISO/IEC Guide 98-3:2008 (GUM) — skill `gum-iso-iec-guide-98-3` | Marco de incertidumbre. |
| EURAMET cg-18 v4.0 — skill `euramet-cg-18` | Método de calibración de balanzas y contenido del certificado. |
| Guía SIM MWG7/cg-01 (2009) — skill `guia-sim-ipfna` | Versión anterior del mismo método, en español. |
| **OIML R76-1:2006** — esta skill | Vocabulario, clases, emp y ensayos del instrumento. |
| OIML R111-1:2004 — skill `oiml-r111` | Pesas patrón. |

## Vocabulario esencial (capítulo T)

- **Max** alcance máximo; **Min** alcance mínimo (por debajo, error relativo
  grande); **Lim** carga máxima segura; **T** efecto máximo de tara.
- **d** escalón real (división de la indicación); **e** escalón de verificación
  (define la clase y los emp); **n = Max/e** número de escalones de verificación.
- **Multi-intervalo:** un solo rango Min–Max dividido en tramos parciales con e1 <
  e2 < …, que cambian solos según la carga. **Multi-rango:** dos o más rangos con
  su propio Max y e, cada uno tratado como un instrumento aparte.
- **Unidades permitidas (2.1):** kg, mg, g, t; quilate métrico (ct = 0,2 g) en
  aplicaciones especiales.

## Clases y clasificación (3.1–3.4)

Clases (Tabla 1): **I** especial, **II** fina, **III** media, **IIII** ordinaria.

Escalón de verificación (Tabla 2 y 3.4.2): sin dispositivo indicador auxiliar,
**e = d**. Con dispositivo auxiliar (solo clases I y II, solo a la derecha de la
coma, nunca en multi-intervalo): **d < e ≤ 10 d** y **e = 10ᵏ kg**. Excepción:
clase I con d < 1 mg → e = 1 mg. Con dispositivo auxiliar, Min se calcula con d
en lugar de e (3.4.3). Clase I con d < 0,1 mg puede tener n < 50 000 (3.4.4).

**Tabla 3 — Clasificación**

| Clase | e | n mínimo | n máximo | Min (límite inferior) |
|---|---|---|---|---|
| I | 0,001 g ≤ e | 50 000 | — | 100 e |
| II | 0,001 g ≤ e ≤ 0,05 g | 100 | 100 000 | 20 e |
| II | 0,1 g ≤ e | 5 000 | 100 000 | 50 e |
| III | 0,1 g ≤ e ≤ 2 g | 100 | 10 000 | 20 e |
| III | 5 g ≤ e | 500 | 10 000 | 20 e |
| IIII | 5 g ≤ e | 100 | 1 000 | 10 e |

- En la práctica no se verifica con e < 1 mg por la incertidumbre de las cargas.
- Instrumentos que fijan tarifas o peajes (p. ej. postales, residuos): Min = 5 e.
- Multi-rango: e1 < e2 < … < er; Min, n y Max con el mismo subíndice.

**Multi-intervalo (3.3):** cada tramo i tiene ei, Maxi y Mini = Maxi−1 (Min1 =
Min); ni = Maxi/ei. Cada tramo y Min1 cumplen la Tabla 3. Salvo el último,
**Maxi/ei+1 ≥ 50 000 (I), 5 000 (II), 500 (III), 50 (IIII)** (Tabla 4). Cuando
un requisito se expresa en e, se usa el e del tramo donde cae la carga; cerca de
cero, e1.

## Errores máximos permitidos (3.5)

**Tabla 6 — emp en verificación inicial**, carga m expresada en e:

| emp | Clase I | Clase II | Clase III | Clase IIII |
|---|---|---|---|---|
| ± 0,5 e | 0 ≤ m ≤ 50 000 | 0 ≤ m ≤ 5 000 | 0 ≤ m ≤ 500 | 0 ≤ m ≤ 50 |
| ± 1,0 e | 50 000 < m ≤ 200 000 | 5 000 < m ≤ 20 000 | 500 < m ≤ 2 000 | 50 < m ≤ 200 |
| ± 1,5 e | 200 000 < m | 20 000 < m ≤ 100 000 | 2 000 < m ≤ 10 000 | 200 < m ≤ 1 000 |

- **En servicio, el emp es el doble** del de verificación inicial (3.5.2). La
  verificación posterior usa los de verificación inicial; la inspección en
  servicio, el doble (8.4).
- Multi-intervalo: cada tramo usa su ei con los límites de la Tabla 6. Ejemplo
  de la norma: Max 2/5/15 kg, e = 1/2/10 g, clase III → ±0,5 g hasta 500 g; ±1 g
  hasta 2 kg; ±2 g hasta 4 kg; ±3 g hasta 5 kg; ±10 g hasta 15 kg.
- El error de redondeo de una indicación digital debe eliminarse si **d > 0,2 e**
  (3.5.3.2), con el método del punto de cambio (A.4.4.3).
- Los emp valen para el valor neto con cualquier tara (salvo tara predeterminada)
  y, en un dispositivo de pesaje de tara, igual que para el instrumento (3.5.3.3–4).

Función de referencia para DataMET+ (verificación inicial; en servicio ×2):

```text
emp_inicial(m, clase, e):
  k = m / e
  límites = { I: (50000, 200000), II: (5000, 20000), III: (500, 2000), IIII: (50, 200) }
  (l1, l2) = límites[clase]
  si k ≤ l1 → 0,5 e;  si k ≤ l2 → 1,0 e;  si no → 1,5 e
  (en multi-intervalo: usar el ei del tramo donde cae m)
```

## Diferencias permitidas entre resultados (3.6)

- Ningún resultado individual puede superar el emp de esa carga.
- **Repetibilidad (3.6.1):** la diferencia entre varias pesadas de la misma carga
  no supera |emp| de esa carga.
- **Excentricidad (3.6.2):** las indicaciones en distintas posiciones cumplen el
  emp. Carga de ensayo:
  - por defecto **1/3 de (Max + efecto máximo de tara aditiva)**;
  - receptor con n > 4 apoyos: **1/(n − 1)** de esa suma en cada apoyo;
  - tanques, tolvas (descentrado mínimo): **1/10** en cada apoyo;
  - cargas rodantes (básculas camioneras, de vía): la carga rodante usual más
    pesada y concentrada, sin pasar de **0,8 (Max + T)**.
- **Varios dispositivos indicadores (3.6.3):** diferencia ≤ |emp|; entre
  indicador digital e impresora, cero.

## Patrones para verificar (3.7)

- Pesas según **OIML R111**, con error ≤ **1/3 del emp** del instrumento para esa
  carga. Si son E2 o mejores, basta que su **incertidumbre** sea ≤ 1/3 del emp,
  usando su masa convencional real y su estabilidad a largo plazo (3.7.1).
- Dispositivo auxiliar de verificación: emp ≤ 1/3 del emp; si usa pesas, su
  efecto ≤ 1/5 del emp (3.7.2).
- **Sustitución en el lugar de uso (3.7.3):** al menos **1/2 Max** en pesas
  patrón; **1/3 Max** si el error de repetibilidad ≤ 0,3 e; **1/5 Max** si ≤ 0,2 e.
  La repetibilidad se determina con una carga cercana a la de sustitución,
  colocada 3 veces.

## Otros requisitos útiles para calibración

- **Discriminación (3.8):** digital: 1,4 d agregado suavemente cambia la
  indicación sin ambigüedad (solo d ≥ 5 mg). Analógica: |emp| desplaza al menos
  0,7 de la carga extra. No autoindicadora: 0,4 |emp| (≥ 1 mg) produce
  desplazamiento visible.
- **Temperatura (3.9.2):** sin marcado, −10 °C / +40 °C. Rangos especiales de al
  menos 5 °C (I), 15 °C (II), 30 °C (III, IIII). Efecto en cero: ≤ 1 e por 1 °C
  (clase I) o por 5 °C (resto).
- **Inclinación (3.9.1):** clases II–IIII susceptibles: límite marcado por el
  nivel, sensor automático o 50/1000. Clase I lleva nivel pero no se ensaya.
- **Tiempo (3.9.4, clases II–IIII):** fluencia ≤ 0,5 e en 30 min y ≤ 0,2 e entre
  15 y 30 min (si no, ≤ |emp| en 4 h); retorno a cero ≤ 0,5 e tras 30 min con
  carga (0,5 e1 en multi-intervalo).
- **Equilibrio estable (4.4.2):** valores impresos o guardados a ≤ 1 e del final.
- **Cero (4.5):** puesta a cero y seguimiento de cero ≤ 4 % de Max en total; cero
  inicial ≤ 20 %; **exactitud del cero ± 0,25 e**; seguimiento de cero solo en
  cero, en equilibrio y a ≤ 0,5 d/s.
- **Tara (4.6.3):** exactitud ± 0,25 e en electrónicos y analógicos (± 0,5 d en
  mecánicos digitales); e1 en multi-intervalo.

EURAMET cg-18 usa estos requisitos como valores por defecto para instrumentos
con aprobación de modelo R76: redondeo del cero tras puesta a cero o tara ±d0/4
(u = d0/(4√3)); sensibilidad a la temperatura KT ≤ emp(Max)/(Max·ΔT_aprobación);
cambio del ajuste ΔE(Max) = emp(Max); efectos de tiempo con emp(Max)/Max. Para
instrumentos sin aprobación de modelo, de 3 a 10 veces esos valores.

## Ensayos (Anexo A, obligatorio para verificación)

- **Condiciones (A.4.1):** temperatura estable (variación ≤ 1/5 del rango de
  temperatura del instrumento y ≤ 5 °C, 2 °C en fluencia; ≤ 5 °C/h). En clase I
  se aplican las correcciones por empuje del aire. El cero automático o el
  seguimiento de cero se neutralizan empezando con ≈ 10 e. Se puede usar una
  indicación con escalón ≤ e/5 (anotarlo). **Precarga a Max** una vez antes de
  cada ensayo de pesaje. Clase I: ajuste antes de cada ensayo según el manual.
- **Pesaje (A.4.4.1):** de cero a Max y de vuelta a cero. Al menos **10 cargas**
  para el error intrínseco inicial y **5** en los demás casos (verificación:
  5 suelen bastar, 8.3.3), incluyendo **Max**, **Min** (si Min ≥ 100 mg) y los
  puntos donde cambia el emp. Cargar y descargar progresivamente.
- **Punto de cambio (A.4.4.3)** para eliminar el redondeo sin indicación
  auxiliar: con carga L e indicación I, agregar pesas de ≈ e/10 hasta que la
  indicación suba sin ambigüedad a I + e; con ΔL agregado:
  `P = I + ½e − ΔL`, `E = P − L`, error corregido `Ec = E − E0 ≤ emp` (E0 = error
  en cero o cerca de cero, p. ej. 10 e). En multi-intervalo, pasos de ei/10 y ½ei
  o ½ei+1 según el tramo de la indicación.
- **Sustitución (A.4.4.5):** solo en verificación y en el lugar de uso; número de
  sustituciones según 3.7.3.
- **Excentricidad (A.4.7):** preferir pocas pesas grandes; anotar posiciones en un
  croquis; auto-cero apagado. ≤ 4 apoyos: cargar por turno los **cuatro
  cuadrantes** (≈ 1/4 de la superficie). > 4 apoyos: sobre cada apoyo, en ≈ 1/n
  de la superficie. Tanques/tolvas: en cada apoyo. Cargas rodantes: inicio, medio
  y final, en ambos sentidos si aplica.
- **Discriminación (A.4.8):** con Min, ½ Max y Max.
- **Repetibilidad (A.4.10):** aprobación de modelo: dos series, ≈ 50 % y ≈ 100 %
  de Max; 10 pesadas si Max < 1 000 kg, si no al menos 3. **Verificación: una
  serie a ≈ 0,8 Max; 3 pesadas en clases III y IIII, 6 en clases I y II.**
  Auto-cero en operación.
- **Fluencia y retorno a cero (A.4.11):** carga cercana a Max durante 30 min / 4 h.

## Cómo usar esta skill en DataMET+

1. Al registrar una balanza, guarda clase, Max, Min, d, e (y por tramo o rango si
   es multi-intervalo o multi-rango) y valida contra la Tabla 3 y 3.4.2; avisa,
   sin bloquear, si los datos no encajan (puede ser un instrumento sin aprobación
   de modelo).
2. Calcula el emp con la Tabla 6 solo cuando haga falta: conformidad acordada,
   elección de pesas (1/3 emp) o valores por defecto de incertidumbre. Muestra si
   es «verificación inicial» o «en servicio».
3. Una declaración de conformidad en un certificado de calibración sigue la regla
   de EURAMET 7.5.3 (|E| + U ≤ Tol), no basta con |E| ≤ emp.
4. Para el método de calibración y la incertidumbre usa `euramet-cg-18` o
   `guia-sim-ipfna`; esta skill da los límites y el vocabulario.
