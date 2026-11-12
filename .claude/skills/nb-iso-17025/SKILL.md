---
name: nb-iso-17025
description: Requisitos de la NB/ISO/IEC 17025:2018 (puntos 7.5 Registros técnicos, 7.8 Informe de resultados y certificados de calibración, 7.11 Control de los datos y gestión de la información, y 8.4 Control de registros) que debe cumplir todo software de Métrica Ltda., laboratorio acreditado por DTA-IBMETRO. Úsala al diseñar, modificar o revisar cualquier funcionalidad que registre, calcule, guarde, muestre o borre datos técnicos o registros del laboratorio (equipos, certificados, calibraciones, verificaciones, resultados, usuarios y permisos, respaldos), al diseñar, emitir, modificar o reemitir certificados de calibración o declaraciones de conformidad, al evaluar el cumplimiento normativo del sistema y al mantener la pestaña «Cumplimiento» del módulo Calibración.
---

# NB/ISO/IEC 17025:2018 en el software del laboratorio

Métrica Ltda. es un laboratorio de calibración acreditado por la **DTA-IBMETRO**
(Dirección Técnica de Acreditación del Instituto Boliviano de Metrología) con
la **NB/ISO/IEC 17025:2018** (IBNORCA), adopción boliviana idéntica de la
ISO/IEC 17025:2017. Todo software que se use en la operación del laboratorio
forma parte de su sistema de gestión de la información y se audita con los
puntos **7.5**, **7.11** y **8.4**; lo que emite al cliente (certificados de
calibración), además con el **7.8**.

> Los requisitos de abajo están **resumidos con palabras propias** para guiar
> el desarrollo. No son el texto oficial: ante una duda de interpretación o en
> una auditoría, manda la norma comprada a IBNORCA y los criterios de la DTA.

## Cómo usar esta skill

1. Antes de escribir código que toque registros, identifica qué requisitos
   aplican con la tabla de controles (abajo) y diséñalo para cumplirlos desde
   el inicio. Es más barato que corregirlo después de una auditoría.
2. Al terminar, evalúa cada requisito afectado con los estados de la sección
   «Cómo evaluar» y dilo al usuario: qué se cumple, qué queda parcial y qué
   depende del laboratorio.
3. Si el cambio altera la respuesta a algún requisito, actualiza el catálogo de
   la pestaña Cumplimiento (`backend/src/services/calibration.compliance.js`) y
   sus pruebas (`backend/tests/calibration.compliance.test.js`).
4. No declares «cumple» sin evidencia verificable en el código o en los datos.
   Lo que depende de documentos, firmas o procedimientos del laboratorio se
   marca como evidencia del laboratorio, nunca como cumplido por el software.

## 7.5 Registros técnicos

**7.5.1 Contenido.** Cada registro técnico (calibración, verificación
intermedia, resultado) debe:

- Contener el resultado y la información suficiente para entender los factores
  que influyen en él y su incertidumbre, y para repetir la actividad en
  condiciones lo más parecidas posible.
- Indicar la fecha y la identidad de quien realizó cada actividad y de quien
  revisó los datos y resultados.
- Registrar las observaciones, datos y cálculos originales en el momento en que
  se producen, ligados a la tarea concreta.

**7.5.2 Modificaciones.** Cualquier cambio a un registro técnico debe poder
rastrearse hasta la versión anterior o la observación original. Se conservan
el dato original y el modificado, con la fecha del cambio, qué se cambió y
quién lo hizo.

## 7.8 Informe de resultados (certificados de calibración)

Aplica a todo certificado que DataMET+ genere o emita. En calibración de
balanzas, el contenido técnico lo detallan EURAMET cg-18 §8 y la Guía SIM §8
(skills `euramet-cg-18` y `guia-sim-ipfna`); si difieren, manda esta norma.
Los informes de ensayo (7.8.3) y de muestreo (7.8.5) no aplican a la
calibración salvo casos especiales.

**7.8.1 General.**

- **7.8.1.1** Los resultados se revisan y se autorizan antes de entregarlos.
- **7.8.1.2** Se informan de forma exacta, clara, inequívoca y objetiva,
  normalmente en un certificado, con todo lo acordado con el cliente, lo
  necesario para interpretarlos y lo que exige el método. **Todo certificado
  emitido se conserva como registro técnico.** Puede emitirse en papel o en
  forma electrónica si se cumplen los requisitos.
- **7.8.1.3** Con acuerdo del cliente se puede informar de forma simplificada;
  lo de 7.8.2 a 7.8.7 que no se entregue debe estar fácilmente disponible.

**7.8.2.1 Contenido mínimo de todo informe** (salvo una razón válida para
omitir algo, siempre buscando evitar malentendidos o mal uso):

- a) título, p. ej. «Certificado de calibración»;
- b) nombre y dirección del laboratorio;
- c) lugar donde se hizo la actividad, indicando si fue en instalaciones del
  cliente, fuera de las instalaciones permanentes o en instalaciones temporales
  o móviles;
- d) identificación única que permita reconocer cada parte como parte del
  certificado completo, y una marca clara del final;
- e) nombre y datos de contacto del cliente;
- f) identificación del método usado;
- g) descripción, identificación inequívoca y, si hace falta, estado del ítem;
- h) fecha de recepción del ítem (y de muestreo) cuando sea crítica para la
  validez o la aplicación de los resultados;
- i) fecha(s) en que se realizó la actividad;
- j) fecha de emisión;
- k) plan y método de muestreo, cuando sean relevantes;
- l) declaración de que los resultados se refieren solo a los ítems calibrados;
- m) resultados con sus unidades;
- n) ampliaciones, desviaciones o exclusiones del método;
- o) identificación de quién(es) autoriza(n) el certificado;
- p) identificación clara de los resultados que provienen de proveedores
  externos.

Nota de la norma: la leyenda «no reproducir salvo completo sin aprobación del
laboratorio» evita que partes del certificado se usen fuera de contexto.

**7.8.2.2** El laboratorio responde por todo lo informado, salvo la información
del cliente, que se identifica claramente; si esa información puede afectar la
validez de los resultados, el certificado lleva una advertencia (descargo). Si
el laboratorio no tomó la muestra, se aclara que los resultados aplican al ítem
tal como se recibió.

**7.8.4 Requisitos propios de los certificados de calibración.**

- **7.8.4.1** Además de 7.8.2, incluyen:
  - a) la **incertidumbre de medición** del resultado, en la misma unidad del
    mensurando o en términos relativos (p. ej. %);
  - b) las **condiciones** (p. ej. ambientales) de la calibración que influyen en
    los resultados;
  - c) una declaración de **cómo los resultados son metrológicamente
    trazables** (Anexo A);
  - d) los resultados **antes y después de cualquier ajuste o reparación**, si
    se tienen;
  - e) si corresponde, la declaración de conformidad (7.8.6);
  - f) si corresponde, opiniones e interpretaciones (7.8.7).
- **7.8.4.2** Si el laboratorio hizo el muestreo, la información de 7.8.5.
- **7.8.4.3** El certificado o la etiqueta de calibración **no recomiendan un
  intervalo de calibración** (ni una «próxima calibración»), salvo que se haya
  acordado con el cliente.

**7.8.6 Declaraciones de conformidad.**

- **7.1.3** (revisión de solicitudes): si el cliente pide conformidad con una
  especificación o norma, se definen claramente la especificación y la **regla
  de decisión**; si la regla no viene implícita en la especificación, se
  comunica al cliente y se acuerda con él.
- **7.8.6.1** La regla de decisión se documenta, considerando el riesgo
  asociado (falsa aceptación, falso rechazo, supuestos estadísticos), y se
  aplica. Si la impone el cliente, una reglamentación o un documento normativo,
  no hace falta evaluar más el riesgo.
- **7.8.6.2** La declaración identifica a qué resultados se aplica, qué
  especificaciones (o partes) se cumplen o no, y la regla aplicada (salvo que
  sea inherente a la especificación). Más información: ISO/IEC Guide 98-4.
- En balanzas, EURAMET 7.5.3 da una regla con banda de guarda: conforme si
  |E(R)| + U(W(R)) ≤ Tol(R).

**7.8.7 Opiniones e interpretaciones.** Solo las emite personal autorizado para
ello, con su base documentada; se basan en los resultados del ítem calibrado y
se identifican claramente como tales; si se comunican conversando con el
cliente, se guarda registro del diálogo. No son declaraciones de conformidad.

**7.8.8 Modificaciones de certificados emitidos.**

- **7.8.8.1** Todo cambio de información se identifica claramente y, si
  corresponde, se incluye el motivo en el certificado.
- **7.8.8.2** Después de emitido, se modifica solo mediante un documento (o
  transferencia de datos) adicional con una leyenda del tipo «Enmienda al
  certificado N.º …», que cumpla todos los requisitos de la norma.
- **7.8.8.3** Si hace falta un certificado nuevo completo, lleva identificación
  única y una referencia al que reemplaza.

**Puntos relacionados con la emisión** que suelen auditarse junto con 7.8:

- **6.5 y Anexo A (trazabilidad):** los resultados se vinculan al SI mediante
  una cadena ininterrumpida de calibraciones, cada una con su incertidumbre; se
  demuestra con certificados de institutos nacionales de metrología o de
  laboratorios acreditados. Un patrón con la calibración vencida el día de la
  medición rompe la trazabilidad declarada.
- **7.6 (incertidumbre):** se identifican y evalúan todas las contribuciones
  significativas; un laboratorio de calibración evalúa la incertidumbre de todas
  sus calibraciones (skill `gum-iso-iec-guide-98-3`).
- **7.2 (métodos):** el certificado identifica el método; el cálculo programado
  debe ser el del procedimiento documentado y validado.
- El uso del símbolo de acreditación en el certificado sigue las reglas de la
  DTA-IBMETRO (no cubiertas aquí; si el usuario las aporta, agrégalas).

## 7.11 Control de los datos y gestión de la información

- **7.11.1** El personal tiene acceso a los datos e información que necesita
  para sus actividades.
- **7.11.2** El sistema que recoge, procesa, registra, informa, almacena o
  recupera datos se **valida** en su funcionalidad (incluidas sus interfaces)
  antes de usarse. Todo cambio, incluida la configuración, se **autoriza,
  documenta y valida** antes de implementarse. (El software comercial de uso
  general, usado dentro de su alcance, puede considerarse validado; un
  desarrollo propio no.)
- **7.11.3** El sistema debe:
  - a) estar protegido contra el acceso no autorizado;
  - b) estar resguardado contra la manipulación y la pérdida;
  - c) operar en un entorno que cumpla las especificaciones del proveedor o del
    laboratorio;
  - d) mantenerse de forma que asegure la integridad de los datos;
  - e) incluir el registro de las fallas del sistema y de las acciones
    inmediatas y correctivas.
- **7.11.4** Si el sistema lo gestiona o mantiene un proveedor externo (fuera
  del laboratorio), el laboratorio se asegura de que cumpla estos requisitos
  (relacionado con 6.6, productos y servicios suministrados externamente).
- **7.11.5** Las instrucciones, manuales y datos de referencia del sistema
  están disponibles para el personal.
- **7.11.6** Los cálculos y las transferencias de datos se verifican de forma
  apropiada y sistemática.

## 8.4 Control de registros

- **8.4.1** Se establecen y conservan registros legibles que demuestran el
  cumplimiento de la norma.
- **8.4.2** Se implementan los controles para la identificación,
  almacenamiento, protección, respaldo, archivo, recuperación, tiempo de
  conservación y disposición de los registros. Se conservan por un periodo
  coherente con las obligaciones contractuales; el acceso respeta los
  compromisos de confidencialidad y los registros están fácilmente disponibles.

Puntos relacionados que suelen auditarse junto con estos: **6.4.13** (registros
de equipos: identificación, calibraciones, certificados, próxima fecha,
verificaciones), **6.6** (proveedores externos), **8.3** (control de
documentos, p. ej. manuales) y **8.7** (acciones correctivas).

## Controles que el software debe implementar

| Requisito | Control en el software |
|---|---|
| 7.5.1 contenido | Campos obligatorios validados en el backend; referencia al documento o archivo original (certificado, hoja de verificación) cuando el dato completo no vive en el sistema. |
| 7.5.1 quién y cuándo | Autor tomado del token de sesión, nunca de un campo editable. Fecha y hora puestas por el servidor (`SYSUTCDATETIME()`). Si hay revisión de datos, guardar quién revisó y cuándo. |
| 7.5.1 en el momento | Guardar la fecha de registro aparte de la fecha del hecho; la fecha de registro no se edita. |
| 7.5.2 modificaciones | Nada se sobrescribe sin dejar rastro: tabla de historial con valor anterior → nuevo, autor y fecha. Nada se borra físicamente: se anula con motivo. Una corrección conserva la versión anterior completa. |
| 7.11.2 validación y cambios | Pruebas automáticas de cálculos y reglas; migraciones versionadas y registradas en `SCHEMA_MIGRATIONS`; commits separados y descritos. El laboratorio aprueba un informe de validación antes de cada puesta en producción. |
| 7.11.3 a acceso | Contraseñas con hash (bcrypt ya es dependencia del backend; DATA_USERS la comparte con el DataMET de escritorio), sesiones con vencimiento, permisos por rol verificados en el backend, bloqueo de intentos persistente, HTTPS, `NODE_ENV=production` (sin trazas de error al cliente). |
| 7.11.3 b manipulación y pérdida | Transacciones; sin borrados físicos de registros; respaldos programados y restauraciones probadas. |
| 7.11.3 d integridad | Validación (zod) y restricciones en la base (PK, CHECK, UNIQUE); bloqueos para evitar duplicados; valores calculados por el sistema en vez de digitados. |
| 7.11.3 e fallas | Registrar los errores del servidor y los envíos fallidos en tablas, con la acción inmediata y la correctiva. |
| 7.11.5 manuales | Ayuda en cada ficha e instructivo de uso accesible desde la aplicación, controlado como documento. |
| 7.11.6 cálculos | Pruebas automáticas de cada cálculo; doble verificación de los datos transcritos a mano; comprobaciones de consistencia sobre los datos guardados. |
| 8.4.2 registros | Identificador único, búsqueda y recuperación desde la interfaz, historial por registro, sin disposición sin control, respaldos verificables, exportación para auditorías. |
| 7.8.1.1 revisión y autorización | Estados borrador → revisado → emitido; solo un usuario con permiso de autorizar emite; quién y cuándo puestos por el servidor. Un borrador se imprime marcado como tal, nunca como certificado válido. |
| 7.8.1.2 conservación | Guardar el certificado tal como se entregó (PDF o copia completa de sus datos) como registro técnico; reimprimirlo idéntico desde el historial. |
| 7.8.2.1 contenido | Plantilla con los campos a)–p) validados en el backend antes de emitir; número único; «Página x de y» y marca de fin en cada hoja; método y desviaciones identificados. |
| 7.8.2.2 datos del cliente | Marcar en el modelo qué datos dio el cliente; leyenda de descargo automática cuando pueden afectar la validez. |
| 7.8.4.1 a–d | U y k junto a cada resultado; condiciones ambientales medidas; trazabilidad armada con los patrones usados y **bloqueo si alguno tenía la calibración vencida** el día de la medición; resultados antes y después del ajuste si los hay. |
| 7.8.4.3 intervalo | No imprimir «próxima calibración» salvo que el acuerdo con el cliente esté registrado. |
| 7.8.6 conformidad | Solo si se pidió; guardar la especificación y la regla de decisión acordadas; calcularla con la regla y mostrar a qué resultados aplica. |
| 7.8.8 modificaciones | Certificado emitido inmutable; enmienda o reemisión con identificación única, motivo y referencia al que reemplaza; todas las versiones conservadas. |

## Cómo evaluar

Usa estos estados (son los de la pestaña Cumplimiento):

- **Cumple:** el software lo resuelve y hay evidencia en el código o en los
  datos actuales.
- **Parcial:** lo resuelve en parte; hay brechas concretas que corregir.
- **No cumple:** falta el control o los datos actuales lo contradicen.
- **Del laboratorio:** la parte del software está, pero el cumplimiento depende
  de evidencia del laboratorio (informe de validación aprobado, contrato con un
  proveedor, condiciones del servidor, procedimiento de retención, pruebas de
  restauración).

Cada evaluación nombra su evidencia, las brechas, la acción recomendada y su
prioridad (alta: lo pediría un auditor o expone registros; media: debilita el
control; baja: mejora). Prefiere evaluar con datos en vivo (consultas de solo
lectura) y deja claro qué se evaluó «por diseño».

## Estado conocido de DataMET+ (octubre–noviembre 2026)

Revisa la pestaña Cumplimiento para el estado actual. Resumen de lo hecho:

- **7.5 (migración 006):** cada versión de una fecha del plan, de la
  configuración y de los certificados queda en su historial con antes, después,
  quién, cuándo y motivo; cambiar lo ya realizado o corregir un certificado
  exige motivo; las verificaciones exigen resultado y hoja de datos; un segundo
  usuario revisa certificados y verificaciones (`calibration.history.js`).
- **7.11.2 (migración 007):** Control de cambios (`APP_CAMBIOS`), al pie de
  la barra lateral para el nivel 3 y el jefe de área de Calibración. Cada
  versión nueva registra sus cambios; Sistemas los valida y el jefe de área de
  Calibración los aprueba (nunca quien validó) antes de desplegarse; la versión
  en uso sale de `package.json`. Al terminar un cambio, regístralo ahí (o en la
  siembra de la migración que lo acompañe).
- **7.11.2 ServiceMET (migración 014):** Calibración › Versiones ServiceMET
  (`CAL_SERVICEMET_VERSIONES`). Cada versión de la app de los técnicos la
  registra y valida Sistemas, y la aprueba solo el jefe de área de
  Calibración antes de usarse; muestra qué versión usa cada teléfono según
  `form_rim` y `rim_talonarios`. Al liberar una versión de ServiceMET,
  regístrala ahí.
- **7.11.3 e (migración 007):** Registro de fallas (`APP_FALLAS`): los errores
  5xx, de tareas y del proceso se guardan solos (`system.failures.js`); nunca
  guardes el cuerpo de la petición.

- **7.11.6 patrones (migración 016):** en la ficha de cada juego de pesas o
  termohigrómetro, «Piezas y valores» guarda las piezas y los valores de su
  certificado vigente (`calibration.patrones.js`). Los verifica otra persona
  con la revisión de `CAL_CERTIFICADOS` (no quien hizo el último cambio:
  registrar, corregir o transcribir; quien lo completó antes, sí, a pedido del
  laboratorio en noviembre de 2026); transcribir de nuevo exige motivo y deja la verificación
  pendiente. La pestaña Cumplimiento cuenta los patrones sin verificar. Un
  cálculo de calibración no debe usar valores sin verificar.
- **7.8 (noviembre 2026):** DataMET+ todavía **no emite certificados de
  calibración** (el proyecto empezó el 5 de noviembre de 2026) y la pestaña
  Cumplimiento no incluye el 7.8. Cuando la emisión exista, agregar sus
  requisitos al catálogo y a sus pruebas. Patrón ya probado para 7.8.8: las
  revisiones de los informes de Soporte técnico (`soporte.revisiones.js`,
  migración 010): un informe emitido no se edita; se abre una revisión con
  motivo, se reemite como Rev. N con copia completa en
  `ST_INFORMES_REVISIONES` y el pie dice a qué revisión reemplaza.

Brechas que siguen abiertas:

- **Contraseñas en texto plano** (`auth.service.js` compara `DATA_USERS.pass`
  directamente). No se toca sin coordinar con el Jefe de Sistemas: varios
  sistemas leen esa columna. La norma pide proteger el acceso; guardarlas con
  hash es la forma esperada de cumplirlo.
- Instructivo de uso dentro de la aplicación (7.11.5), auditoría de cambios
  directos en la base (7.11.3 b), `NODE_ENV=production` y HTTPS en el
  servidor, y `DATA_EQUIPOS_CAL` sin clave primaria con `cert_fechaven`
  heredados que no coinciden.
- Del laboratorio: informe de validación de cada versión, acuerdos con
  proveedores (6.6), especificaciones del servidor, pruebas de restauración de
  respaldos y tiempo de conservación de los registros.
