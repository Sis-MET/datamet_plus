# Soporte técnico · versión 2.11.0

## Puesta en marcha

1. Aplicar las migraciones antes de publicar el frontend y reiniciar el backend: desde `backend`, ejecutar `pnpm migrate`. La nueva migración es `011_soporte_validacion.sql`; requiere las migraciones 008-010. El ejecutor registra su aplicación y la ejecuta en una transacción.
2. Comprobar en `DATA_USERS` que el responsable esté activo (`estado = 'ACTIVO'`), pertenezca a `Soporte Técnico` y tenga `cargo = 'Jefe de Area'`. Para el área y el cargo se ignoran diferencias de mayúsculas, tildes y espacios en los extremos; en el cargo también se normalizan los espacios internos. El cargo se consulta en cada operación; el JWT y el nivel de administración no conceden autorización para aprobar.
3. Conservar la configuración existente de Gemini (`GEMINI_API_KEY`, modelo principal y modelo de respaldo).
4. Ejecutar `pnpm build` en la raíz y publicar siguiendo la guía habitual del proyecto.

La migración conserva los informes ya emitidos y registra el cambio CC-2026-022. Las nuevas emisiones y todas las nuevas reemisiones requieren validación. El módulo devuelve un mensaje explícito si falta la migración 011.

## Validación y emisión

El técnico guarda su informe y selecciona **Enviar a revisión**. El jefe de área encuentra los pendientes en **Informes → Filtros → Validación por el jefe de área**, revisa datos, pruebas y fotografías y selecciona **Aprobar informe** o **Devolver con observaciones**. Para devolverlo se exige una observación de al menos diez caracteres. Después de aprobarlo se habilita **Emitir informe** para los editores del módulo.

Durante la validación pendiente o aprobada se bloquean los cambios de datos y fotografías. **Retirar para editar** vuelve al borrador y exige un nuevo envío y aprobación. La devolución con observaciones permite corregir y reenviar. Cada envío, resolución y retiro queda en el historial con usuario, fecha y revisión.

La validación contiene una huella de la fuente de ServiceMET, las correcciones y las fotografías vigentes. El servidor compara esta huella al aprobar y emitir; si ServiceMET repone datos después del envío, exige retirar y reenviar. El control de versión rechaza operaciones sobre un informe que otra persona actualizó.

**Abrir revisión** de un informe emitido inicia el mismo ciclo para su siguiente revisión: guardar, enviar, aprobar y reemitir. La revisión emitida anterior sigue disponible. Al cancelar una revisión se restauran los datos y fotos de la vigente y se retira la validación del borrador. Los PDF de informes emitidos que tienen copia usan la fuente congelada en esa copia.

## Redacción asistida

**Mejorar redacción** envía la prerredacción junto con los valores técnicos completos del servicio, las correcciones guardadas y los cambios locales validados. Se excluyen imágenes, firmas, rutas de archivos y metadatos internos. El servidor comprueba acceso, versión, estado y tipos de campos; no confía en una ficha arbitraria enviada por el navegador.

Las instrucciones piden relacionar las mediciones, valoraciones y trabajos con la sección, conservar cifras y unidades, señalar contradicciones y evitar resultados o actividades sin respaldo. La sugerencia se presenta para revisión y solo se incorpora al pulsar **Usar sugerencia**. Al guardar, el historial mantiene la marca de asistencia por IA. La respuesta respeta el límite de la columna.

## Próximos servicios y PDF

La ficha del equipo muestra capacidad máxima, unidades y hasta tres rangos, con capacidad, división de escala `d` e intervalo de verificación `e` por rango. Se usan los datos del último servicio con las correcciones del informe. Los campos vacíos o cero no crean rangos ficticios. La leyenda **Rangos incompletos** aparece cuando falta la capacidad de un rango o hay saltos en su numeración; una división `d` ausente muestra **Sin dato**, y `e` solo aparece cuando está registrado.

En **Próximos servicios**, elegir el año (por ejemplo, 2027) y pulsar **Exportar PDF**. Se puede exportar todo el año, un mes o un intervalo de meses. Se aplican los filtros de cliente, ciudad, búsqueda, tipo y situación. Los descartados se excluyen inicialmente y se pueden incluir. El archivo se genera en A4 horizontal y contiene fecha sugerida, cliente/planta, equipo/serie, capacidades/divisiones/rangos, servicio sugerido y referencias al informe y la OTST de origen. Los encabezados y el pie con **Página N de total** se repiten en cada hoja.

Solo se exportan las próximas fechas sugeridas registradas. El sistema no proyecta mantenimientos adicionales ni supone recurrencias para llenar un año. Los equipos sin fecha no aparecen en el PDF. La descarga permite elegir archivo en navegadores compatibles o usa la descarga habitual.

## Verificación

- Backend: `node --test backend/tests/*.test.js` desde la raíz. Los flujos de persistencia usan un doble de SQL y no modifican la base operativa.
- Frontend: `pnpm test` y `pnpm exec eslint .`.
- Navegador: `pnpm exec playwright test e2e/soporte.spec.js --workers=1`. Simula la API para verificar el envío/aprobación/emisión, contexto de IA, rangos, selección de períodos y descarga PDF.
- Compilación: `pnpm build`.

La migración y la respuesta real de Gemini deben comprobarse en el entorno de prueba antes de publicar; las verificaciones automatizadas no requieren conectarse a esos servicios.
