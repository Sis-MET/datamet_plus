# Propuesta al laboratorio de Calibración — Certificados de calibración en DataMET+

**Fase 0 del plan de implementación** · Documento para revisión y aprobación del
laboratorio · Preparado por Sistemas · 2026-11-05

Este informe reúne todo lo que el laboratorio debe revisar y aprobar antes de
empezar a construir el reemplazo del libro `F-VMET-02-7.2 Registro de
calibración` en DataMET+. Se basa en el análisis del libro
([calibracion-analisis-excel.md](calibracion-analisis-excel.md)), en las
decisiones ya tomadas (sección 9 de ese análisis) y en el plan
([calibracion-plan-implementacion.md](calibracion-plan-implementacion.md)).
Las copias del libro de cada ingeniero tienen la misma estructura, así que lo
dicho aquí vale para todas.

## 1. Resumen

- **Para el técnico no cambia nada**: sigue calibrando con ServiceMET igual que
  hoy.
- **La numeración, los códigos y los nombres de archivo se mantienen tal
  cual** (sección 3).
- **El certificado conserva su contenido y su aspecto**; se agregan los datos
  que exigen la NB/ISO/IEC 17025 (7.8) y EURAMET (§8) y hoy faltan: el factor k,
  el ajuste realizado y sus resultados previos, la identificación de los datos
  del cliente (sección 7).
- **El cálculo sigue el mismo método** (comparación con pesas patrón) pero
  corrige los errores encontrados en el libro y aplica EURAMET cg-18 v4.0
  (sección 4).
- **Lo que se hacía en el libro pasa a DataMET+** con registro único, historial
  de cambios, revisión por otra persona y autorización del firmante
  (sección 5).
- **Los certificados de las pesas y los termohigrómetros se transcriben a
  DataMET+**, con verificación de una segunda persona (sección 6).

Al final (sección 11) está la lista de aprobación.

## 2. Qué cambia y qué no

| Tema | Hoy | Con DataMET+ |
|---|---|---|
| Toma de datos en campo | ServiceMET | **Igual** |
| Dónde se elabora el registro | Una copia del libro por ingeniero | Un solo registro en DataMET+; cada ingeniero ve y elabora sus servicios |
| Carga de servicios | Macro que pide el SECA | Lista de servicios agrupada por SECA, al día con ServiceMET |
| Cálculo | Fórmulas del libro | Motor de DataMET+, validado (mismo método, errores corregidos) |
| Correcciones a los datos | Se escriben sobre RECA; CARE se sobrescribe | Se registran con el valor original, el nuevo, quién y cuándo; el dato de ServiceMET nunca se pierde |
| Revisión | Lista de «SÍ» y «Rev. por» escritos en CERT | Envío a revisión; otra persona aprueba o devuelve con observaciones |
| Autorización y firma | Firma digital del PDF fuera del libro | Se autoriza en DataMET+ y se firma el PDF con la firma digital como hoy; DataMET+ archiva el PDF firmado |
| Numeración | Fórmulas del libro | **Igual** (sección 3) |
| Archivo del PDF | `PC-EMIN\<año>` en OneDrive | **Igual**, desde DataMET+ |
| Corrección de un certificado emitido | Se recupera con RERE y se vuelve a guardar | Revisión con motivo; la versión anterior queda conservada y el nuevo certificado indica a cuál reemplaza |
| Certificados de pesas y termohigrómetros | Copiados de Access a hojas del libro | Transcritos al gestor de equipos de DataMET+ y verificados |

## 3. Numeración y nombres: se mantienen tal cual

Reglas actuales del libro, que DataMET+ reproducirá sin cambios:

| Dato | Regla actual | Ejemplo |
|---|---|---|
| Negociación | 4 primeros dígitos del código de cliente + `-C` + n.º de negociación con dos dígitos (sale del SECA de ServiceMET) | `0051-C01` |
| SECA | Negociación + `-` + año (2 dígitos) | `0051-C01-26` |
| N.º de RECA | El que registra ServiceMET (`n_reca`) | `30` |
| Sticker | El que registra ServiceMET | `9934` |
| **N.º de certificado** | Negociación + `-` + RECA con dos dígitos + `-` + año (2 dígitos) | `0051-C01-30-26` |
| N.º de emisión | `01` en la primera emisión; `02`, `03`… en las siguientes | `01` |
| ID. del instrumento | Código Métrica de ServiceMET | `0051-11-035` |
| **Nombre del PDF** | N.º de certificado, n.º de emisión, razón social, marca, Max, unidad, ID. del instrumento | `0051-C01-30-26 01 CLIENTE S.A. METTLER TOLEDO 600 g 0051-11-035.pdf` |
| Carpeta del PDF | `D:\OneDrive\1. Documentos Sistema de gestión\Registros\PC-EMIN\<año>\` | `…\PC-EMIN\2026\` |
| Registro en el certificado | «SECA {SECA} N° {RECA}; STICKER N° {sticker}» | `SECA 0051-C01-26 N° 30; STICKER N° 9934` |

Para confirmar (no cambia el formato): hoy el año del número sale de la fecha
en que se registra el servicio en el libro, no de la fecha de calibración; una
calibración de fines de diciembre registrada en enero toma el año nuevo. Se
mantendrá así salvo que el laboratorio indique otra cosa.

## 4. Método de cálculo

El método sigue siendo la **comparación con pesas patrón según el procedimiento
P-VMET-02-7.2**. DataMET+ aplica las decisiones ya tomadas:

| Tema | Hoy en el libro | Propuesta (decidida) |
|---|---|---|
| Guía de referencia | Guía SIM MWG7/cg-01 (2009) | **EURAMET cg-18 v4.0 (2015)**; la Guía SIM se sigue citando y, donde difieren, manda EURAMET |
| Factor k | t de Student al 95 % (1,97); no se imprime | **t de Student al 95,45 %** con los grados efectivos; **se imprime en cada punto** |
| Redondeo de U | Decimales de d + 1 (0,00814 → 0,008) | **Dos cifras significativas hacia arriba** (0,00814 → 0,0082); el error al mismo decimal |
| Empuje del aire | Signo invertido; constante en el «caso B» | δmB = −mN(ρa − ρ0)(1/ρ − 1/ρc), con la densidad real de cada pesa |
| Densidad del aire | Fórmula aproximada; error de unidades en la humedad; u(p) fija | **CIPM-2007**; incertidumbre con el certificado del termohigrobarómetro + variación inicio-fin |
| Excentricidad | Diferencia respecto del centro, 5 posiciones | **Método 3 de EURAMET**, todas las posiciones que registre ServiceMET |
| Puntos de linealidad | Máximo 12 | Todos los que registre ServiceMET (hasta 60) |
| Piezas de cada carga | Deducidas, sin registro | DataMET+ las arma con las piezas del juego elegido; **se pueden revisar y corregir** antes de emitir y quedan registradas |
| Clase del instrumento | Deducida de n = Max/e | **Registrada** (placa o aprobación); sin clase, la que pide el cliente |
| Regla conservadora | \|E\| + U(E) ≤ T | **Igual** |
| Riesgo asociado impreso | Mal calculado (10,56 % en vez de 1,43 % en el ejemplo) | Probabilidad bilateral con u(E) = U/k |
| Sustitución, Método 2 | Suma lineal | **EURAMET 7.1.2-15** en los dos métodos |

**Efecto en certificados ya emitidos.** Corregir estos errores cambia algunos
resultados respecto del libro: sobre todo el riesgo asociado, la U (por k y
por el redondeo) y, en balanzas de gran capacidad calibradas con pesas de
fundición en altura, la masa de referencia. La corrida paralela (sección 10)
medirá el tamaño real de las diferencias. Con ese resultado, el laboratorio
decide si algún certificado emitido requiere tratamiento como trabajo no
conforme (NB/ISO/IEC 17025, 7.10).

## 5. Roles y flujo

| Rol | Quién (propuesta) | Qué hace en DataMET+ |
|---|---|---|
| Técnico de campo | Quien calibra con ServiceMET | Sube los datos, como hoy |
| **Elabora** | **El técnico que realizó el servicio** (es quien figura en «Elaborado por», como hoy) | Revisa y completa los datos, corrige con motivo, revisa las piezas de cada carga, atiende los avisos y envía a revisión |
| **Revisa y autoriza** | **El jefe de Calibración** (respuesta del 2026-11-05); si más adelante quiere delegar la revisión previa en otro integrante del área, se configura como en Soporte técnico, **nunca en quien elaboró** | Revisa datos, cálculos y certificado; aprueba o devuelve con observaciones (reemplaza la lista «Rev. por» de CERT) y autoriza |
| **Firma** | **Siempre el jefe de Calibración**, con su firma digital (respuesta del 2026-11-05) | Firma el PDF autorizado y lo sube a DataMET+ |
| Aprueba la configuración del método | El jefe de Calibración | Aprueba cada versión de parámetros, tablas y textos |
| Transcribe certificados de patrones | Un técnico de laboratorio | Carga los valores de cada certificado |
| Verifica la transcripción | Otra persona del área | Contrasta con el PDF del certificado y da conformidad |
| Software | Sistemas | Desarrolla, valida y registra cada versión en Control de cambios |

**Estados de un registro:** pendiente (solo datos de ServiceMET) → en
elaboración → en revisión → aprobado → autorizado → emitido (PDF firmado
archivado) → en revisión de reemisión → reemitido.

**Fecha de emisión:** la de la firma digital, como hoy («Corresponde a la fecha
de la firma digital en la presente página»). DataMET+ registra además quién y
cuándo autorizó.

## 6. Certificados de los patrones en DataMET+

El gestor de equipos del módulo Calibración ya registra cada equipo con su
certificado vigente (número, fecha, período, vencimiento, ente). Se agregan los
valores que hoy están en las hojas EQUI_VIGENTE y VALORES del libro:

| Equipo | Datos a transcribir de cada certificado |
|---|---|
| Juego de pesas | Piezas del juego (valor nominal, marca de duplicado: `*`, `**`; material); por pieza: corrección, U, k, emp, apta; densidad y su incertidumbre (medida o supuesta por material); condiciones ambientales de su calibración |
| Termohigrobarómetro | Por magnitud (temperatura, humedad, presión): cada punto calibrado con su corrección, U y k |

Reglas propuestas:

- Un juego puede tener **varios certificados** vigentes a la vez (por ejemplo,
  M1-1-01XX tiene uno por pieza) y certificados emitidos por el propio
  laboratorio (0000-C03, 0000-C05…).
- Un certificado transcrito **no se usa en cálculos hasta que otra persona lo
  verifica**.
- DataMET+ avisa (sin bloquear) si una pesa no cumple la OIML R111: U mayor que
  un tercio del emp, desviación fuera de emp − U, densidad fuera de los límites.
- Al calcular se usa el certificado **vigente en la fecha de la calibración**;
  si no lo había, no se puede emitir.
- Si el termohigrobarómetro no tiene certificado para una magnitud (THB-03 y
  THB-04 no tienen presión), se usa el valor por defecto de la configuración
  del método.

Inventario a transcribir (según el libro, octubre 2026):

| Tipo | Códigos |
|---|---|
| Pesas E2 | E2-003, E2-005, E2-103, E2-105 |
| Pesas F1 | F1-001, F1-101, F1-103, F1-104, F1-105, F1-201, F1-202, F1-203, F1-204 |
| Pesas F2 | F2-201 |
| Pesas M1 | CZ16, CZ17, CZ18, M1-1-01XX, M1-1-02XX, M1-1-05XX, M1-1-20XX, M1-3-05XX, M1-3-10XX, M1-3-20XX |
| Termohigrómetros y termohigrobarómetros | TH-01, TH-02, TH-03, TH-04, TH-05, THB-01, THB-02, THB-03, THB-04 |

**Pesas de clase M sin identificar.** En los juegos grandes de clase M (por
ejemplo, 30 piezas de 20 kg) el técnico informa cuántas usó, no cuáles.
Propuesta: si las piezas no se identifican, se usa su valor nominal con
incertidumbre emp/√3 (EURAMET 7.1.2-3); si se identifican, la corrección y la U
de su certificado.

## 7. Propuesta de certificado completo

Se mantiene el diseño de la hoja CERT (3 hojas A4, mismos títulos y orden). Las
marcas indican: **=** se mantiene, **+** nuevo, **~** cambia.

### Hoja 1 — Datos generales

| Bloque | Contenido | |
|---|---|---|
| Encabezado | Web, correo, N° de certificado (en cada hoja) | = |
| Datos del cliente | Razón social, dirección | = |
| Datos del calibrando | Tipo, receptor de carga, marca, Max, modelo, d (y e si difiere), serie, unidad, cód. interno, ID. del instrumento | = |
| | **Clase de exactitud** y su origen, solo cuando se declara conformidad con el emp NB 23001: «Clase II (placa)» o «Clase III *» (indicada por el cliente) | + |
| Datos de la calibración | Lugar, fecha de calibración, fecha de emisión (firma digital), condiciones ambientales, patrones, trazabilidad, alcance (Min′ a Max′ o todo el rango), registro (SECA, RECA, sticker) | = |
| | **Ajuste del instrumento**: «Se realizó ajuste externo con pesa patrón de 1000 g (F1) antes de la calibración» / «ajuste interno» / «No se realizó ajuste» (EURAMET 8.2) | + |
| | **Método utilizado** (texto propuesto abajo) | ~ |
| Firmas | Elaborado por; Autorizado por (firma digital); verificación de la firma | = |
| Pie | Leyenda de reproducción íntegra y alcance de los resultados | = |

Texto propuesto para «Método utilizado»:

> Comparación con pesas patrón, según procedimiento METRICA «P-VMET-02-7.2»,
> elaborado en base a la Guía EURAMET cg-18 v4.0 (2015) y la Guía SIM
> MWG7/cg-01/v.00 (2009).

### Hoja 2 — Resultados

| Bloque | Contenido | |
|---|---|---|
| Excentricidad | Carga aplicada; diferencia de cada posición respecto del centro; figura del receptor con las posiciones | = |
| | Todas las posiciones registradas (hasta 6) | ~ |
| Repetibilidad | Carga, desviación estándar, diferencia máxima; «Se realizaron N repeticiones» | = |
| | Aclaración: «La desviación estándar corresponde a una sola indicación» (EURAMET 8.3) | + |
| Errores de indicación | Carga aplicada, error, incertidumbre expandida, emp o tolerancia, declaración de conformidad, riesgo asociado % | = |
| | **Columna k** (factor de cobertura de cada punto) | + |
| | Riesgo asociado calculado correctamente | ~ |
| | Todos los puntos registrados (hoy, máximo 12) | ~ |
| **Errores antes del ajuste** | Solo si hubo ajuste: tabla carga / indicación / error con las lecturas tomadas antes de ajustar (NB/ISO/IEC 17025 7.8.4.1 d) | + |
| Gráficos | Error con las bandas de emp o tolerancia; desviación estándar | = |

### Hoja 3 — Notas y cierre

| Bloque | Contenido | |
|---|---|---|
| Pruebas realizadas | Textos actuales (repetibilidad, errores y excentricidad evaluados; ceros ajustados; cargas según el uso del cliente; distribución simétrica) | = |
| | Nota de incertidumbre (texto propuesto abajo) | ~ |
| Regla de decisión | Textos actuales de la regla simple y la conservadora | = |
| | **Datos del cliente**: «(*) Dato proporcionado por el cliente: …» para la tolerancia, el rango de uso o la clase pedida (texto propuesto abajo) | + |
| | Si se usaron lecturas con resolución mayor que d (modo servicio o punto de salto): advertencia de EURAMET 8.3 | + |
| Observaciones | Las del técnico o «Ninguna.» | = |
| Cierre | «FIN DEL CERTIFICADO.» | = |
| Revisiones | Solo en reemisiones: «Revisiones del certificado», con número, fecha y motivo de cada una | + |

Texto propuesto para la nota de incertidumbre (reemplaza «nivel de confianza
aproximado del 95 %»):

> La incertidumbre expandida declarada es la incertidumbre típica combinada
> multiplicada por el factor de cobertura k indicado para cada punto, que
> corresponde a una probabilidad de cobertura de aproximadamente 95,45 %
> (distribución t de Student con los grados efectivos de libertad). Se
> determinó según EURAMET cg-18 v4.0 y la ISO/IEC Guide 98-3:2008.

Texto propuesto para los datos del cliente:

> (*) Dato proporcionado por el cliente. METRICA Ltda. no es responsable de
> esta información; la declaración de conformidad depende de ella.

### Anexo — Información adicional (no forma parte del certificado)

Hoy está en la hoja INCO, que no funciona. Se propone ofrecerlo **solo cuando
el cliente lo pida**, en una hoja aparte rotulada «Información adicional — no
forma parte del certificado de calibración» (EURAMET 7.4 y 8.4):

- incertidumbre esperada en uso, U(W) ≈ α + β·R, con sus condiciones;
- pesada mínima para las tolerancias y factores de seguridad que indique el
  cliente;
- evaluación de repetibilidad según USP <41>, si la pide.

## 8. Regla para armar las cargas con las piezas del juego

1. Se usan solo las piezas de los juegos que el técnico declaró en ServiceMET,
   activas y con certificado vigente y verificado en la fecha de la calibración.
2. Cada carga se arma **de mayor a menor pieza**, recorriendo los juegos en el
   orden en que el técnico los declaró (como hace hoy el libro).
3. Entre piezas duplicadas del mismo valor, primero la que no tiene marca,
   luego `*`, luego `**`.
4. Si no se puede formar la carga exacta, la carga queda **sin composición** y
   DataMET+ avisa para completarla a mano.
5. Quien elabora puede cambiar las piezas de cualquier carga; el cambio queda en
   el historial con su motivo.

## 9. Configuración inicial del método (versión 1)

| Parámetro | Valor propuesto | Fundamento |
|---|---|---|
| Probabilidad de cobertura | 95,45 % | EURAMET 7.3; decisión 2 |
| Factor k | t de Student con νeff (Welch-Satterthwaite) | EURAMET B; GUM G |
| Redondeo de U | 2 cifras significativas, hacia arriba | GUM 7.2.6; decisión 3 |
| Densidad del aire | CIPM-2007 | OIML R111, Enmienda 2025 |
| u(t), u(HR), u(p) | U/k del certificado del termohigrobarómetro combinada con la variación inicio-fin (/√12) | Decisión 5 |
| u(p) sin certificado de presión | 20 hPa (el valor que usa hoy el libro) | Respaldo |
| Incertidumbre del empuje | EURAMET 7.1.2-5b con la densidad del aire de la calibración de las pesas; si no se conoce, 7.1.2-5a | EURAMET 7.1.2.2 |
| u(δmc) de la pesa | U/k de su certificado (clase E y F); emp/√3 si la pieza no está identificada (clase M) | EURAMET 7.1.2-2 y -3 |
| Deriva de las pesas | D = kD·U con kD = 1 (el valor que usa hoy el libro); sin historial, D = emp | EURAMET 7.1.2-10 |
| Convección | Solo pesas F1 o mejores; ΔT según el tiempo de estabilización declarado (como hoy) | EURAMET 7.1.2.4, Anexo F |
| Excentricidad | Método 3 | EURAMET 5.3, 6.3-2 |
| Repetibilidad | s por intervalo (la mayor de las dos cargas que encierran el punto); ν = n − 1 de esa s | EURAMET 7.1.1.3 |
| Sustitución | EURAMET 7.1.2-15a/b | Decisión 8 |
| emp NB 23001 | Emp en servicio por clase (1e, 2e, 3e por tramos), como hoy | OIML R76, 3.5.2 |
| Regla conservadora | \|E\| + U(E) ≤ T | Decisión 7 |
| Avisos | Excentricidad > 2d; lectura que se aparta de su carga > 4d; U > 3d; patrón vencido o sin verificar; técnico sin identificar | Alertas actuales del libro |

Estos valores quedan en una configuración con versión: el jefe de Calibración
puede cambiarlos más adelante sin modificar el software, y cada certificado
recuerda con qué versión se calculó.

## 10. Cómo se validará

1. **Pruebas automáticas** con los ejemplos resueltos de EURAMET (Anexo H) y de
   la Guía SIM (Apéndice G).
2. **Corrida paralela**: se recalculan en DataMET+ los certificados de 2026 de
   todas las copias del libro y se comparan con lo emitido. Cada diferencia se
   explica por uno de los errores corregidos (sección 4) o se investiga.
   Criterio: ninguna diferencia sin explicar.
3. **Informe de validación** con esos resultados, aprobado por el laboratorio y
   registrado en Control de cambios (NB/ISO/IEC 17025 7.11.2).
4. **Periodo de prueba** con servicios reales en paralelo al libro antes del
   corte.

## 11. Lista de aprobación

| # | Punto | Aprobado | Observaciones |
|---|---|---|---|
| 1 | Numeración y nombres tal cual (sección 3), incluido el año según la fecha de registro | ☐ | |
| 2 | Método de cálculo y corrección de errores (sección 4) | ☐ | |
| 3 | Roles, flujo y fecha de emisión (sección 5). Respondido el 2026-11-05: elabora el técnico del servicio; revisa, autoriza y firma el jefe de Calibración | ☐ | |
| 4 | Transcripción y verificación de certificados de patrones (sección 6), incluida la regla para pesas M sin identificar (pendiente de respuesta) | ☐ | |
| 5 | Certificado propuesto (sección 7) y sus textos | ☐ | |
| 6 | Errores antes del ajuste. Respondido el 2026-11-05: las precargas se hacen antes y según sus resultados se ajusta, así que sus lecturas se imprimen como «errores antes del ajuste» cuando hubo ajuste | ☐ | |
| 7 | Anexo de información adicional solo a pedido del cliente (sección 7) | ☐ | |
| 8 | Regla para armar las cargas (sección 8) | ☐ | |
| 9 | Configuración inicial del método (sección 9) | ☐ | |
| 10 | Plan de validación (sección 10) | ☐ | |
| 11 | Actualización del procedimiento P-VMET-02-7.2 (documento controlado): referencia a EURAMET v4.0, cálculo y flujo en DataMET+, roles | ☐ | |

Aprobado por: ______________________  Cargo: ______________________
Fecha: ____________

## Anexo — Tareas de Sistemas en la fase 0

- Registrar el cambio en Control de cambios al crear la primera migración.
- Trabajar en `DataMET_prueba` revisando antes el estado de las migraciones.
- Preparar datos de prueba: filas reales de ServiceMET anonimizadas y los
  resultados del libro para las mismas balanzas (corrida paralela).
- Reunir las copias del libro de cada ingeniero (todas con la misma estructura).
