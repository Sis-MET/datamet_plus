# Migraciones de base de datos

Los archivos se ejecutan en orden por su prefijo numérico y cada versión queda
registrada en `dbo.SCHEMA_MIGRATIONS`.

Ejecute `pnpm migrate` desde `backend`. No modifique una migración aplicada;
agregue una nueva versión para cualquier cambio posterior.

Antes de producción, realice un respaldo de la base de datos. Las migraciones
son idempotentes y se registran en `dbo.SCHEMA_MIGRATIONS`.
