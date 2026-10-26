# Guía de Despliegue en Windows Server (Node.js + SQL Server)

Esta guía detalla los pasos para levantar DataMET+ en un servidor Windows o Windows Server con Node.js y SQL Server instalados. La API de Express también sirve la aplicación compilada (`backend/dist`), así que un solo proceso atiende ambas.

Para el HTTPS privado de DataMET+ en `192.168.1.5:3000`, con `datamet.lenash.dev` y acceso por oficina/OpenVPN, seguir [HTTPS de oficina](docs/https-oficina.md). Incluye el proxy, la validación DNS del certificado, el DNS de la VPN y la configuración del frontend.

## 1. Requisitos Previos en el Servidor (Instalaciones)

Antes de copiar el código, debes asegurarte de que el servidor tenga instaladas las herramientas base:

### A. Instalar Node.js
1. Visita la página oficial: [nodejs.org](https://nodejs.org/).
2. Descarga la versión **LTS** (Recomendada para la mayoría de usuarios).
3. Ejecuta el instalador. Asegúrate de marcar la opción que dice *"Automatically install the necessary tools..."* (esto instalará Python y Chocolatey, útiles si alguna librería de Node necesita compilarse en Windows, como `bcrypt`).
4. Al finalizar, abre una consola (CMD o PowerShell) y verifica:
   ```cmd
   node -v
   corepack pnpm -v
   ```
   > **Nota:** El proyecto usa pnpm mediante Corepack. Si quieres tener el comando `pnpm` disponible directamente, abre PowerShell como Administrador y ejecuta `corepack enable`.

### B. Instalar y Configurar la Base de Datos (SQL Server)
*(Si la base de datos no estará en el mismo servidor, puedes saltar este punto).*
1. Instala **Microsoft SQL Server** (la edición Express es gratuita y suficiente para empezar) y **SQL Server Management Studio (SSMS)**.
2. Habilita las conexiones por puerto (TCP/IP):
   - Abre el **SQL Server Configuration Manager**.
   - Expande *SQL Server Network Configuration* -> *Protocols for [Nombre_Instancia]*.
   - Haz clic derecho sobre **TCP/IP** y selecciona **Enable**.
   - Haz doble clic en TCP/IP, ve a la pestaña *IP Addresses*, baja al final hasta *IPAll* y asegúrate de que el **TCP Port** sea `1433` (y que TCP Dynamic Ports esté vacío).
   - Reinicia el servicio de SQL Server desde la pestaña *SQL Server Services*.
3. Asegúrate de que el servidor esté en modo mixto ("SQL Server and Windows Authentication mode") y crea un inicio de sesión propio para DataMET+. No uses `sa` ni un usuario `db_owner`: dale solo los permisos que necesita la aplicación.

## 2. Configurar el Firewall de Windows

El firewall de Windows bloquea conexiones externas por defecto. Debes abrir los puertos necesarios:
1. Abre **Windows Defender Firewall with Advanced Security**.
2. Ve a **Inbound Rules** (Reglas de Entrada) -> **New Rule...** (Nueva Regla).
3. Selecciona **Port** -> Siguiente.
4. Escribe el puerto donde correrá tu API: `3000` (según `PORT` de tu backend) -> Siguiente.
5. Selecciona **Allow the connection** -> Siguiente -> Siguiente.
6. Dale de nombre `DataMET+ (Node.js)` y finaliza.
7. *(Opcional)* Si tu BD debe verse desde fuera del servidor, repite el proceso para abrir el puerto `1433` de SQL Server.

## 3. Preparar el Proyecto (Código Backend)

1. Compila la aplicación en tu equipo con `corepack pnpm build` en la raíz del repositorio: genera `backend/dist`.
2. Copia el backend con su `dist` a la carpeta del servidor (en el servidor actual, `C:\Proyectos\CronoMET\backend`) y abre una terminal en esa ubicación.
3. Instala las dependencias del backend:
   ```cmd
   corepack pnpm install --prod
   ```

4. Crea el archivo de entorno `.env` basándote en `.env.example`, que describe todas las variables (IvMET, correo, Soporte técnico). Lo mínimo:
   ```env
   PORT=3000
   NODE_ENV=production

   # SQL Server: localhost o 127.0.0.1 si corre en la misma máquina.
   DB_SERVER=localhost
   DB_USER=datamet_plus_app
   DB_PASSWORD=una-contraseña-segura
   DB_DATABASE=DataMET

   # Al menos 32 caracteres aleatorios.
   JWT_SECRET=reemplazar-por-una-clave-aleatoria
   JWT_EXPIRES_IN=8h
   ```

5. Aplica las migraciones pendientes de la base de datos **antes** de levantar o reiniciar la API. Haz un respaldo primero; cada migración se aplica una sola vez.
   ```cmd
   corepack pnpm migrate
   ```
   > **Importante:** desde la migración `003` el cronograma usa las columnas `grupo_id` e `id_creador`. Si actualizas el código sin migrar, guardar fichas fallará.

## 4. Levantar la API como Servicio con PM2 (Recomendado)

En producción o en un servidor, no debes levantar tu app corriendo un simple `pnpm start` en una terminal visible, porque si cierras la ventana o si el servidor se reinicia, tu API se cae. **Usaremos PM2.**

1. Abre PowerShell como **Administrador**.
2. Instala PM2 globalmente:
   ```cmd
   corepack pnpm add -g pm2
   ```
3. Instala la utilidad para crear servicios de Windows para PM2:
   ```cmd
   corepack pnpm add -g pm2-windows-startup
   pm2-startup install
   ```
4. Dirígete a la carpeta de tu backend:
   ```cmd
   cd C:\Proyectos\CronoMET\backend
   ```
5. Inicia la API con PM2. El servidor actual usa el nombre `cronomet-api`; los demás procedimientos lo reinician con ese nombre:
   ```cmd
   pm2 start src/server.js --name "cronomet-api"
   ```
6. Guarda la lista actual de procesos para que PM2 sepa qué encender si el servidor se reinicia accidentalmente:
   ```cmd
   pm2 save
   ```

## 5. Pruebas y Monitoreo

- **Verificar PM2:** Si quieres ver si el servicio está corriendo, usa el comando:
  ```cmd
  pm2 list
  ```
- **Ver los logs (errores/consolas):**
  ```cmd
  pm2 logs cronomet-api
  ```
- **Prueba en el servidor:** abre `http://localhost:3000/api/health` (debe responder que la API está operativa y la base conectada) y luego `http://localhost:3000` para ver la aplicación.
- **Prueba desde otro equipo:** entra a `http://[IP-DEL-SERVIDOR-WINDOWS]:3000`.

## PDF de soporte en OneDrive

El guardado en la carpeta elegida por el técnico se configura con `ST_DOCUMENTOS_DIR=D:\OneDrive\SOPORTE TECNICO` y la migración 012. Ver [instalación y comprobación](docs/soporte-documentos.md).
