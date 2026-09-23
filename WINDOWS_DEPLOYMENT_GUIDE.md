# Guía de Despliegue en Windows Server (Node.js + SQL Server)

Esta guía detalla los pasos para migrar y levantar el **Backend (API)** de RimMET en un servidor Windows o Windows Server, dejando de lado la configuración basada en Docker (Ubuntu) para usar una instalación nativa que ofrezca mejor rendimiento y facilidad de mantenimiento.

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
*(Si la base de datos no estará en el mismo servidor, puedes saltar este punto. Ignora Docker completamente).*
1. Instala **Microsoft SQL Server** (la edición Express es gratuita y suficiente para empezar) y **SQL Server Management Studio (SSMS)**.
2. Habilita las conexiones por puerto (TCP/IP):
   - Abre el **SQL Server Configuration Manager**.
   - Expande *SQL Server Network Configuration* -> *Protocols for [Nombre_Instancia]*.
   - Haz clic derecho sobre **TCP/IP** y selecciona **Enable**.
   - Haz doble clic en TCP/IP, ve a la pestaña *IP Addresses*, baja al final hasta *IPAll* y asegúrate de que el **TCP Port** sea `1433` (y que TCP Dynamic Ports esté vacío).
   - Reinicia el servicio de SQL Server desde la pestaña *SQL Server Services*.
3. Asegúrate de que el servidor esté en modo mixto ("SQL Server and Windows Authentication mode") para poder ingresar con el usuario `sa` (o el que definas) y una contraseña.

## 2. Configurar el Firewall de Windows

El firewall de Windows bloquea conexiones externas por defecto. Debes abrir los puertos necesarios:
1. Abre **Windows Defender Firewall with Advanced Security**.
2. Ve a **Inbound Rules** (Reglas de Entrada) -> **New Rule...** (Nueva Regla).
3. Selecciona **Port** -> Siguiente.
4. Escribe el puerto donde correrá tu API: `3000` (según `PORT` de tu backend) -> Siguiente.
5. Selecciona **Allow the connection** -> Siguiente -> Siguiente.
6. Dale de nombre `API RimMET Nodejs` y finaliza.
7. *(Opcional)* Si tu BD debe verse desde fuera del servidor, repite el proceso para abrir el puerto `1433` de SQL Server.

## 3. Preparar el Proyecto (Código Backend)

1. En el repositorio clonado o la carpeta copiada a tu servidor (ej. `C:\apps\RimMET\backend`), abre una terminal en esa ubicación.
2. Instala todas las dependencias del proyecto:
   ```cmd
   corepack pnpm install --prod
   ```

3. Crea el archivo de entorno `.env` basándote en `.env.example`.
   **Archivo `.env` sugerido:**
   ```env
   # Port to run the Express server
   PORT=3000

   # Database Configuration (Conexión al SQL Server Nativo)
   DB_SERVER=localhost
   DB_USER=sa
   DB_PASSWORD=Tu_Contrasenia_Fuerte123
   DB_DATABASE=rimmet_db

   # JWT
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=1d

   # Entorno
   NODE_ENV=production
   ```
   > **Nota:** Ya no necesitas usar la IP del contenedor Docker para el `DB_SERVER`. Si SQL Server corre en la misma máquina, usa `localhost` o `127.0.0.1`.

4. Aplica las migraciones pendientes de la base de datos **antes** de levantar o reiniciar la API. Haz un respaldo primero; cada migración se aplica una sola vez.
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
   cd C:\Ruta\A\Tu\Proyecto\RimMET\backend
   ```
5. Inicia tu API usando PM2 (reemplaza `src/server.js` con el archivo principal de tu API que figura en el tu package.json si es diferente):
   ```cmd
   pm2 start src/server.js --name "rimmet-api"
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
  pm2 logs rimmet-api
  ```
- **Prueba en navegador local:** Abre un navegador en el servidor y ve a `http://localhost:3000` (o la ruta a algún endpoint que tengas, por ejemplo `http://localhost:3000/api/status`). 
- **Prueba desde tu laptop:** Entra a `http://[IP-DEL-SERVIDOR-WINDOWS]:3000` (así se conectará tu Frontend React).

---
> **Importante acerca de Docker:** En tu Windows Server, puedes eliminar o ignorar completamente los archivos `Dockerfile` y `docker-compose.yml`. Todo tu código ahora corre directo nativo y se nutre del SQL Server y Node instalados en tu máquina.
