# HTTPS de DataMET+ en oficina y OpenVPN

## Destino y alcance

| Elemento | Configuración |
| --- | --- |
| Servidor existente | `servidor-metrica`, IP `192.168.1.5` |
| Aplicación existente | `http://192.168.1.5:3000` |
| Dirección HTTPS propuesta | `https://datamet.lenash.dev` |
| Destino del proxy en ese mismo servidor | `http://127.0.0.1:3000` |
| Acceso | Red de oficina y usuarios conectados por OpenVPN |
| Certificado | Let's Encrypt con DNS-01 y renovación automática por Caddy |

Estos archivos preparan la instalación. No crean registros en Cloudflare, emiten certificados, instalan servicios ni cambian el servidor, la VPN o el firewall al compilar DataMET+. Se ejecutan los pasos siguientes en `servidor-metrica`, con la administración de red disponible.

El navegador conecta directamente con la IP privada del servidor. Cloudflare interviene para crear y quitar el TXT de validación del dominio; el tráfico de la aplicación no utiliza su proxy ni un túnel. DNS-01 permite emitir el certificado sin publicar el servidor en Internet. [Let's Encrypt](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge).

## 1. Nombre interno y OpenVPN

La computadora consultada en la oficina usa `192.168.1.134/24`, puerta de enlace `192.168.1.1` y los DNS públicos de Google `8.8.8.8` y `8.8.4.4`. Esos DNS no permiten configurar la entrada privada de DataMET+. El sufijo `METRICA` y el acceso por el nombre corto `servidor-metrica` no confirman que ya exista un DNS interno. El adaptador OpenVPN estaba desconectado al consultar estos datos.

Para una instalación central, comprobar si el router admite una entrada DNS local y consultas desde la VPN. Si no admite ambas funciones, usar un servidor DNS interno que pueda resolver ese nombre y reenviar las demás consultas. No cambiar los DNS de los equipos hasta verificar ese servicio; la puerta de enlace `192.168.1.1` no implica que también funcione como DNS. El modelo del router todavía no se conoce; la prueba inicial siguiente permite continuar sin ese dato.

### Prueba inicial sin cambiar el router

En una computadora Windows de prueba, abrir como administrador `C:\Windows\System32\drivers\etc\hosts` y añadir, conservando su contenido existente:

```text
192.168.1.5 datamet.lenash.dev
```

Comprobar primero que no exista otra entrada para ese mismo nombre. Esta asociación solo se aplica a esa computadora y también puede usarse al conectarla por OpenVPN si la VPN permite llegar al servidor. Para probar desde una segunda computadora, añadir allí la misma entrada. Esto resuelve el nombre; todavía deben instalarse Caddy y el certificado según los pasos siguientes. La validación DNS-01 del certificado utiliza el TXT público de Cloudflare y no requiere el DNS interno.

Cuando funcione el DNS central, retirar la entrada de prueba para comprobar la resolución distribuida. No hace falta conocer el modelo del router para realizar esta prueba inicial.

### Resolución central para oficina y VPN

En el DNS interno elegido, agregar una resolución exacta:

```text
datamet.lenash.dev    A    192.168.1.5
```

Usar una entrada/override para ese nombre. Evitar reemplazar toda la zona `lenash.dev`: sus otros servicios y los TXT públicos deben seguir resolviéndose normalmente. La IP del DNS interno todavía debe confirmarse con quien administra la red; no se presupone que sea `192.168.1.5`.

Configurar DHCP para que las computadoras de la oficina usen ese DNS. No mantener los DNS públicos de Google como alternativa en los clientes que necesitan el nombre privado: también podrían consultarlos y obtener una respuesta sin la entrada interna. El DNS interno puede reenviar las consultas públicas a esos resolutores. Los usuarios de OpenVPN deben recibir también el DNS interno y tener rutas hacia ese DNS y `192.168.1.5`; permitir consultas UDP/TCP 53 al DNS desde la VPN. Como ya acceden al servidor de DataMET+, conservar la configuración de rutas que funciona actualmente.

Si es **OpenVPN Community**, integrar en la configuración existente del servidor VPN, sustituyendo la dirección del DNS:

```text
push "dhcp-option DNS IP_DNS_INTERNO"
```

Se incluye un fragmento comentado en `deploy/office-https/openvpn-dns.conf.example`. Para **OpenVPN Access Server**, configurar los DNS en su panel de administración. Comprobar la edición antes de cambiar archivos. Los clientes deben reconectarse; el modo de aplicar DNS depende del sistema operativo y cliente. [OpenVPN](https://openvpn.net/community-docs/pushing-dhcp-options-to-clients/).

Desde una computadora de oficina y otra conectada por VPN, comprobar:

```powershell
Resolve-DnsName datamet.lenash.dev -Type A
```

Debe devolver `192.168.1.5`. Hacer esta comprobación sin la entrada temporal de `hosts` para confirmar que responde el DNS. No hace falta crear un registro A/AAAA público para la aplicación.

## 2. Token de Cloudflare y Caddy

En Cloudflare, crear un **API Token**, con permisos `Zone / Zone / Read` y `Zone / DNS / Edit`, restringidos a la zona `lenash.dev`. Son los permisos del módulo Cloudflare de Caddy. No usar la Global API Key ni poner el token en variables `VITE_*`, en el frontend, en Git o en el chat. [Módulo Cloudflare](https://github.com/caddy-dns/cloudflare).

Descargar Caddy para Windows con el módulo **`github.com/caddy-dns/cloudflare`** desde el [constructor de Caddy](https://caddyserver.com/download). La descarga estándar sin ese módulo no interpreta `dns cloudflare`. Mantener el binario en una carpeta permanente, por ejemplo `C:\Program Files\DataMET-Caddy\caddy.exe`.

Comprobar el módulo:

```powershell
& 'C:\Program Files\DataMET-Caddy\caddy.exe' version
& 'C:\Program Files\DataMET-Caddy\caddy.exe' list-modules | Select-String -SimpleMatch 'dns.providers.cloudflare'
```

Crear `C:\ProgramData\DataMET-Caddy` en el servidor. Copiar allí:

- `deploy/office-https/Caddyfile` como `Caddyfile`.
- `deploy/office-https/caddy.env.example` como `caddy.env` y sustituir el marcador por el token real en esa copia local.

Restringir el acceso a esa carpeta a Administradores y a la cuenta del servicio (SYSTEM si se usa el ejemplo siguiente): contiene el token, las claves del certificado y los datos ACME. Caddy carga el archivo local con `--envfile`; no pasar `--environ`, que imprime variables. Los certificados se guardan en `data` y los registros en `logs/caddy.log` dentro de esa carpeta. [CLI de Caddy](https://caddyserver.com/docs/command-line#caddy-run).

El `Caddyfile` preparado:

- Escucha HTTPS en `192.168.1.5:443` y reenvía al backend `127.0.0.1:3000`.
- Solicita un certificado público de Let's Encrypt usando DNS-01 y lo renueva automáticamente.
- Consulta el TXT con resolutores públicos para que el DNS interno no oculte la validación.
- Mantiene la administración de Caddy en `127.0.0.1:2019`.
- Desactiva la redirección HTTP automática: no ocupa el puerto 80. Los accesos HTTP anteriores siguen en el puerto 3000.

Cloudflare **Universal SSL** no sirve para esta conexión directa y un certificado **Origin CA** no tiene confianza pública para los navegadores. El certificado público lo gestiona Caddy con Let's Encrypt. [Limitaciones de Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/), [Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/).

## 3. Preparar frontend y backend

La API usa por omisión el mismo origen que la aplicación, por lo que funciona tanto en `https://datamet.lenash.dev/api` como en los accesos HTTP actuales. `VITE_API_URL` y `VITE_API_PORT` explícitos todavía tienen prioridad.

Antes de compilar en el servidor, copiar `.env.production.example` a `.env.production.local` y mantener ambas variables vacías. Si el destino ya existe, editarlo conservando sus otras variables; no sobrescribirlo con una copia. Esto evita heredar una URL HTTP o el puerto 3000 desde `.env` o `.env.local`.

```dotenv
VITE_API_URL=
VITE_API_PORT=
```

Comprobar también que el proceso que ejecuta `pnpm build` no tenga esas variables definidas con otros valores, porque el entorno del proceso tiene prioridad sobre los archivos. Reiniciar el servidor no cambia las variables incluidas en un frontend ya compilado: es necesario volver a compilar.

En `backend/.env`, mantener `PORT=3000` para este despliegue y agregar el nuevo origen a `CORS_ORIGIN`, conservando los que se usan actualmente:

```dotenv
CORS_ORIGIN=https://datamet.lenash.dev,http://192.168.1.5:3000,http://servidor-metrica:3000
```

Después, desde la raíz del proyecto:

```powershell
pnpm build
```

Reiniciar el backend con el procedimiento habitual de PM2 si se cambió su entorno. Antes de continuar, comprobar en el servidor que `http://127.0.0.1:3000` responde. El Caddyfile presupone el backend de producción sirviendo `backend/dist`, no el servidor Vite de desarrollo.

## 4. Firewall y servicio Windows

En el firewall de Windows, permitir **TCP 443** hacia `192.168.1.5` únicamente desde la red de oficina `192.168.1.0/24` y el rango real de la VPN. Si OpenVPN usa NAT, comprobar qué IP de origen ve el servidor. El rango VPN aún debe confirmarse: no asumir `10.8.0.0/24` por ser frecuente. Mantener la política de entrada desde Internet del router. No se requiere redirigir puertos WAN para DNS-01.

Caddy necesita salida HTTPS para Cloudflare y Let's Encrypt, y consultas DNS a los resolutores de su configuración. Mantener esos servicios salientes disponibles para renovar certificados.

En PowerShell como administrador **del servidor**, comprobar primero la configuración con el archivo de entorno local:

```powershell
& 'C:\Program Files\DataMET-Caddy\caddy.exe' validate --config 'C:\ProgramData\DataMET-Caddy\Caddyfile' --adapter caddyfile --envfile 'C:\ProgramData\DataMET-Caddy\caddy.env'
```

Registrar Caddy en el administrador de servicios de Windows. El cmdlet `New-Service` conserva las comillas de las rutas con espacios. Ejecutar solo si todavía no existe `DataMETHttps`:

```powershell
$officeServiceCommand = '"C:\Program Files\DataMET-Caddy\caddy.exe" run --config "C:\ProgramData\DataMET-Caddy\Caddyfile" --adapter caddyfile --envfile "C:\ProgramData\DataMET-Caddy\caddy.env"'
New-Service -Name 'DataMETHttps' -DisplayName 'DataMET HTTPS' -BinaryPathName $officeServiceCommand -StartupType Automatic
Start-Service -Name 'DataMETHttps'
```

Revisar el estado del servicio y `C:\ProgramData\DataMET-Caddy\logs\caddy.log` hasta que la emisión del certificado termine correctamente. Mantener el servicio y su carpeta de datos para que la renovación sea automática. [Servicio Windows de Caddy](https://caddyserver.com/docs/running#windows-service).

## 5. Verificación desde oficina y VPN

Ejecutar desde un equipo de oficina y después desde otro conectado por OpenVPN:

```powershell
.\deploy\office-https\Test-OfficeHttps.ps1
```

El script solo consulta DNS, prueba TCP 443 y verifica HTTPS con `curl.exe`, sin ignorar errores de certificado. Con `-DnsServer IP_DNS_INTERNO` se puede probar un DNS concreto sin cambiar la configuración del equipo. Con `-SkipHttps` solo comprueba DNS y TCP, antes de que exista el certificado.

En el navegador, abrir `https://datamet.lenash.dev`, iniciar sesión y abrir Soporte/Calibración. En las herramientas de red, las llamadas deben ir a `https://datamet.lenash.dev/api/...`, sin el puerto 3000 ni advertencias de contenido mixto. `window.isSecureContext` debe devolver `true`. La sesión del nuevo origen requiere iniciar sesión allí; el almacenamiento del navegador se separa por origen.

Comprobar también los accesos HTTP anteriores si siguen en uso. Para que HTTPS funcione, los usuarios deben entrar por `datamet.lenash.dev`; el certificado no cubre `192.168.1.5` ni el nombre corto `servidor-metrica`.

Esta preparación habilita HTTPS. El centro de notificaciones, el service worker y las suscripciones Web Push todavía deben implementarse. Los avisos push necesitan salida a Internet de servidor y dispositivos, aunque el contenido de DataMET solo se abra en oficina/VPN.
