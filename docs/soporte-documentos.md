# PDF de soporte en la carpeta elegida

Después de aprobar y emitir (o reemitir), se abre automáticamente el selector de destino. El técnico navega por las carpetas existentes del área, elige el destino y confirma **Guardar aquí**. Puede editar el nombre del archivo. También puede iniciar otro guardado con **Guardar PDF** en un informe emitido. La selección se ofrece en cada guardado; no se deduce del cliente ni impone una estructura de carpetas.

La raíz indicada para el servidor `192.168.1.5` es:

```text
D:\OneDrive\SOPORTE TECNICO
```

El selector es parte de DataMET+ y muestra las carpetas del servidor mediante la API existente, tanto desde la oficina como por OpenVPN. No utiliza el selector de archivos locales del navegador ni requiere Microsoft Graph.

**Estado de despliegue:** la configuración local está preparada, pero no se accedió al servidor ni se aplicó la migración 012. La raíz indicada no existe en el equipo de desarrollo. Quedan pendientes la instalación y las comprobaciones de oficina, OpenVPN y OneDrive descritas abajo.

## Instalación

1. En el `backend/.env` **del servidor**, configurar:

   ```dotenv
   ST_DOCUMENTOS_DIR=D:\OneDrive\SOPORTE TECNICO
   ```

   La variable ya está configurada en el entorno local de este checkout y documentada en `backend/.env.example`. El archivo `.env` no se distribuye por Git: comprobar también el servidor y cualquier entorno de PM2 que sobrescriba la variable.

2. La cuenta que ejecuta el backend debe tener permisos de lectura/escritura sobre esa carpeta y sus destinos. No dar acceso a otras áreas. La aplicación no crea la raíz ni modifica permisos de Windows.
3. Mantener la carpeta y sus PDF disponibles localmente en el servidor mediante **Mantener siempre en este dispositivo** de OneDrive. La sincronización debe estar activa en la sesión que la administra. Guardar un PDF confirma la escritura local y su registro en DataMET+; no confirma que OneDrive ya lo haya subido a la nube.
4. Aplicar las migraciones con `pnpm migrate` desde `backend`. Se requieren `012_soporte_documentos.sql` y `013_soporte_aprobadores.sql`, después de la 011. No ejecutar contra otra base por error: revisar el entorno de despliegue habitual.
5. Compilar el frontend con `pnpm build` desde la raíz y reiniciar el backend con el procedimiento habitual. Para compilar con PDF.js 6.4.299 se requiere Node.js 22.13 o posterior de la rama 22, o Node.js 24 o posterior. Si PM2 tiene la variable en su entorno, actualizarlo también.

## Comportamiento

- **Guardar PDF** abre el selector en la raíz y permite navegar, subir de carpeta, utilizar las migas de navegación, buscar dentro de la carpeta actual y actualizar el listado. Cada guardado comienza ofreciendo la elección; no recuerda el último destino ni crea carpetas por cliente o gestión. También se puede guardar en la raíz.
- Al emitir o reemitir se espera la respuesta del servidor y se prepara el PDF con los datos, revisión y versión que este devuelve, sin reutilizar el borrador anterior. Si se cancela o falla el guardado, la emisión permanece y aparece **PDF pendiente de guardar** hasta archivar esa revisión. El selector vuelve a estar disponible desde **Elegir carpeta** o **Guardar PDF**.
- **Descargar copia** mantiene la descarga local anterior, independiente del archivo del área.
- **Guardar PDF**, **Descargar copia** e **Imprimir** se habilitan después de emitir. No se archivan nuevos borradores: también lo rechaza la API aunque se intente fuera de la interfaz. **PDF guardados** muestra nombre, carpeta relativa, usuario, fecha y revisión. Las referencias antiguas a borradores siguen consultables y se identifican como tales.
- **Abrir PDF** consulta el archivo registrado y lo muestra en un visor PDF.js dentro del panel, con páginas y zoom, incluso si el navegador no incorpora un visor PDF. La biblioteca y su worker se cargan al abrir el documento. También permite descargarlo o abrirlo en otra pestaña. Las revisiones anteriores conservan sus PDF y sus ubicaciones.
- El PDF se genera con el mismo documento que la vista previa. Al archivar una revisión emitida desde el historial, se utiliza su copia congelada. Los informes antiguos sin copia congelada toman una copia posterior de su revisión vigente, con el mismo procedimiento existente para abrir revisiones.
- Los PDF se asocian a una revisión realmente emitida y se preparan desde su copia congelada. Abrir una revisión nueva no elimina el acceso a los PDF emitidos anteriores.
- No se reemplazan documentos. Si el nombre ya pertenece a otro contenido, informe, revisión o versión de borrador, cambiarlo para conservar ambos. Reenviar el mismo PDF para el mismo contexto y destino devuelve el registro existente. Una segunda carpeta puede contener el mismo nombre.
- Tras un fallo de guardado, el diálogo conserva el PDF preparado en memoria mientras siga abierto y no se cambie el nombre. Si el PDF se escribió pero falló la confirmación del registro, reintentar con la misma carpeta y nombre permite completar el registro sin borrar ni sobrescribir el archivo. Si se cierra el diálogo y se vuelve a generar el PDF, su fecha de creación puede cambiar: usar otro nombre si aparece un conflicto.
- Si alguien mueve, elimina o modifica el archivo fuera de DataMET+, el visor informa el problema. No busca otro archivo de forma automática ni entrega contenido que no coincida con la huella registrada. Moverlo desde el Explorador no actualiza su referencia en DataMET+.

## Acceso y almacenamiento

La tabla `ST_INFORMES_DOCUMENTOS` guarda las referencias y las huellas SHA-256, no el contenido del PDF. El archivo permanece en la carpeta elegida. Se admite un PDF de hasta 30 MB y un nombre de hasta 220 caracteres, incluida la extensión `.pdf`.

Las rutas de carpetas y archivos son relativas a la raíz configurada. Se rechazan rutas absolutas, segmentos `..`, nombres reservados de Windows, enlaces simbólicos y uniones de directorio hacia otras ubicaciones. Solo se exploran las carpetas existentes. El contenido se entrega por una ruta autenticada del módulo; la carpeta no se publica como directorio estático y el JWT nunca se añade al enlace del PDF.

Cambiar `ST_DOCUMENTOS_DIR` a otro directorio no reasigna silenciosamente los documentos anteriores: sus referencias incluyen la huella de la raíz original. Planificar cualquier traslado con sus referencias de base de datos y respaldo.

## Convenciones de interfaz

Esta extensión conserva el sistema visual del editor: superficies claras y neutras, tipografía Figtree, bordes suaves y acción principal amarilla. `GuardarPdfModal` y el visor reutilizan `Modal`, `PrimaryButton`, `CancelButton` y `ToneBadge` de `src/features/calibration/components/primitives.jsx`; las acciones secundarias usan `src/shared/components/ui/Button.jsx`. Esas primitivas y los tokens existentes siguen siendo la fuente de verdad.

- El selector utiliza una ficha centrada en escritorio y una hoja inferior en móvil, con cabecera y pie fijos y cuerpo desplazable. **Guardar aquí** permanece en el pie y se deshabilita durante la carga de carpetas, ante un error o con un nombre inválido. Durante el guardado se bloquean cambios de destino y cierre.
- Al emitir o reemitir, el selector se abre después de cerrar la confirmación de emisión y recibe los datos devueltos por el servidor. Su subtítulo **Informe emitido · Rev. N** confirma el resultado y la revisión; no se añade un aviso flotante de emisión que pueda cubrir las acciones del pie en móvil.
- Las carpetas mantienen filas completas pulsables; las migas se ajustan al ancho y la búsqueda filtra solo las subcarpetas visibles del nivel actual. Se distinguen carga, carpeta vacía, búsqueda sin resultados y fallo con reintento.
- **Guardar PDF**, **Descargar copia** e **Imprimir** muestran su estado deshabilitado hasta emitir; **Vista previa** sigue disponible. Cancelar el selector o un fallo de guardado conserva la emisión y deja el aviso **PDF pendiente de guardar**, con **Elegir carpeta** para continuar.
- **PDF guardados** conserva nombre y contexto juntos: estado **Borrador/Emitido**, revisión, versión del borrador, fecha, carpeta y autor. El visor adapta la página al ancho disponible, permite cambiar página y zoom, y conserva descarga y apertura en otra pestaña si falla su renderizado.

## Comprobación en el servidor

1. Configurar los aprobadores con el jefe de área. Abrir un borrador y verificar que **Guardar PDF** está deshabilitado; enviarlo, aprobarlo y emitirlo. Comprobar que se abre el selector y navegar a un cliente y gestión elegidos manualmente.
2. Guardar y comprobar que el PDF aparece en esa carpeta y en **PDF guardados**.
3. Abrirlo desde otro equipo autorizado de la oficina y después desde OpenVPN.
4. Guardar otro PDF con un nombre ya utilizado y comprobar el aviso de conflicto.
5. Desde el historial, guardar otra revisión con un nombre distinto y comprobar que se conservan ambos PDF.
6. Comprobar por separado el estado de sincronización de OneDrive.

Las pruebas automáticas utilizan carpetas temporales y una persistencia simulada, sin modificar OneDrive ni la base operativa. La prueba HTTP ejercita autenticación, carga binaria y lectura protegida; la prueba de navegador cubre elección de carpeta, guardado, reintento y visor.
