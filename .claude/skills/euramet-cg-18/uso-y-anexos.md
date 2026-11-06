# EURAMET cg-18 v4.0 — Incertidumbre en uso y anexos

Complemento de [SKILL.md](SKILL.md). Mismo aviso: resumen con palabras propias,
no es el texto oficial; los números entre paréntesis son ecuaciones de la guía.

## 7.4 Incertidumbre del resultado de una pesada (en uso)

Son **recomendaciones para el usuario** del instrumento, no exhaustivas ni
obligatorias. Si el laboratorio las ofrece con datos que no midió, van
**separadas del certificado** (anexo que no forma parte de él).

En uso cambian: las indicaciones, la forma de pesar (una sola lectura, con d y no
con mayor resolución, carga y descarga, carga mantenida, descentrada, tara), el
ambiente y, si no se reajusta, el ajuste por envejecimiento; además, la
repetibilidad del ajuste.

Símbolos: **R_L** lectura con carga, **R_0** lectura sin carga, siempre con la
resolución normal d.

- **Bajo condiciones de calibración:**
  W* = R_L + δR_digL + δR_rep + δR_ecc − R_0 − δR_dig0 − E (7.4-1a);
  u²(W*) = u²(E) + u²(δR_dig0) + u²(δR_digL) + u²(δR_rep) + u²(δR_ecc) (7.4-2a).
- **General:** W = W* + δR_instr + δR_proc (7.4-1b);
  u²(W) = u²(W*) + u²(δR_instr) + u²(δR_proc) (7.4-2b).

**7.4.1 Lectura:** u(δR_dig0) = d0/√12 (7.4.1-2); u(δR_digL) = dL/√12 (7.4.1-3);
u(δR_rep) = s de **una** lectura, del certificado, no la de la media (7.4.1-4);
urel(δR_ecc) = |ΔIecc,i|máx/(2·Lecc·√3) (7.4.1-5);
u²(R) = d0²/12 + dL²/12 + s²(R) + [|ΔIecc,i|máx/(2·Lecc·√3)]²·R² (7.4.1-6).

**7.4.2 Error de la lectura:** u(E) del certificado si R coincide con un punto
calibrado; si no, con α y β (7.1.3-2), por interpolación o por la función de
aproximación. Del certificado: u(Ecal) = U95(Ecal)/k declarado. Normalmente u(E)
no es menor que la del punto calibrado más cercano, salvo con función de
aproximación.

**7.4.3 Influencias ambientales (δR_instr):** sin corrección; salvo el empuje,
no aplican a instrumentos ajustados justo antes de usarlos.

| Término | urel | Ecuación |
|---|---|---|
| Temperatura δR_temp | KT·ΔT/√12; KT del fabricante (∂I(Max)/∂T/Max, en 10⁻⁶/K); con aprobación R76, KT ≤ emp(Max)/(Max·ΔT_aprobación); sin aprobación, 3 a 10 veces eso o no informar. Si hay ajuste interno automático por ΔT, usar ese ΔT. | 7.4.3-1 |
| Empuje δR_buoy, ajustado justo antes de usar | Δρa·u(ρs)/ρc², con u(ρs) de la pesa de ajuste (interna o externa) | 7.4.3-2 |
| Empuje, sin ajuste antes de usar | Δρa/(ρc·√3) | 7.4.3-3 |
| … conociendo ΔT del lugar | √(1,07×10⁻⁴ + 1,33×10⁻⁶ K⁻²·ΔT²)·ρ0/ρc | 7.4.3-4 |
| … sin ninguna suposición (más conservadora) | 0,1·ρ0/(ρc·√3) | 7.4.3-5 |
| Deriva del ajuste δR_adj | \|ΔE(Max)\|/(Max·√3); ΔE(Max) = mayor diferencia de error cerca de Max entre calibraciones consecutivas; si no, del fabricante, o emp(Max) con aprobación R76; proporcional al tiempo entre calibraciones | 7.4.3-6 |

u²rel(δR_instr) = u²rel(δR_temp) + u²rel(δR_buoy) + u²rel(δR_adj) (7.4.3-7).

**7.4.4 Manejo del instrumento (δR_proc):**

- **Tara (7.4.4.1):** R_Net = R′_Gross − R′_Tare (7.4.4-1);
  W_Net = R_Net − [E(Gross) − E(Tare)] + δR_instr + δR_proc (7.4.4-2);
  E_Net = E(Net) + δR_Tare (7.4.4-3), con pendientes qE = (Ej+1 − Ej)/(Ij+1 − Ij)
  (7.4.4-4) y urel(δR_Tare) = (qE,máx − qE,mín)/√12 (7.4.4-5). Se toma
  u(E(Net)) = u(E(R = Net)).
- **Tiempo: fluencia e histéresis (7.4.4.2):**
  - carga y descarga continuas en la calibración: urel = |ΔEj|máx/(mj·√12)
    (7.4.4-6);
  - solo creciente, con error de retorno a cero E0: urel = |E0|/(Max·√3)
    (7.4.4-7);
  - sin información: límite ΔE(R) = R·emp(Max)/Max (7.4.4-8);
    urel = emp(Max)/(Max·√3) con aprobación R76 (7.4.4-9a) y m·emp(Max)/(Max·√3)
    con m de 3 a 10 sin aprobación (7.4.4-9b);
  - pesadas decrecientes en uso: combinar tara (7.4.4-5) y tiempo (7.4.4-9); R se
    toma positivo.
- **Excentricidad en uso (7.4.4.3):** efecto completo:
  urel(δR_ecc) = |ΔIecc,i|máx/(Lecc·√3) (7.4.4-10).

**7.4.5 Totales:**
u²(W*) = d0²/12 + dL²/12 + s²(R) + u²rel(δR_ecc)·R² + u²(E) (7.4.5-1a);
u²(W) = u²(W*) + [u²rel(δR_temp) + u²rel(δR_buoy) + u²rel(δR_adj) +
u²rel(δR_Tare) + u²rel(δR_time)]·R² (7.4.5-1b); agrupado
**u²(W) = αW² + βW²·R²** (7.4.5-2).

## 7.5 Incertidumbre expandida en uso y conformidad

- Con corrección: **W* = R − E(R) ± U(W*)** (7.5.1-1a) o **W = R − E(R) ± U(W)**
  (7.5.1-1b); U = k·u (7.5.1-2a/b). Para U(W*), k según 7.3; para U(W), **k = 2**
  en la mayoría de los casos aunque s venga de pocas lecturas o kcal > 2, por la
  cantidad de términos.
- **Incertidumbre global** (errores incluidos, sin corregir lecturas):
  W = R ± Ugl(W) (7.5.2-1). Formas: k·√[u²(W) + E(R)²] (7.5.2-2a);
  k·√[u²(W) + E0²] (7.5.2-2b); k·√[u²(W) + (E0·R/Max)²] (7.5.2-2c);
  k·u(W) + |E(R)| (7.5.2-3a); k·u(W) + |E0| (7.5.2-3b);
  k·u(W) + |E0|·R/Max (7.5.2-3c). La más usada es (7.5.2-3a), con
  U(W) ≈ U(W=0) + [U(W=Max) − U(W=0)]·R/Max (7.5.2-3d) y E(R) = a1·R, lo que da
  **Ugl(W) ≈ U(W=0) + {[U(W=Max) − U(W=0)]/Max}·R + |a1·R|** (7.5.2-3e).
  Multi-escalón: tramo por tramo (7.5.2-3f); multi-rango: por rango. Debe cubrir
  al menos 95 % en todo el rango; k = 2.
- **Conformidad (7.5.3):** se puede declarar, coherente con ISO/IEC 17025, si
  **|E(R)| + U(W(R)) ≤ Tol(R)** para cada R o para un tramo; Tol puede ser x % de
  R, n·d, etc., y variar por tramos.

## Anexo A — Densidad del aire

- **A1.1 Fórmula simplificada (= R111 E.3):**
  ρa = [0,348 48·p − 0,009·RH·exp(0,061·t)] / (273,15 + t), p en hPa, RH en %,
  t en °C. urel de la fórmula 2,4×10⁻⁴ para **600–1 100 hPa**, 20–80 % RH,
  15–27 °C. CIPM-2007 (completa en la skill `oiml-r111`): urel 2,2×10⁻⁵ sin los
  parámetros; lo mejor alcanzable con todo ≈ 8×10⁻⁵.
- **A1.2 Por altitud** (sin medir p ni t; vale a 20 °C y 50 % RH):
  ρa = ρ0·exp(−ρ0·g·hSL/p0), p0 = 101 325 Pa, ρ0 = 1,200 kg/m³, g = 9,81 m/s²;
  urel 1,2×10⁻².
- **A2 Variaciones típicas** cuando no se mide: presión ±40 hPa como máximo,
  distribución normal, **u(p) = 10 hPa**; presión media p(h) = p0·exp(−0,000 12·h)
  con h en m (A2.1-2). Temperatura: 17–27 °C oficina o laboratorio con ventanas;
  ΔT ≤ 5 K sala sin ventanas en el centro del edificio; −10 a +30 °C (ΔT ≤ 40 K)
  taller abierto; **u(T) = ΔT/√12**. Humedad: 30–80 % oficina; ΔRH ≤ 30 % sala
  interior; 20–80 % taller; **u(RH) = ΔRH/√12**. Con RH < 40 % pueden aparecer
  efectos electrostáticos; con > 60 %, corrosión.
- **A3 Incertidumbre:** u(ρa)/ρa = √[(1×10⁻⁵ Pa⁻¹·u(p))² + (−4×10⁻³ K⁻¹·u(T))² +
  (−9×10⁻³·u(RH))² + (uform/ρa)²], con RH como fracción (A3-1). Con u(p) = 10 hPa,
  ΔRH = 100 % y ΔT del lugar: **u(ρa)/ρa = √(1,07×10⁻⁴ + 1,33×10⁻⁶ K⁻²·ΔT²)**
  (A3-2) (≈ 1,06×10⁻² con ΔT = 2 K; 1,18×10⁻² con 5 K; 1,55×10⁻² con 10 K;
  2,53×10⁻² con 20 K).

## Anexo B — Factor de cobertura

Objetivo: 95,45 % siempre. k = 2 con distribución normal (N ≥ 3 contribuciones
comparables de distribuciones bien comportadas) y fiabilidad suficiente (ninguna
tipo A con menos de 10 observaciones). Si no:
**νeff = u⁴(E) / Σ[u⁴i(E)/νi]** (B3-1) y k de la tabla G.2 de la GUM al 95,45 %
(ver skill `gum-iso-iec-guide-98-3`). Componente no normal dominante
(uR ≤ 0,3·u1): rectangular k = 1,65; triangular 1,90; en U 1,41; trapezoidal
con β < 0,95: k = [1 − √((1 − 0,95)(1 − β²))] / √((1 + β²)/6) (B4-1). Dos
dominantes que forman un trapecio: uR con las restantes.

## Anexo C — Errores en función de la indicación

- **Interpolación lineal** entre puntos k y k+1:
  E(R) = Ek + (R − Ik)(Ek+1 − Ek)/(Ik+1 − Ik) (C2.1-1) y lo mismo para U (C2.1-2).
- **Aproximación por mínimo χ²:** χ² = Σ pj·[f(Ij) − Ej]², pj ∝ 1/u²j
  (C2.2-1). Modelo consistente si **χ²obs ≤ ν = n − npar** (C2.2-2a);
  alternativa más estricta: máx |f(Ij) − Ej|/U(f(Ij)) < 1 (C2.2-2b).
- **Polinomio** E = a0 + a1·R + … (C2.2-3), con npar = na + 1 ≤ n/2. Forma
  matricial: U(e) = U(mref) + U(ICal) + U(mod) (C2.2-3a), U(mref) = s·sᵀ con
  correlación alta entre referencias (C2.2-3b), U(mod) = sm²·I aumentando sm
  hasta pasar el test (C2.2-3c); P = U(e)⁻¹; â = (XᵀPX)⁻¹XᵀPe (C2.2-6);
  χ²obs = vᵀPv (C2.2-8); U(â) = (XᵀPX)⁻¹ (C2.2-9);
  u²(Eappr) = (r′ᵀâ)²·u²(R) + rᵀ·U(â)·r (C2.2-13). Si falla el test: subir el
  grado (si na + 1 ≤ n/2) o aumentar U(mod).
- **Recta** E = a0 + a1·R (C2.2-15), con fórmulas cerradas ponderadas
  (C2.2-15a–f) y u²(Eappr) = a1²·u²(R) + u²(a0) + R²·u²(a1) + 2R·cov(a0, a1)
  (C2.2-15g). Paso a paso: primero pj = 1/u²(Ej); si χ² falla, std(fit) =
  √[Σ(f(Ij) − Ej)²/(n − npar)] y p′j = 1/[u²(Ej) + std(fit)²] (C2.2-18a–c).
- **Recta por el origen** E = a1·R: a1 = ΣpIE/ΣpI², u²(a1) = 1/ΣpI²,
  u²(Eappr) = a1²·u²(R) + R²·u²(a1) (C2.2-16a–d).
- **Gradiente medio** de los errores relativos qj = Ej/Ij (sirve para valores
  netos tras tara): pj = Ij²/u²(Ej), a = Σ(p·E/I)/Σp, u²(a) = 1/Σp,
  u²(Eappr) = a²·u²(R) + R²·u²(a) (C2.2-17a–d).
- **Sin relación con la lectura (C3):** error medio Ē = ΣEj/n con
  s(E) = uappr, incluyendo el punto (0, 0) (C3.1-1/2); error máximo
  Emáx = |Ej|máx (C3.2-1), o Emáx/√3 como desviación (C3.2-2). Útiles para la
  incertidumbre global.

## Anexo E — Empuje del aire

**E1 Densidad supuesta de materiales** (incertidumbre típica, k = 1; de la R111
Tabla B.7): alpaca 8 600 (85); latón 8 400 (85); acero inoxidable 7 950 (70);
acero al carbono 7 700 (100); hierro 7 800 (100); fundición blanca 7 700 (200);
fundición gris 7 100 (300); aluminio 2 700 (65) kg/m³.

**E2.1 Incertidumbre del empuje con pesas R111** (≥ 100 g, en mg/kg; uA =
ajustada justo antes, 7.1.2-5c; uB = no ajustada, 7.1.2-5d):

| Clase | emp/mN | uA | uB |
|---|---|---|---|
| E2 | 1,60 | 0,23 | 8,89 |
| F1 | 5,00 | 0,72 | 9,38 |
| F2 | 16,0 | 2,31 | 11,0 |
| M1 | 50,0 | 7,22 | 15,88 |

Para ≤ 50 g la guía tabula u en mg por valor nominal. Solo valen con aire dentro
de ±10 % de 1,2 kg/m³.

## Anexo F — Convección

Tabla F2.1, cambio de masa aparente Δmconv (mg) según la masa y |ΔT| (K):

| m | 20 K | 15 K | 10 K | 7 K | 5 K | 3 K | 2 K | 1 K |
|---|---|---|---|---|---|---|---|---|
| 50 kg | 113,23 | 87,06 | 60,23 | 43,65 | 32,27 | 20,47 | 14,30 | 7,79 |
| 20 kg | 49,23 | 38,00 | 26,43 | 19,25 | 14,30 | 9,14 | 6,42 | 3,53 |
| 10 kg | 26,43 | 20,47 | 14,30 | 10,45 | 7,79 | 5,01 | 3,53 | 1,96 |
| 5 kg | 14,30 | 11,10 | 7,79 | 5,72 | 4,28 | 2,76 | 1,96 | 1,09 |
| 2 kg | 6,42 | 5,01 | 3,53 | 2,61 | 1,96 | 1,27 | 0,91 | 0,51 |
| 1 kg | 3,53 | 2,76 | 1,96 | 1,45 | 1,09 | 0,72 | 0,51 | 0,29 |
| 0,5 kg | 1,96 | 1,54 | 1,09 | 0,81 | 0,61 | 0,40 | 0,29 | 0,17 |
| 0,2 kg | 0,91 | 0,72 | 0,51 | 0,38 | 0,29 | 0,19 | 0,14 | 0,08 |
| 0,1 kg | 0,51 | 0,40 | 0,29 | 0,22 | 0,17 | 0,11 | 0,08 | 0,05 |
| 0,05 kg | 0,29 | 0,23 | 0,17 | 0,12 | 0,09 | 0,06 | 0,05 | 0,03 |
| 0,02 kg | 0,14 | 0,11 | 0,08 | 0,06 | 0,05 | 0,03 | 0,02 | 0,01 |
| 0,01 kg | 0,08 | 0,06 | 0,05 | 0,03 | 0,03 | 0,02 | 0,01 | 0,01 |

Valores de un comparador en cámara de vidrio: son estimaciones. Se usa |ΔT| con
los parámetros de ΔT > 0 (el efecto suele ser menor con la pesa más fría). Con
límite emp o emp/3, la convección solo importa en pesas F1 o mejores (Tabla
F2.2: p. ej. E2 de 1 kg admite ΔT ≈ 7 K para Δmconv ≤ emp y ≈ 1 K para ≤ emp/3;
F1 de 1 kg, > 20 K y ≈ 7 K). El Anexo F1 trata el tiempo de aclimatación.

## Anexo G — Pesada mínima

Cantidad mínima de muestra (peso neto, sin el recipiente) para lograr una
exactitud relativa requerida Req: U(Rmin)/Rmin = Req (G-1). Con la
incertidumbre global lineal Ugl(W) ≈ αgl + βgl·R (G-3), la relativa es
αgl/R + βgl (G-4) y **Rmin = αgl/(Req − βgl)** (G-7). Con factor de seguridad
SF > 1 (lo define el usuario): Ugl,rel ≤ Req/SF (G-8) y
**Rmin,SF = αgl·SF/(Req − βgl·SF)** (G-9). Puede informarse en el anexo de
información adicional del certificado (8.4).

## Anexo H — Ejemplos (casos de prueba del motor de cálculo)

- **H1** balanza analítica 220 g / d = 0,1 mg (ajuste independiente; opción 1
  sin corrección de empuje y opción 2 con corrección y convección).
- **H2** 60 kg multi-escalón.
- **H3** 30 000 kg / d = 10 kg con cargas de sustitución (H3.5 detalla el
  procedimiento).
- **H4** determinación de la función de aproximación del error, con su matriz de
  covarianzas.

**Vector de prueba H1, opción 1** (verificado contra la guía al escribir esta
skill). Datos: repetibilidad a 100 g, 5 lecturas 100,0006 / 100,0003 / 100,0005
/ 100,0004 / 100,0005 g → s = 0,000 114 g. Excentricidad con 100 g: centro
100,0006; demás 100,0004 / 100,0005 / 100,0007 / 100,0005 → |ΔIecc|máx =
0,0002 g. Pesas E2 con su mc (u = U/k), deriva con kD = 1,25, no ajustada antes
(empuje por 7.1.2-5d).

| mref (g) | 0 | 50,0000 | 99,9999 | 149,9999 | 220,0001 |
|---|---|---|---|---|---|
| I (g) | 0 | 50,0004 | 100,0006 | 150,0009 | 220,0014 |
| E (g) | 0 | 0,0004 | 0,0007 | 0,0010 | 0,0013 |
| u(δIdig0), u(δIdigL) (g) | 0,000 029 | 0,000 029 | 0,000 029 | 0,000 029 | 0,000 029 |
| u(δIecc) (g) | 0 | 0,000 029 | 0,000 058 | 0,000 087 | 0,000 127 |
| u(I) (g) | 0,000 118 | 0,000 124 | 0,000 134 | 0,000 149 | 0,000 175 |
| u(δmc) (g) | 0 | 0,000 015 | 0,000 025 | 0,000 040 | 0,000 062 |
| u(δmD) (g) | 0 | 0,000 022 | 0,000 036 | 0,000 058 | 0,000 089 |
| u(δmB) 5d (g) | 0 | 0,000 447 | 0,000 889 | 0,001 330 | 0,001 960 |
| u(E) (g) | 0,000 118 | 0,000 465 | 0,000 900 | 0,001 340 | 0,001 971 |
| νeff | 4 | 1 104 | 15 538 | 76 345 | 357 098 |
| k (95,45 %) | 2,87 | 2,00 | 2,00 | 2,00 | 2,00 |
| U(E) (g) | 0,000 34 | 0,000 93 | 0,001 80 | 0,002 68 | 0,003 94 |

Alternativa con 7.1.2-5e (ΔT = 5 K): u(δmB) = 0 / 0,000 103 / 0,000 201 /
0,000 304 / 0,000 446 g; νeff = 4 / 17 / 85 / 338 / 1 377; k = 2,87 / 2,16 /
2,03 / 2,01 / 2,00; U(E) = 0,000 34 / 0,000 35 / 0,000 50 / 0,000 69 /
0,000 98 g. En cero solo cuentan d0 y s. La guía acepta declarar solo la mayor
U(E) de todo el rango con k = 2,00 y «al menos 95 %».
