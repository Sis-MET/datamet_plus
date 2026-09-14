# Gestión IvMET: operación interna y privacidad

Actualización del 31/08/2026. RimMET administra la relación comercial y el
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

## Responsabilidad de RimMET

RimMET sí administra:

- incorporación selectiva de clientes, plantas y balanzas desde DataMET;
- planes comerciales, tarifas, contratos, facturas, pagos y cupos;
- usuarios móviles, roles, plantas autorizadas y licencias;
- habilitación o suspensión IvMET de una balanza lista en el catálogo;
- casos metrológicos que el jefe de calidad haya compartido;
- fichas de balanza que el jefe haya autorizado específicamente;
- preparación operativa, sincronización, privacidad, permisos y auditoría.

RimMET no crea ni edita áreas, patrones, certificados o planes metrológicos del
cliente. Tampoco consulta su historial privado. La bandeja de actualizaciones
compara el catálogo con el snapshot confirmado; **Registrar revisión** solo
agrega un comentario visible al cliente y nunca actualiza DataMET.

## Permisos internos

| Rol | Alcance |
| --- | --- |
| `admin` | Toda la administración interna, sin acceso general a evidencia privada. |
| `commercial` | Clientes, licencias, tarifas, cobros, preparación e incorporación. |
| `support` | Casos y actualizaciones que el cliente compartió. |
| `metrologist` | Casos y actualizaciones compartidos; no configura planes del cliente. |

## Contrato HTTP

Todas las rutas parten de `/api/ivmet` y exigen `Authorization`,
`X-Ivmet-Access` y nivel 3. Las respuestas usan `Cache-Control: no-store` y
`{success,data}`.

Lecturas `GET /ops/:section` vigentes: `session`, `cases`, `case`, `assignees`,
`equipment-updates`, `staff`, `readiness`, `billing`, `privacy`, `audit`.
`equipment-updates` admite `search`, `page` y `pageSize` y nunca devuelve
planes, patrones o resultados.

Acciones `POST /ops/actions/:action` vigentes:

- `case.update`: estado, responsable y comentario visible al cliente.
- `equipment-update.review`: id, versión y comentario; no toca DataMET.
- `staff.save`: permiso interno validado contra el usuario de RimMET.

Las acciones anteriores de áreas, patrones, certificados o planes metrológicos
son rechazadas por validación y por el contrato de Supabase, aunque un cliente
antiguo intente invocarlas directamente.

## Despliegue

Esta UI requiere Supabase `202608280004` y worker contrato 4. Seguir primero
`IvMET/docs/customer-configuration-release.md`. Después compilar y actualizar
RimMET conservando `backend/.env`:

```powershell
Set-Location 'C:\Users\jhona\RimMET'
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
