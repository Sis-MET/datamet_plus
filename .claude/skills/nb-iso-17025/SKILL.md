---
name: nb-iso-17025
description: Requisitos de la NB/ISO/IEC 17025:2018 (puntos 7.5 Registros técnicos, 7.11 Control de los datos y gestión de la información, y 8.4 Control de registros) que debe cumplir todo software de Métrica Ltda., laboratorio acreditado por DTA-IBMETRO. Úsala al diseñar, modificar o revisar cualquier funcionalidad que registre, calcule, guarde, muestre o borre datos técnicos o registros del laboratorio (equipos, certificados, calibraciones, verificaciones, resultados, usuarios y permisos, respaldos), al evaluar el cumplimiento normativo del sistema y al mantener la pestaña «Cumplimiento» del módulo Calibración.
---

# NB/ISO/IEC 17025:2018 en el software del laboratorio

Métrica Ltda. es un laboratorio de calibración acreditado por la **DTA-IBMETRO**
(Dirección Técnica de Acreditación del Instituto Boliviano de Metrología) con
la **NB/ISO/IEC 17025:2018** (IBNORCA), adopción boliviana idéntica de la
ISO/IEC 17025:2017. Todo software que se use en la operación del laboratorio
forma parte de su sistema de gestión de la información y se audita con los
puntos **7.5**, **7.11** y **8.4**.

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
| 7.11.3 a acceso | Contraseñas con hash (bcrypt, ya disponible en `backend/src/utils/hash.utils.js`), sesiones con vencimiento, permisos por rol verificados en el backend, bloqueo de intentos persistente, HTTPS, `NODE_ENV=production` (sin trazas de error al cliente). |
| 7.11.3 b manipulación y pérdida | Transacciones; sin borrados físicos de registros; respaldos programados y restauraciones probadas. |
| 7.11.3 d integridad | Validación (zod) y restricciones en la base (PK, CHECK, UNIQUE); bloqueos para evitar duplicados; valores calculados por el sistema en vez de digitados. |
| 7.11.3 e fallas | Registrar los errores del servidor y los envíos fallidos en tablas, con la acción inmediata y la correctiva. |
| 7.11.5 manuales | Ayuda en cada ficha e instructivo de uso accesible desde la aplicación, controlado como documento. |
| 7.11.6 cálculos | Pruebas automáticas de cada cálculo; doble verificación de los datos transcritos a mano; comprobaciones de consistencia sobre los datos guardados. |
| 8.4.2 registros | Identificador único, búsqueda y recuperación desde la interfaz, historial por registro, sin disposición sin control, respaldos verificables, exportación para auditorías. |

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

## Estado conocido de RimMET (octubre 2026)

Revisa la pestaña Cumplimiento para el estado actual. Resumen de lo hecho:

- **7.5 (migración 006):** cada versión de una fecha del plan, de la
  configuración y de los certificados queda en su historial con antes, después,
  quién, cuándo y motivo; cambiar lo ya realizado o corregir un certificado
  exige motivo; las verificaciones exigen resultado y hoja de datos; un segundo
  usuario revisa certificados y verificaciones (`calibration.history.js`).
- **7.11.2 (migración 007):** Control de cambios (`APP_CAMBIOS`), al pie de
  la barra lateral para el nivel 3. Cada versión nueva registra sus cambios,
  los valida y los aprueba antes de desplegarse; la versión en uso sale de
  `package.json`. Al terminar un cambio, regístralo ahí (o en la siembra de
  la migración que lo acompañe).
- **7.11.3 e (migración 007):** Registro de fallas (`APP_FALLAS`): los errores
  5xx, de tareas y del proceso se guardan solos (`system.failures.js`); nunca
  guardes el cuerpo de la petición.

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
