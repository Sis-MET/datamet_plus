# Corrida paralela: libro F-VMET-02-7.2 frente a DataMET+

Primera comparación (2026-11-09) antes de llevar los certificados de
calibración al servidor. Dos partes: **qué hace el libro** que DataMET+ podría
no cubrir y **qué números da** cada uno con los mismos servicios. Base: el
libro `registro.xlsm` (copia de un ingeniero, v.24, 233 certificados en CARE) y
`DataMET_prueba` (servicios de ServiceMET hasta el 2026-08-13). Ver también
[el análisis del libro](calibracion-analisis-excel.md).

## Resumen

- **Lo esencial coincide.** Con los mismos datos de ServiceMET, DataMET+ da el
  mismo n.º de certificado (106 de 106), la misma s de repetibilidad (99 %), la
  misma excentricidad (97 %), errores a menos de 0,2 d en el 94 % de los puntos
  y la misma decisión de conformidad en todos los puntos donde ambos la evalúan
  (81 de 81). La U coincide en la mediana (DataMET+/Excel = 1,01).
- **Tres diferencias que el laboratorio debe resolver antes de emitir con
  DataMET+:**
  1. **Clase del instrumento.** El libro la deduce de n = Max/e; DataMET+ pide
     la clase registrada (decisión de la fase 0). Sin ella no hay emp NB 23001
     ni conformidad: en la muestra, 64 de 96 servicios no tienen clase y
     **los 22 «NO CONFORME» del libro quedarían sin declarar**.
  2. **Tolerancia del cliente por rango (valor absoluto).** El libro la acepta
     (9 de 233 certificados, 4 %); DataMET+ solo admite el emp NB 23001 o un %
     de la carga.
  3. **Qué s de repetibilidad entra en cada punto.** DataMET+ usa la del
     ensayo más cercano por encima y por debajo de la carga (EURAMET 7.1.1);
     el libro, la mayor de todas para todo el rango. Por eso la U de DataMET+
     es menor (hasta ~45 %) en el 21 % de los puntos, sobre todo en cargas
     bajas.
- **Falta en DataMET+ lo que el libro pone en INCO (información
  complementaria):** la evaluación **USP ⟨41⟩** (repetibilidad, exactitud y
  adecuación de las pesas, peso mínimo de muestra), la gráfica de aportes a la
  varianza y las **condiciones del instrumento y la instalación**.
- Los demás cambios en los números son los esperados: los errores del libro ya
  documentados (empuje con signo invertido, k al 95 %, U redondeada hacia
  abajo) y que en `DataMET_prueba` todos los cálculos son **provisionales**
  (los juegos no tienen piezas ni valores cargados: se usan nominales).

## 1. Funciones del libro y su equivalente en DataMET+

| Libro | Qué hace | DataMET+ | Estado |
|---|---|---|---|
| CSV + macro DATAMET | Lee ServiceMET; máximo 12 puntos y 5 posiciones | Lee todos los puntos y las 6 posiciones | ✔ mejor |
| RECA | Formulario del registro con alertas «REVISAR» | Página del registro con avisos por sección y correcciones con historial | ✔ |
| RECA: tolerancias por rango del cliente (RANGOCLIENTE / EMPCLIENTE) | Las escribe el ingeniero a mano | — | ✖ falta (§3.2) |
| RECA: «Indicar %», factor de seguridad | % de la carga; factor para la pesada mínima | % de la carga; factores fijos en la tabla del anexo | ⚠ el factor del cliente no se destaca |
| RECA: Max′ / Min′ (rango de uso) | Alcance de la calibración | Alcance con Max′ (regla por aprobar) | ✔ |
| RECA: recomendaciones (mantenimiento, venta de pesas, reemplazo) | Quedan en CARE y se pueden filtrar | Se ven en cada registro («Criterio y cierre»), sin lista conjunta | ⚠ a confirmar si alguien las usa |
| RECA: tiempo de estabilización con estuche abierto o cerrado | Lo estima con la convección | Convección por el tiempo registrado (ΔT por aprobar) | ⚠ el tiempo sugerido no se muestra |
| CÁLCULOS / VALORES | Motor y armado de cargas | Motor validado (EURAMET, Guía SIM, GUM) y piezas por carga, elegibles a mano | ✔ |
| CÁLCULOS: clase por n = Max/e | Siempre hay emp NB 23001 | Pide la clase registrada | ✖ diferencia (§3.1) |
| CARE / REOR / RERE | Registro, copia por guardado, recuperar para corregir | Registro con estados, historial con autor y motivo, reapertura y reemisión | ✔ mejor |
| CERT | Certificado | Modelo actual (mismo diseño) y modelo sugerido | ✔ |
| CERT: lista de revisión al pie (fechas, errores coherentes, U según d y ascendente, decimales del gráfico, formato, alertas, conformidad, «Rev. por») | Marcas «SÍ» a mano | Revisión y aprobación con avisos automáticos (error > 4d, U > 3d, excentricidad > 2d) | ⚠ no hay aviso de «U no ascendente» ni de días entre calibración y emisión |
| GUARDARARCHIVO | PDF en `PC-EMIN\<año>\` | PDF firmado archivado en `CAL_DOCUMENTOS_DIR\<año>\` con su huella | ✔ |
| INCO | USP ⟨41⟩, pesada mínima, curvas, aportes a la varianza, condiciones del instrumento | Anexo con incertidumbre en uso y pesada mínima (EURAMET) | ✖ falta USP ⟨41⟩ y condiciones (§4) |
| TRAZ | Por SECA: patrones usados, certificado y enlace a su PDF en OneDrive | Patrones y certificados en cada registro y en Equipos › Patrones, sin enlace al PDF | ⚠ a confirmar si se usa en auditorías |
| COMP | Comparación interlaboratorio 2022 | — | fuera de alcance |
| Access (EQPE, EQTE, EQUI_VIGENTE, ICLI, PERS) | Datos maestros | Gestor de equipos, piezas y valores, puntos acordados, usuarios | ✔ (falta cargar los datos, §3.4) |

## 2. Números: 106 certificados

Se tomaron los 233 certificados de CARE y se buscó cada servicio en
`DataMET_prueba` por su SECA y RECA: **106 coinciden** (el resto es posterior
al 2026-08-13 o de otros SECA que no están en esa base). DataMET+ calculó 96;
los otros 10 usan juegos que no están en el gestor (F1-102, E2-104, F1-103).

| Qué se compara | Resultado |
|---|---|
| N.º de certificado | 106 de 106 iguales |
| s de repetibilidad | 284 de 288 iguales (las 4 distintas son de un servicio corregido a mano en el libro) |
| \|ΔIecc\|máx | 93 de 96 iguales (3 con datos corregidos a mano en el libro) |
| Misma carga e indicación | 1 090 de 1 129 puntos (97 %); el resto, lecturas que el ingeniero corrigió en el libro |
| \|E(DataMET+) − E(libro)\| | ≤ 0,05 d en el 79 %; ≤ 0,2 d en el 94 %; ≤ 1 d en el 98 % |
| U(DataMET+) / U(libro) | mediana 1,01; la mitad entre 0,99 y 1,03; 21 % por debajo de 0,8; 8 % por encima de 1,2 |
| Conformidad (cuando ambos evalúan) | 81 de 81 iguales |
| Tolerancia | el libro la da en 949 puntos; DataMET+ en 81 (§3.1) |

Por qué difieren los errores (hasta 0,2 d en general):

- en `DataMET_prueba` las pesas se toman por su valor nominal (sin la
  corrección del certificado), porque los juegos no tienen piezas ni valores;
- el libro aplica el empuje con el signo invertido (error 2 del análisis).

Por qué difiere la U:

- la regla de la s (§3.3), que la baja en cargas bajas;
- k por punto con νeff al 95,45 % (29 % de los puntos con k > 2 en DataMET+),
  que la sube donde la repetibilidad tiene pocas lecturas;
- la U del libro sale de varias componentes con errores ya documentados
  (u(HR) ×100, u(p) fija).

Casos con diferencias grandes: **todos son datos de ServiceMET que el ingeniero
corrigió a mano en el libro** (una indicación 0,998 por 0,0998, una
excentricidad de 7 en vez de 0,007, un servicio con las indicaciones en otra
columna). DataMET+ los marca con avisos («lectura lejos de la carga»,
«excentricidad mayor que 2d») y se corrigen en el registro, con su motivo.

## 3. Lo que hay que decidir o completar

### 3.1 Clase del instrumento (crítico) — resuelto con la opción (a), ver §4

El libro **siempre** calcula el emp NB 23001: deduce la clase de n = Max/e
(umbrales 1 000 / 10 000 / 100 000; en multirango 500 / 5 000 / 50 000).
DataMET+ pide la clase registrada (placa o aprobación de modelo) o la que pide
el cliente, y sin ella no evalúa la conformidad. ServiceMET aún no envía la
clase. Con eso, el 67 % de los certificados (los que piden NB 23001) quedaría
sin conformidad hasta que alguien cargue la clase en cada registro.

Opciones:

- **(a) Proponer la clase** con la R76 (Tabla 3: por e y n) y marcarla como
  «deducida» para que el ingeniero la confirme; el envío a revisión se bloquea
  si el cliente pidió NB 23001 y la clase no está confirmada. *(Recomendada)*
- (b) Mantener la decisión de la fase 0: el ingeniero la carga en cada
  registro, con un aviso que bloquea el envío.
- (c) Que ServiceMET registre la clase (ya está en los cambios sugeridos); no
  resuelve los servicios ya subidos.

### 3.2 Tolerancia del cliente por rango — resuelto, ver §4

Falta en DataMET+ la tolerancia absoluta por rango que el cliente define
(«hasta 300 g: ± 0,1 g»). Además, en un servicio el técnico escribió ese valor
en el campo «%», y el ingeniero lo corrigió en el libro: DataMET+ lo tomaría
como 0,1 % de la carga. Hay que agregar las tolerancias por rango al registro
(como dato del cliente, 7.8.2.2) y al motor.

### 3.3 Regla de la s de repetibilidad

DataMET+ sigue EURAMET 7.1.1 (la mayor de las dos s que encierran la carga);
el libro usa la mayor de todas, más conservador. La U baja hasta ~45 % en
cargas bajas. Si el laboratorio prefiere la regla del libro, se puede hacer
configurable en Calibración › Método (con su aprobación).

### 3.4 Datos maestros

- Juegos de pesas que no están en el gestor: F1-102, E2-104, F1-103 (en esta
  base).
- Ningún juego tiene piezas ni valores cargados en `DataMET_prueba`: todos los
  cálculos salen provisionales y las cargas grandes no se reconocen como
  sustitución (con piezas supuestas, cualquier carga «se arma»). Hay que cargar
  piezas y valores (`patrones:importar` desde el libro) antes de comparar los
  valores finales.

### 3.5 Información complementaria (INCO)

- **USP ⟨41⟩**: repetibilidad (2s/m ≤ 0,10 %, con s ≥ 0,41 d, en el 5 % de
  Max), exactitud de 5 % a 100 % de Max (error ≤ 0,10 % del valor nominal),
  adecuación de las pesas (U ≤ ⅓ de la tolerancia) y peso mínimo de muestra
  (EURAMET y USP, con factores de seguridad). La usan clientes farmacéuticos.
- **Condiciones del instrumento y la instalación** (los 12 puntos de
  ServiceMET con su comentario): el libro las entrega en INCO.
- Gráfica de aportes a la varianza: DataMET+ la tiene en «Cómo se calcula»,
  no en el anexo.

### 3.6 Menores

- Aviso de «U no ascendente» (estaba en la lista de revisión del CERT).
- Lista de recomendaciones (mantenimiento, venta de pesas, reemplazo) si el
  área comercial la usa.
- TRAZ (enlace al PDF del certificado de cada patrón) si se usa en auditorías.

## 4. Correcciones (2026-11-10) y segunda corrida

- **Clase sugerida.** Sin clase en el registro y con emp NB 23001 pedido,
  DataMET+ propone la clase por la OIML R76 (Tabla 3: e y n = Max/e de todos
  los rangos; si cumplen varias, la de menor exactitud, que es la que elegía el
  libro; fuera de la tabla, la del libro por n). El cálculo la usa con el aviso
  CLASE_SUGERIDA; el registro muestra «Usar la clase …» (origen «Deducida de
  Max/e») y **no se puede enviar ni aprobar** hasta confirmarla. El
  certificado la imprime como «III (deducida de Max/e, OIML R76)».
- **emp vacío en ServiceMET.** Como el libro (RECA C146 = «SÍ» por omisión),
  se usa el emp NB 23001, con el aviso EMP_POR_OMISION (65 de 1 658 servicios
  vigentes lo dejan vacío).
- **Tolerancia del cliente por rango.** En «Criterio y cierre», hasta 5 rangos
  «hasta X: ± T» (el último puede quedar «en adelante»), con historial; se usan
  si no se pide el emp NB 23001 ni un %, como en el libro, y el certificado los
  marca como dato del cliente.

Segunda corrida con los mismos 106 certificados:

| Qué | Antes | Después |
|---|---|---|
| Puntos con tolerancia en DataMET+ | 81 de 949 | 937 de 949 (los 12 restantes: el servicio con tolerancia por rango, que ahora se carga en el registro) |
| Tolerancia igual a la del libro | 70 de 81 | 892 de 937 (95 %) |
| Conformidad igual, sin los servicios corregidos a mano y con la misma carga | — | 738 de 752 (98 %) |

Las 14 decisiones distintas están todas al límite (|E| a 0,1–0,3 d de la
tolerancia): con las pesas por su valor nominal (cálculo provisional) y el
empuje del libro con el signo invertido, el error se corre lo suficiente.
Hay que volver a compararlas con las piezas y los valores de los patrones
cargados. Las demás diferencias de tolerancia son datos que el ingeniero
cambió en el libro (otra e, otra selección de puntos, el criterio del cliente).

## 5. Cómo se hizo

- Libro: celdas de CARE (valores guardados) y fórmulas de RECA, CÁLCULOS,
  CERT, INCO y TRAZ; macros DATAMET y GUARDAR_RECA.
- DataMET+: el mismo cálculo que la página del registro, con la configuración
  del método vigente (v1), sin correcciones del registro.
- Pendiente: repetir con las copias del libro de los otros ingenieros y con
  `DataMET` (producción), después de cargar piezas y valores de los patrones.
