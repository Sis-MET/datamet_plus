# DataMET+

Aplicación interna de Métrica Ltda. que reúne el formulario RIM, el cronograma operativo y la administración de IvMET.

## Características

- **Formulario Completo:** Secciones organizadas para datos de balanza, cliente y técnico.
- **Validación Robusta:** Uso de Zod y React Hook Form para asegurar la integridad de datos.
- **Firmas Digitales:** Captura de firma en pantalla táctil o con mouse.
- **Evidencias:** Subida de fotos con drag & drop y previsualización.
- **Diseño Moderno:** Interfaz limpia y profesional construida con Tailwind CSS.
- **Responsive:** Adaptable a dispositivos móviles y escritorio.
- **Gestión IvMET:** panel administrativo para clientes contratados, licencias, planes y revisión del catálogo sincronizado.

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
áreas, patrones/certificados y sincronización selectiva. Usa vidrio en la
navegación/formularios y superficies sólidas en los datos.

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
