# Acceso de pruebas a Gestión IvMET

Gestión IvMET muestra un aviso de **módulo en desarrollo** y solicita un código
antes de cargar clientes, licencias, equipos o cualquier otra consulta del gestor.
Los demás apartados de DataMET+ no utilizan esta barrera.

Para la entrega de privacidad y permisos personales del 28/08/2026, seguir
[la guía actualizada de operaciones](ivmet-operations-release.md). Requiere
migraciones y registrar expresamente al primer administrador; el código y el
nivel 3 por sí solos ya no asignan permisos internos.

## Requisitos y funcionamiento

- Se conserva el inicio de sesión de DataMET+ y el permiso administrativo de nivel
  **3**, revalidado contra DataMET. El código no concede ese permiso.
- El backend compara el código mediante bcrypt. Solo guarda el hash en su `.env`
  privado: `IVMET_ACCESS_CODE_HASH`. Nunca usar una variable `VITE_*` para ello.
- Sin un hash válido, el gestor queda bloqueado. No hay código predeterminado en
  el repositorio y el resto de los módulos sigue funcionando.
- El pase dura como máximo una hora y nunca supera el vencimiento del login
  principal. Está firmado y ligado al usuario y a su token de login exacto.
- El navegador lo guarda solo en memoria. Salir del módulo, recargar, cerrar
  sesión o pulsar **Bloquear acceso** elimina la copia local. No se guarda en
  localStorage, sessionStorage, cookies ni URLs.
- El bloqueo local no revoca un pase ya copiado: sigue sujeto a su vencimiento y
  a la sesión original. Rotar el hash y reiniciar el backend invalida los pases
  anteriores. La revocación del nivel 3 también deniega las siguientes consultas.
- Hay un máximo de cinco intentos por usuario durante quince minutos. El límite
  es local al proceso: es adecuado para el backend actual con una instancia PM2.
  Antes de escalar a varios procesos, usar un contador compartido.
- Usar HTTPS en producción. Este acceso compartido es una barrera temporal de
  desarrollo, no sustituye los permisos personales ni las licencias de IvMET.

## Despliegue: frontend y backend juntos

### 1. En el equipo de desarrollo

Desde `C:\Users\jhona\DataMET_plus`:

```powershell
pnpm lint
pnpm test
pnpm --dir backend test
pnpm build
```

Vite genera la aplicación en **`backend/dist`**, que sirve Express. Actualiza en
el servidor ese contenido y el código del backend (`src`, `scripts`,
`package.json`, `pnpm-lock.yaml` y `pnpm-workspace.yaml`), usando el procedimiento
habitual de DataMET+. Los tres archivos de instalación deben ser los de
**backend**, no los de la raíz. No copiar `node_modules` desde desarrollo.
Conserva el `.env`, los certificados y la configuración propios del servidor.
No reemplaces el `.env` del servidor por el de desarrollo.

### 2. Configurar el código en el servidor

Entra en la carpeta **backend de DataMET+** que ejecuta `cronomet-api`; en el
servidor actual es `C:\Proyectos\CronoMET\backend`, no
`C:\Proyectos\IvMET\worker`. Instala las dependencias después de actualizar los
archivos de instalación y comprueba que Node pueda cargarlas antes de reiniciar:

```powershell
Set-Location 'C:\Proyectos\CronoMET\backend'
pnpm install --prod --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'La instalación falló. No reiniciar todavía.' }
node -e "for (const name of Object.keys(require('./package.json').dependencies || {})) { require(name); console.log(name + ': OK'); } console.log('DEPENDENCIAS_OK');"
if ($LASTEXITCODE -ne 0) { throw 'Falta una dependencia o no se puede cargar. No reiniciar todavía.' }
```

Cuando aparezca `DEPENDENCIAS_OK`, genera el hash del código:

```powershell
pnpm ivmet:access-code
```

Introduce el código elegido dos veces. La entrada no se muestra en pantalla.
El comando entrega una línea `IVMET_ACCESS_CODE_HASH=...`: cópiala en el `.env`
privado de ese backend sin modificar las demás variables. No envíes el código
como argumento, no publiques el hash y no lo añadas a Git.

El `.env` del backend debe contener `SUPABASE_URL` y una clave administrativa:
`SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`. El `.env` del worker es
independiente y no configura DataMET+ automáticamente. Si el worker usa el mismo
proyecto y ya funciona, se pueden copiar **solo esas dos variables** a través
del entorno privado del servidor. No copiar sus credenciales SQL ni reemplazar
el `.env` completo. Nunca utilizar una clave pública `anon` para esta API.

Solo después de configurar Supabase, dejar `IVMET_ENABLED=true` una sola vez en
el `.env` del backend. Activarlo sin esas variables bloquea solo IvMET con un
error de configuración; no impide arrancar el resto de DataMET+.
El `JWT_SECRET` existente debe tener al menos 32 caracteres; no se cambia como
parte de esta actualización: rotarlo invalida las sesiones existentes. El
backend lee estas variables al arrancar.

### 3. Reiniciar únicamente DataMET+

Después de actualizar el frontend, el backend y la configuración:

```powershell
pm2 restart cronomet-api --update-env
pm2 logs cronomet-api --lines 30 --nostream
```

Para cambiar únicamente el código no hace falta reiniciar `ivmet-worker` ni
`servicemet-api`, ejecutar migraciones o volver a incorporar clientes. La entrega
de operaciones/privacidad sí requiere su actualización coordinada independiente.

### 4. Validación

1. Comprueba que los demás apartados de DataMET+ siguen disponibles.
2. Entra con `acceso_cron = 3` en `dbo.DATA_USERS` de la base de login de DataMET+
   y abre Gestión IvMET: debe aparecer **En desarrollo**. Si cambiaste el nivel,
   cierra sesión y vuelve a ingresar. No confundir `acceso_cron` con `acceso`.
3. Un código incorrecto no abre el gestor. El correcto permite comprobar el
   permiso personal activo; registrar primero al administrador según la nueva guía.
4. Pulsa **Bloquear acceso**: desaparecen los datos y vuelve la pantalla de código.
5. Recarga la página: se solicita otra vez. Un usuario sin nivel 3 sigue sin acceso.

No despliegues solo el frontend: el backend anterior no aplica esta protección.

### Diagnóstico de despliegue

- `Command "ivmet:access-code" not found`: comprobar que el `package.json` y
  `scripts/ivmet-access-code.js` actualizados están en el backend del servidor.
- `Cannot find module 'zod'`: faltan dependencias del backend actualizado;
  repetir la instalación desde sus archivos versionados, no agregar una versión
  arbitraria con `pnpm add` ni copiar `node_modules` de otro equipo.
- Sin campo de código: comprobar `IVMET_ENABLED`, el hash válido y la longitud
  del secreto JWT. Leer también el mensaje mostrado por el gestor; un rechazo
  de permisos o de la consulta de configuración oculta el formulario.
- `online` en PM2 no confirma que la web esté disponible. Comprobar los logs
  del reinicio actual, el contador de reinicios y `dist/index.html`. Los logs
  conservan arranques correctos y errores antiguos; revisar sus fechas.
- No compartir `.env`, claves, códigos, hashes ni volcados completos del entorno
  de PM2 para diagnosticar. Compartir únicamente indicadores y errores depurados.

## Contrato técnico

Con el JWT principal en `Authorization: Bearer ...`:

- `GET /api/ivmet/access`: devuelve `{ configured, unlocked, expiresAt }` en `data`.
- `POST /api/ivmet/access/unlock`, JSON `{ "code": "..." }`: devuelve
  `{ ticket, expiresAt }` en `data`. No se acepta un código por query string.
- Las demás rutas `/api/ivmet/*` exigen además `X-Ivmet-Access: <ticket>`.
- `403 IVMET_ACCESS_CODE_REQUIRED`: falta el pase, es inválido o venció.
- `403 IVMET_ACCESS_INVALID_CODE`: código incorrecto.
- `403 IVMET_ACCESS_DENIED`: no tiene el permiso administrativo actual.
- `429 IVMET_ACCESS_RATE_LIMITED`: incluye `Retry-After` y `retryAfter` en segundos.
- `503 IVMET_ACCESS_NOT_CONFIGURED`: falta una configuración válida del acceso.
- Las respuestas protegidas usan `Cache-Control: no-store`.

Los tests HTTP usan un servidor local aislado y dependencias simuladas; no
consultan ni modifican SQL Server o Supabase. La vista de prueba
`/e2e/fixtures/ivmet-preview.html` intercepta sus solicitudes y utiliza el código
ficticio `ivmet-preview`; no forma parte del build productivo.
