# DataMET+

Aplicación interna de Métrica Ltda. que reúne el formulario RIM, el cronograma operativo, el cronograma de calibración y la administración de IvMET.

## Características

- **Formulario Completo:** Secciones organizadas para datos de balanza, cliente y técnico.
- **Validación Robusta:** Uso de Zod y React Hook Form para asegurar la integridad de datos.
- **Firmas Digitales:** Captura de firma en pantalla táctil o con mouse.
- **Evidencias:** Subida de fotos con drag & drop y previsualización.
- **Diseño minimalista:** tokens de color en `src/index.css` con tema claro y oscuro (sigue al sistema hasta que se elige uno desde la barra superior), tipografía Figtree autoalojada y vidrio solo en capas flotantes (barra superior, menús, avisos).
- **Barra lateral:** módulos, sesión y cierre de sesión; se oculta o muestra con `Ctrl+B` (`⌘B` en macOS) y en móvil se abre como panel.
- **Responsive:** Adaptable a dispositivos móviles y escritorio.
- **Gestión IvMET:** panel administrativo para clientes contratados, licencias, planes y revisión del catálogo sincronizado.
- **Calibración:** plan anual de calibraciones, verificaciones internas y actividades del área, con alertas en el cronograma y por correo.

## Calibración

Módulo independiente del cronograma del personal. Lee los equipos activos de
`DATA_EQUIPOS_CAL` (sin modificarla) y guarda su planificación en tablas
`CAL_*` (migración `004`, aplicar con `pnpm migrate` en `backend`).

- **Calibración:** la fecha sale del certificado: `cert_fecha + cert_periodo`
  (días). No se usa `cert_fechaven` porque en varios registros está vacía o
  repite la emisión. Al registrar un certificado nuevo el plan se recalcula.
- **Verificación interna:** por equipo, cada N meses contando desde cada
  calibración o desde una fecha fija. Se omite si cae a menos de 14 días de la
  recalibración; las fechas que dependen de una calibración futura se muestran
  como estimadas y no generan avisos.
- **Actividades del área:** tareas propias (p. ej. revisar documentos legales en
  Fundaempresa o la política de calidad), únicas o periódicas.
- **Vistas:** año (línea de tiempo con la vigencia del certificado), mes y
  agenda; además pestañas de equipos (configuración individual o por lote),
  actividades y alertas.
- **Seguimiento:** cada fecha puede marcarse en proceso, realizada (con
  resultado en verificaciones), reprogramada o cancelada.
- **Permisos:** consultan todos; editan el área Calibración y el nivel 3.

### Alertas

Cada serie usa los avisos generales o los suyos propios: días de anticipación y
frecuencia (una vez, semanal, diaria o sin alertas). Las fechas en aviso y las
vencidas aparecen en «Requieren atención» y en el contador de la barra lateral.
Por correo, cada día a la hora configurada se envía un resumen al responsable
de cada serie (si su correo está registrado en el módulo) y a quienes reciben
todas las alertas. `CAL_ALERTAS_ENVIOS` registra cada aviso para no repetirlo
antes de tiempo.

Por ahora la configuración de correo (destinatarios, servidor, frecuencia, hora
e historial) está oculta en la interfaz con `EMAIL_ALERTS_UI = false` en
`src/features/calibration/domain/format.js`; el envío del backend sigue
intacto. Ponerla en `true` la vuelve a mostrar.

Variables del backend (sin `SMTP_HOST` las alertas solo se ven en la app):

```dotenv
SMTP_HOST=smtp.ejemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<usuario>
SMTP_PASSWORD=<clave>
SMTP_FROM="Calibración Métrica <calibracion@ejemplo.com>"
CAL_ALERTS_ENABLED=true
APP_URL=http://<servidor>:3000
```

## Gestión IvMET

El navegador consume exclusivamente `/api/ivmet/*` con el JWT de RimMET. La conexión administrativa con Supabase ocurre en el backend y requiere un usuario RimMET con `acceso_cron = 3`.

Variables del backend:

```dotenv
IVMET_ENABLED=false
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<server-only-secret>
```

Para desarrollo local puede usarse temporalmente `SUPABASE_SERVICE_ROLE_KEY` en lugar de `SUPABASE_SECRET_KEY`. Ninguna de estas claves debe declararse con prefijo `VITE_` ni almacenarse en el frontend.

El módulo incluye fichas por cliente/planta/balanza, cuentas y licencias,
contratos, tarifas mensuales/anuales, pagos parciales, renovaciones, cupos,
áreas, patrones/certificados y sincronización selectiva. Comparte los tokens
de tema de la aplicación: superficies sólidas en datos y formularios, y vidrio
en las listas desplegables.

Antes de abrirlo, aplicar las migraciones administrativas del repositorio IvMET.
Consultar [la guía de operación y despliegue](docs/ivmet-management.md).

Rutas principales:

- `GET /api/ivmet/overview`
- `GET /api/ivmet/clients`
- `GET /api/ivmet/plans`
- `GET /api/ivmet/clients/:clientId`
- `GET /api/ivmet/clients/:clientId/equipment`
- `GET /api/ivmet/clients/:clientId/users`
- `GET /api/ivmet/integration`
- `POST /api/ivmet/actions/:action`

### Acceso temporal de desarrollo a IvMET

El gestor muestra **En desarrollo** y requiere, además del nivel 3, un código
validado en el backend. No carga datos antes de desbloquearlo. Configura
`IVMET_ACCESS_CODE_HASH` en el `.env` privado del backend con el comando
`pnpm ivmet:access-code`; sin hash válido el módulo permanece bloqueado.

El frontend y el backend se deben actualizar juntos. Consulta la
[guía de configuración y despliegue](docs/ivmet-development-access.md).

## Tecnologías

- React 19
- Vite
- Tailwind CSS
- React Hook Form + Zod
- React Signature Canvas
- React Dropzone
- Lucide React

## Instalación y Ejecución

1.  **Instalar dependencias:**

    ```bash
    cd rim-app
    corepack pnpm install
    ```

2.  **Iniciar servidor de desarrollo:**

    ```bash
    corepack pnpm dev
    ```

3.  **Construir para producción:**
    ```bash
    corepack pnpm build
    ```

## Estructura del Proyecto

- `src/components/ui`: Componentes base reutilizables.
- `src/components/forms`: Componentes complejos del formulario (Firma, Fotos).
- `src/components/layout`: Elementos de estructura (Header).
- `src/utils`: Validaciones y utilidades.
