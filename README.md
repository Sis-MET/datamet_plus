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

Rutas iniciales:

- `GET /api/ivmet/overview`
- `GET /api/ivmet/clients`
- `GET /api/ivmet/plans`
- `GET /api/ivmet/equipment-review`

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
