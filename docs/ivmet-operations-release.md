# Gestión IvMET: operación interna y privacidad

Actualización del 31/08/2026. DataMET+ administra la relación comercial y el
alcance operativo de IvMET. El cliente administra desde la app sus áreas,
patrones, certificados y planes metrológicos.

## Acceso de desarrollo

El código de acceso se guarda únicamente como hash bcrypt en
`CronoMET/backend/.env`. No se copia en el frontend, IvMET, SQL Server ni
Supabase. Para comprobar el código configurado en el servidor:

```powershell
Set-Location 'C:\Proyectos\CronoMET\backend'
pnpm ivmet:doctor --verify-code
```

Además del código correcto, cada solicitud exige sesión vigente, nivel
`DATA_USERS.acceso_cron=3` y permiso activo en `private.rimmet_staff`. El primer
administrador se registra con `pnpm ivmet:admin-bootstrap`; los siguientes se
gestionan en **Permisos internos**.

## Responsabilidad de DataMET+

DataMET+ sí administra:

- incorporación selectiva de clientes, plantas y balanzas desde DataMET;
- planes comerciales, tarifas, contratos, facturas, pagos y cupos;
- usuarios móviles, roles, plantas autorizadas y licencias;
- habilitación o suspensión IvMET de una balanza lista en el catálogo;
- casos metrológicos que el jefe de calidad haya compartido;
- fichas de balanza que el jefe haya autorizado específicamente;
- preparación operativa, sincronización, privacidad, permisos y auditoría.

DataMET+ no crea ni edita áreas, patrones, certificados o planes metrológicos del
cliente. Tampoco consulta su historial privado. **Casos compartidos** y
**Actualizaciones de balanzas** son pestañas de la ficha de cada cliente: no hay
bandejas generales que mezclen empresas. Las actualizaciones comparan el
catálogo con el snapshot confirmado; **Registrar revisión** solo agrega un
comentario visible al cliente y nunca actualiza DataMET.

## Avisos y habilitación en lote

- Cada tarjeta del directorio indica los casos compartidos en estado *Recibido*
  y las actualizaciones sin revisar de ese cliente; las pestañas de la ficha
  repiten esos números. Solo se muestran con permiso `support`.
- En **Balanzas**, **Habilitar balanzas** (con el número de pendientes) abre un
  diálogo con las balanzas activas y validadas sin habilitar, por planta y con
  búsqueda. Se eligen una por una, por planta o todas y se habilitan juntas;
  el lote se aplica completo o no se aplica.
- Las suspendidas aparecen plegadas y fuera de «seleccionar todas»: solo se
  reactivan si se marcan a propósito. Las que requieren revisión en DataMET no
  aparecen. Suspender sigue haciéndose desde la ficha de cada balanza.

## Permisos internos

| Rol | Alcance |
| --- | --- |
| `admin` | Toda la administración interna, sin acceso general a evidencia privada. |
| `commercial` | Clientes, licencias, tarifas, cobros, preparación e incorporación. |
| `support` | Directorio y ficha básica de clientes, con sus casos y actualizaciones compartidas. |
| `metrologist` | Igual que soporte; no configura planes del cliente. |

Soporte y metrología abren la ficha para llegar a lo compartido, pero el
backend les entrega solo nombre, código, estado, plantas y conteos de catálogo:
sin contratos, facturas, pagos, licencias, usuarios ni detalle de
incorporaciones.

## Contrato HTTP

Todas las rutas parten de `/api/ivmet` y exigen `Authorization`,
`X-Ivmet-Access` y nivel 3. Las respuestas usan `Cache-Control: no-store` y
`{success,data}`.

Lecturas `GET /ops/:section` vigentes: `session`, `cases`, `case`, `assignees`,
`equipment-updates`, `staff`, `readiness`, `billing`, `privacy`, `audit`.
`cases` y `equipment-updates` se consultan con `clientId` desde la ficha;
`equipment-updates` admite además `search`, `page` y `pageSize` y nunca devuelve
planes, patrones o resultados. `GET /clients` y `GET /clients/:clientId`
aceptan el permiso `commercial` o `support`; con `support` la respuesta se
limita en el backend.

Acciones `POST /ops/actions/:action` vigentes:

- `case.update`: estado, responsable y comentario visible al cliente.
- `equipment-update.review`: id, versión y comentario; no toca DataMET.
- `staff.save`: permiso interno validado contra el usuario de DataMET+.

Acciones `POST /actions/:action` de balanzas, con permiso `commercial`:

- `equipment.configure`: una balanza, con versión.
- `equipment.bulk-configure`: `clientId`, `enabled` e `ids` (hasta 500 por
  solicitud; el diálogo divide selecciones mayores).

Las acciones anteriores de áreas, patrones, certificados o planes metrológicos
son rechazadas por validación y por el contrato de Supabase, aunque un cliente
antiguo intente invocarlas directamente.

## Despliegue

Esta UI requiere Supabase `202609160001` y worker contrato 4. Seguir primero
`IvMET/docs/client-attention-bulk-equipment.md`: la migración va antes que
DataMET+. Después compilar y actualizar
DataMET+ conservando `backend/.env`:

```powershell
Set-Location 'C:\Users\jhona\DataMET_plus'
pnpm lint
pnpm test
pnpm --dir backend test
pnpm build
```

En el servidor, después de copiar el backend y `backend/dist`:

```powershell
Set-Location 'C:\Proyectos\CronoMET\backend'
pnpm install --prod --frozen-lockfile
pnpm ivmet:doctor --verify-code
pm2 restart cronomet-api --update-env
pm2 logs cronomet-api --lines 30 --nostream
```

No reiniciar ServiceMET. La fixture local
`/e2e/fixtures/ivmet-preview.html` usa solo datos ficticios y el código
`ivmet-preview`; no forma parte del build de producción.
