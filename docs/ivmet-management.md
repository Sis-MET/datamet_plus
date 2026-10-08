# Gestión IvMET en RimMET

RimMET administra la contratación, las cuentas y la configuración de IvMET.
Supabase es la fuente de la operación; DataMET conserva los catálogos maestros.
El módulo no modifica DataMET, no ejecuta el worker y no expone evidencia privada.

## Puesta en marcha

1. En el repositorio **IvMET**, aplicar las migraciones nuevas después de las
   ocho existentes. No volver a ejecutar los scripts iniciales ni usar `db reset`
   contra una base con información.

   ```powershell
   Set-Location C:\Users\jhona\IvMET
   pnpm install
   pnpm db:test:admin
   pnpm dlx supabase db push --linked --dry-run
   pnpm dlx supabase db push --linked
   pnpm dlx supabase db lint --linked --level warning
   ```

   Migraciones esperadas: `202608270001_admin_read.sql` y
   `202608270002_admin_actions.sql`. Si aparece un `403` al inicializar el login
   de la CLI, ejecutar `pnpm dlx supabase login` con la cuenta que tenga permisos
   sobre el proyecto vinculado. No registrar migraciones como aplicadas con
   `migration repair` si no se ejecutaron realmente.

2. En `RimMET/backend/.env`, conservar la configuración de RimMET y añadir:

   ```dotenv
   IVMET_ENABLED=true
   IVMET_DATAMET_DATABASE=DataMET
   ```

   Deben existir `SUPABASE_URL` y **una** clave administrativa:
   `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`. Solo en el backend;
   nunca en variables `VITE_*`, repositorios, capturas o logs. El login SQL del
   backend necesita SELECT sobre los cuatro catálogos de DataMET. El módulo no
   concede permisos SQL ni necesita escritura en esa base.

   El login de RimMET sigue validándose en su `DB_DATABASE` habitual (incluida
   `DataMET_prueba` durante desarrollo). El catálogo IvMET usa una conexión
   separada a `IVMET_DATAMET_DATABASE`; no se confunden las dos bases.

3. Instalar y reiniciar el backend y el frontend de desarrollo:

   ```powershell
   Set-Location C:\Users\jhona\RimMET
   pnpm install
   pnpm --dir backend install
   pnpm --dir backend dev
   ```

   En otra terminal, desde RimMET: `pnpm dev`. En producción, compilar con
   `pnpm build`, desplegar el código/backend de RimMET y reiniciar **su** proceso
   habitual; no reiniciar `servicemet-api`. Usar HTTPS en el acceso real, porque
   los formularios de cuentas envían contraseñas temporales al backend.

4. Entrar con un usuario RimMET de nivel `acceso_cron = 3`. Ese permiso se
   comprueba en SQL en cada solicitud; un JWT antiguo no conserva un permiso
   revocado. Abrir **Gestión IvMET** y desbloquearlo con el código autorizado.
   La barrera temporal de desarrollo, su configuración y el despliegue completo
   se describen en [Acceso de pruebas](ivmet-development-access.md).

No hay migraciones nuevas para SQL Server en esta entrega: se reutilizan las
tablas públicas existentes de Supabase y el contrato del espejo `IvMET`.
Las operaciones administrativas generan outbox; la entrega al espejo requiere
que el worker corporativo ejecute sus ciclos con la configuración autorizada.

## Recorrido de operación

### Incorporar y ampliar un cliente

- **Clientes → Incorporar cliente**: buscar en DataMET, elegir plantas y
  balanzas específicas, registrar la referencia contractual/de pago y confirmar
  que se verificó el pago. No importa todo DataMET ni consulta tablas de clientes
  sin filtrar para llenar la interfaz.
- La solicitud queda en **Sincronización**. El cliente aparece en el directorio
  después de que el worker importe su catálogo. La confirmación de pago en este
  paso es una autorización humana de incorporación, no crea un recibo contable.
- **Sincronización → Ampliar alcance** permite añadir plantas/equipos a un
  cliente existente. Es aditivo: conserva el alcance anterior y exige una
  versión actual y una nueva justificación. Para retirar disponibilidad en la
  app se deshabilita la balanza o se suspende la suscripción; no se borra su
  historial ni se manipula `DATA_EQUIPOS.estado`.
- Para el piloto EMBOL `0032` / `0032-11`, ya incorporado, abrir su ficha;
  **no crear otra solicitud inicial**.

### Plan, contrato y pagos

1. **Planes y tarifas**: crear un plan (por ejemplo, cinco cuentas), días de
   gracia y tarifas mensuales/anuales. Un nuevo precio cierra la vigencia del
   anterior el día previo, sin reescribir facturas. Editar cuentas incluidas no
   cambia los cupos base de contratos ya creados.
2. **Cliente → Contrato y pagos → Registrar contrato**: registrar el contrato
   firmado, su número, fechas, tarifa y número del documento de control. La
   vigencia debe cubrir al menos el primer período. Solo hay un contrato abierto
   por cliente. El período comienza a las 00:00 UTC de la fecha indicada.
3. El alta crea suscripción y cupos pendientes. Registrar pagos recibidos con
   fecha, método y referencia. Un pago parcial reduce el saldo, pero **no**
   habilita cupos; el pago completo habilita el período. Un plan de cortesía con
   precio cero se activa sin inventar un pago y también admite renovación.
4. **Renovar período** crea el documento siguiente. El pago completo amplía la
   vigencia sin cortar el período actual. Ampliar primero el contrato si su fecha
   final no cubre la renovación. Si se conservan cuentas adicionales, incluirlas
   y registrar su importe en la renovación.
5. **Agregar cupos** crea adicionales pendientes hasta el pago completo. Vencen
   con el período contratado. Solo se revocan cupos si no dejan asignaciones sin
   capacidad. Al vencer adicionales se comprueba el cupo en cada acceso: tienen
   prioridad las asignaciones más antiguas; las restantes quedan sin acceso
   efectivo hasta regularizar cupos o revocar/reasignar licencias. El historial
   de asignación no se elimina.
6. **Cambiar estado** permite suspender, reactivar un período pagado, conceder
   la gracia configurada tras el vencimiento o cancelar definitivamente.
   Pagar una suscripción suspendida no la reactiva automáticamente. Un alta
   impagada solo se puede cancelar, no eludir el pago cambiándola a suspendida.
7. Anular un documento sin pagos conserva su historial y revoca cupos
   pendientes. Si era la factura inicial, cancela también el alta impagada para
   poder registrar un contrato corregido. Cancelar una suscripción revoca sus
   licencias/cupos y anula documentos sin pagos; no borra pagos anteriores.

**No hay pasarela de cobro, débito automático, reembolsos ni emisión tributaria.**
Las facturas de este módulo son documentos internos de control. El sistema no
convierte una referencia escrita en prueba bancaria de pago. Reversiones de
pagos confirmados requieren un flujo contable posterior; no se editan ni borran
desde estos formularios.

### Usuarios y licencias

- Crear una cuenta por persona, con alias, nombre, rol (operador/jefe de calidad),
  plantas activas del cliente y contraseña temporal de al menos 12 caracteres.
- La cuenta Auth se crea con email interno, sin correo de recuperación. La app
  inicia sesión por alias mediante `ivmet-login`. Es obligatorio cambiar la
  contraseña con `ivmet-change-password` antes de acceder a la operación.
- Asignar una licencia de una suscripción vigente con cupos libres. Crear la
  cuenta no consume automáticamente un cupo. La tabla distingue asignación de
  licencia y acceso efectivo (vigencia, cupo y cambio de contraseña).
- Editar nombre, rol y plantas; desactivar con motivo; revocar/reasignar licencia;
  restablecer contraseña con motivo. No se muestran contraseñas anteriores.
  Entregar la temporal al cliente por un canal seguro.
- Si Auth no confirma una respuesta, **reintentar el mismo formulario sin
  cerrarlo**. Conserva el UUID de solicitud y recupera la cuenta reservada sin
  crear otra. No se eliminan usuarios como compensación ante una respuesta
  incierta. Si se cerró el formulario durante una falla, un administrador deberá
  revisar la reserva privada antes de repetir el alta.
- Para un incidente de acceso, desactivar primero la cuenta/revocar licencia.
  El restablecimiento de contraseña no se anuncia como cierre global inmediato
  de todas las sesiones de Supabase.

### Balanzas, áreas y patrones

- Abrir **Cliente → Balanzas**. Filtrar por planta, código/marca/serie y estado.
  La ficha muestra rangos y decimales exactos, sin permitir editar DataMET.
- En **Áreas y patrones**, definir áreas por planta, patrones del cliente y sus
  plantas autorizadas, registrar certificados y anularlos con motivo. La
  caducidad se muestra según fechas, conservando certificados anteriores.
- En la ficha de la balanza, asignar área, versión publicada del plan y
  habilitación. Solo un catálogo `READY` permite habilitar. Datos inválidos
  (como intervalo `e` ausente) se corrigen en DataMET y se vuelven a sincronizar.
- Este módulo **no publica procedimientos metrológicos ni implementa sus
  fórmulas**. La configuración acepta versiones ya publicadas. El editor de
  procedimientos, el motor validado y la aceptación de verificaciones siguen
  sujetos al procedimiento oficial y casos aprobados por el metrólogo. No hay
  un plan demo que permita eludir ese requisito.

## Contrato HTTP y seguridad

Todas las rutas requieren JWT de RimMET, nivel 3 vigente y `IVMET_ENABLED=true`.
Respuesta: `{ success: true, data }`; error: `{ success: false, message, code }`.
Errores de validación añaden `issues: [{path,message}]`, sin valores sensibles.

| Ruta relativa a `/api/ivmet` | Propósito |
| --- | --- |
| `GET /overview` | Indicadores administrativos, no veredictos privados |
| `GET /clients?search=&page=&pageSize=` | Directorio paginado |
| `GET /plans` | Planes comerciales, tarifas históricas y condiciones (`terms`) |
| `GET /upgrade-requests?state=OPEN&search=&page=` | Solicitudes de plan superior enviadas desde la app |
| `GET /clients/:clientId` | Plantas y configuración comercial del cliente |
| `GET /clients/:clientId/equipment` | Balanzas, `plantId`, `status`, `search`, paginación |
| `GET /clients/:clientId/users` | Usuarios/licencias del cliente, búsqueda y paginación |
| `GET /clients/:clientId/activity` | Metadatos de auditoría administrativa paginados |
| `GET /integration` | Alcances, últimos ciclos y conteos del outbox |
| `GET /legacy/clients?search=` | Búsqueda parametrizada de DataMET, máximo 30 |
| `GET /legacy/clients/:clientId/catalog` | Plantas/balanzas del ID legado seleccionado |
| `POST /actions/:action` | Operación administrativa validada |

Las consultas paginadas usan 20 por defecto y máximo 100. El cuerpo de POST es
`{requestId: UUID, payload: {...}}`. Se mantiene el mismo UUID en reintentos de
una operación incierta. El mismo UUID con contenido distinto genera conflicto.
Las ediciones incluyen `version` como cadena; un registro cambiado se rechaza,
no se sobrescribe silenciosamente. Importes y magnitudes se envían como cadenas
decimales, nunca números binarios de JavaScript.

Acciones públicas: `plan.save`, `price.create`, `contract.create`,
`contract.extend`, `subscription.renew`, `subscription.state`, `seats.purchase`,
`seat.revoke`, `payment.record`, `invoice.void`, `user.create`, `user.update`,
`user.reset`, `license.assign`, `license.revoke`, `area.save`, `pattern.save`,
`certificate.create`, `certificate.annul`, `equipment.configure`, `scope.request`
y `scope.extend`, además de `scope.retry` (id y motivo),
`subscription.change-plan` (`clientId`, `id`, `version`, `planId`, `endsOn?`,
`priceId?`, `reason`) y `upgrade.attend` (`id`, `version`, `state`
`CONTACTED|CLOSED`, `result` `UPGRADED|DECLINED`, `note`). `plan.save` acepta
`terms` (`limits`, `features`, `catalog`); sin `terms` conserva los anteriores. Los campos exactos están en
`backend/src/services/ivmet.validation.js`. Las operaciones internas de reserva
Auth no tienen ruta pública.

Las RPC de Supabase solo se conceden a `service_role`. El actor se deriva del
JWT de RimMET, no del cuerpo. Cada mutación se valida/transacciona en PostgreSQL
y audita. Las contraseñas van exclusivamente a Auth; un HMAC privado detecta
reintentos distintos. No se registran cuerpos con contraseñas ni se devuelven
errores internos sin filtrar. La auditoría visible no muestra snapshots de
verificaciones ni alertas no compartidas.

## Pruebas y reversión

### Incorporación automática y seguimiento

Aplicar primero `202608270004_onboarding_queue.sql` desde el repositorio IvMET y
desplegar su worker actualizado. Seguir `IvMET/docs/onboarding-production.md`
para el proceso permanente y el arranque del servidor; RimMET no arranca procesos.

- El directorio incluye solicitudes aunque todavía no tengan un UUID en el
  catálogo público; muestran **Ver incorporación** en vez de abrir una ficha vacía.
- El diálogo muestra alcance, disponibilidad real del worker, fechas, último
  resultado e incidencias sin exponer mensajes SQL ni secretos. Conserva scroll,
  foco y animaciones breves como los demás diálogos.
- **Reintentar ahora** requiere motivo, se audita y solo vuelve a encolar el
  alcance existente. No borra evidencia ni salta reglas comerciales.
- Al seleccionar un cliente ya solicitado se ofrece **Ver incorporación
  existente**. La API mantiene la unicidad y la idempotencia ante carreras.
- Las consultas se actualizan sin parpadeos; el sondeo se pausa al ocultar la vista.
- El estado de servicio proviene de un heartbeat de daemon, no de que Supabase
  responda o de ejecutar `worker:health` una vez.

Nuevo endpoint administrativo: `GET /api/ivmet/onboarding`, paginado y con
filtros opcionales `scopeId`, `legacyClientId` y `search`. Usa la misma validación
de nivel 3 que el resto del gestor; no es un endpoint de la app móvil.

El fixture admite `?onboarding=PARTIAL` y `?workerOffline=1` para revisar
incidencias y servicio detenido. Todas sus operaciones permanecen en memoria.

Los modales comparten `usePageScrollLock` con Cronograma y Salidas. Bloquea el
documento, conserva el ancho y restaura posición/estilos al cerrar el último
modal. IvMET mantiene el bloqueo durante su animación de salida; el contenido
interior sigue desplazándose. Cualquier modal nuevo debe usar este mismo hook,
sin asignar `document.body.style.overflow` de forma independiente.

### Ajustes de usabilidad del 27/08

- Incorporación/ampliación: lista de balanzas agrupada por planta; casilla global
  y por planta con estado parcial. Desmarcar conserva las incorporaciones previas.
- Filtros y formularios usan desplegables azules/neutros como el Cronograma,
  con flechas, Inicio/Fin, búsqueda por escritura, Enter, Escape y Tab.
  Los menús se mantienen encima de los diálogos sin quedar recortados.
- Foco único y redondeado; fondos sólidos para datos y vidrio solo en navegación.
  Entradas de 120–140 ms y salidas de 100 ms, respetando movimiento reducido.
- `plan.save` ya no recibe `code`. Supabase genera `PLAN-000001`, etc., mediante
  secuencia atómica. Códigos existentes e identidad UUID se conservan. Puede haber
  saltos de numeración; no es un correlativo fiscal. Las tarifas conservan su UUID.

Antes de desplegar esta versión del backend/panel, aplicar en IvMET la migración
aditiva `202608270003_generated_plan_codes.sql`. Las migraciones 001/002 ya
aplicadas no se modifican. No requiere cambios SQL Server ni nuevos secretos.

La salida de los menús usa transiciones de la capa superior nativa, siguiendo
[la documentación de Popover](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using).
En navegadores sin Popover se conserva el selector HTML con validación nativa.

Validación local de este ajuste: 40 pruebas de frontend, 15 del backend,
16 de PostgreSQL aislado y 10 del worker aprobadas; lint y build correctos.
Recorrido visual con datos ficticios en escritorio y a 390 px: selección global,
parcial, por planta y plantas vacías; conservación de incorporaciones previas;
foco del buscador; código de plan; desplegables dentro de modal, validación de
campos obligatorios, teclado y cierre con Escape. Sin errores de consola ni
operaciones sobre clientes reales. El build conserva los avisos preexistentes
de Browserslist y tamaño del módulo PDF.

```powershell
Set-Location C:\Users\jhona\RimMET
pnpm lint
pnpm test
pnpm --dir backend test
pnpm build
Set-Location C:\Users\jhona\IvMET
pnpm db:test:admin
pnpm worker:test
pnpm worker:build
```

`db:test:admin` carga todas las migraciones en PostgreSQL embebido PGlite aislado.
Prueba reglas SQL y transacciones con datos ficticios; no requiere Docker ni
claves. No sustituye la validación final en el proyecto Supabase de pruebas y
su espejo SQL Server. Auth está simulado en pruebas unitarias; no se crean
usuarios, pagos ni contratos reales durante la prueba de interfaz.

Fixture visual exclusivamente local (no incluido en el build): levantar Vite
y abrir `/e2e/fixtures/ivmet-preview.html`; `?error=1` muestra el error controlado.
Intercepta las solicitudes en memoria y muestra un aviso de datos ficticios.
La app normal **nunca** hace fallback a esos datos.

Rollback: `IVMET_ENABLED=false` y reiniciar el backend RimMET, o restaurar el
código de la versión anterior. Conservar las migraciones, auditoría y evidencia.
No hay borrado de tablas ni rollback destructivo.

## Planes, empresas autoregistradas y solicitudes

Desde el 08/10/2026 cualquier empresa crea su cuenta desde la app IvMET y queda
en el plan de **autoregistro** (Gratuito). El detalle funcional y el despliegue
están en `IvMET/docs/self-service-plans.md`.

- **Planes y tarifas**: además de cuentas y gracia, cada plan define sus
  límites (plantas, balanzas habilitadas, verificaciones por mes y pesas patrón;
  vacío es sin límite), si incluye el informe completo y la periodicidad a
  medida, si se ofrece en la app con su orden y resumen, y cuál es el plan de
  autoregistro (uno solo activo). Los límites rigen al instante para todas las
  empresas del plan.
- **Solicitudes de plan**: bandeja con las que llegan desde la app. **Atender**
  la marca como contactada o la cierra con su resultado y una nota interna.
- **Ficha › Contrato y pagos › Plan y uso**: uso contra cada límite y **Cambiar
  plan**, que no corta el acceso y cierra las solicitudes abiertas. Al salir del
  Gratuito, que no vence, pide el fin del período para poder renovar y cobrar
  después con facturas y pagos. El Gratuito no se renueva ni admite cupos.
- Las empresas autoregistradas no tienen ID de DataMET ni van al espejo SQL
  Server, y su jefe de calidad gestiona plantas y usuarios desde la app.

