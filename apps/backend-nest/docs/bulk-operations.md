# Operaciones masivas: infraestructura interna (fase 1)

`BulkOperationsModule` exporta `BulkOperationsService` y está registrado en
`AppModule`. No publica endpoints ni modifica `/users/import`.

## Modelo

- `bulk_operations`: UUID generado en PostgreSQL (`uuid_generate_v4()`, mecanismo
  predeterminado de TypeORM), tipo, estado, propietario, contadores, metadata JSONB
  y fechas de creación, actualización, inicio, finalización y expiración.
- `bulk_operation_rows`: ID serial como las entidades existentes, FK obligatoria
  a la operación, número de fila positivo, data JSONB, valid, errors JSONB
  (`string[] | null`), estado y fecha de creación.
- La operación tiene una relación ManyToOne obligatoria con `User`, columna
  `created_by`, con `ON DELETE RESTRICT` para conservar auditoría. Las filas usan
  `ON DELETE CASCADE` respecto de la operación. No hay eliminación automática.
- No se hereda `BaseEntity`: su `createdBy: number` es incompatible con la relación
  requerida y sus campos de borrado lógico/actividad no describen este ciclo de
  vida. Se reutilizan snake_case, timestamps y decoradores de fecha del proyecto.
- Solo está habilitado `USER_IMPORT`. Agregar un tipo futuro requiere ampliar el
  enum TypeScript y crear una nueva migración del enum PostgreSQL.
- Estados de operación: PENDING, PROCESSING, READY, IMPORTING, COMPLETED, FAILED,
  EXPIRED. No se introduce una máquina compleja de transiciones.
- Estados de fila: PENDING, PROCESSED, FAILED. `valid` representa validación del
  preview; el estado representa ejecución. Una fila válida puede fallar durante
  la ejecución, de modo que son conceptos independientes. Esta fase no implementa
  un procesador ni una API de actualización de estados de fila.

## Primitivas

Todos los métodos reciben `ownerId`, que el futuro consumidor deberá obtener del
usuario autenticado, nunca del cuerpo de la solicitud. No se ofrece bypass
administrativo. Una operación inexistente o ajena devuelve el mismo 404.

- `create(dto, ownerId, rows = [])`: crea una operación PENDING; opcionalmente
  persiste sus filas iniciales de forma atómica. La FK valida que el User exista.
- `getById(operationId, ownerId)`: obtiene la operación con su propietario,
  respetando la selección de User que excluye password.
- `saveRows(operationId, ownerId, rows)`: agrega filas solo en PENDING/PROCESSING,
  calcula totalRows/validRows/invalidRows y bloquea la operación durante la escritura.
- `update(operationId, ownerId, dto)`: modifica únicamente estado, processedRows,
  failedRows, startedAt y completedAt. Los contadores son absolutos: processedRows
  cuenta éxitos y failedRows fallos, sin solapamiento; su suma no supera totalRows.
  No acepta totales de preview proporcionados por el consumidor.
- `findRows(operationId, ownerId, { page, limit, valid })`: filtra operación,
  propietario y valid en SQL; devuelve `{ data, meta: { page, limit, total,
totalPages } }`. Defaults: page 1, limit 20; límite máximo 100, parámetros enteros
  positivos. ORDER BY row_number ASC, LIMIT y OFFSET se ejecutan en PostgreSQL.
  El total corresponde al filtro; una consulta vacía devuelve totalPages 0.

`JsonObject`/`JsonValue` son tipos recursivos sin `any`. El servicio rechaza JSON
cíclico, números no finitos y claves sensibles anidadas (password, hash, token,
secret, credenciales, etc.) antes de escribir. Los consumidores deben pasar solo
datos normalizados permitidos y mensajes de error sin secretos: un campo textual
arbitrario no permite detectar automáticamente todos los posibles secretos.
No se persiste el Excel, ni contraseñas generadas, ni hashes.

## Inserción y consistencia

Se usa QueryBuilder INSERT multivalor en chunks de 500, con JSONB parametrizado;
no se llama a save por cada fila ni se ejecuta SQL construido con el contenido
del usuario. Cada llamada usa una transacción porque filas y contadores deben
confirmarse juntos. Si un chunk falla (por ejemplo, por fila duplicada), se revierte
toda esa llamada. `create` también incluye sus filas iniciales en esa transacción.

Las actualizaciones sobre operaciones existentes usan `pessimistic_write` para
evitar pérdida de contadores ante escritores concurrentes. No se mantiene una
transacción durante lectura de Excel, validación, procesamiento externo ni todo
el ciclo de vida. El consumidor puede enviar varias llamadas acotadas a saveRows;
cada una es atómica y los contadores describen las filas realmente persistidas.
No hay reintentos automáticos ni semántica de upsert: repetir rowNumber falla.

El preview se consulta con dos sentencias (datos y count) bajo aislamiento normal;
puede variar mientras otro consumidor agrega filas en PROCESSING. Los previews
READY no aceptan filas adicionales y ofrecen orden estable para paginación.

## Esquema y migración

Migración creada con el script existente `migration:create`, sin conexión a BD:
`1790926042143-AddBulkOperations.ts`. No se modifica ninguna migración histórica.

- Índices de operación: created_by, type, status, created_at, expires_at.
- Índice único de filas: (id_bulk_operation, row_number), utilizado también para
  ordenar por operación. Índices (id_bulk_operation, valid) y
  (id_bulk_operation, status). No se crean índices JSONB.
- CHECK de número de fila positivo y CHECK de contadores no negativos,
  validRows + invalidRows = totalRows, processedRows + failedRows <= totalRows.
- `down` elimina filas antes de operaciones y luego los tres enums. Se conserva
  uuid-ossp porque puede estar compartida con otras tablas. `up` requiere permiso
  para instalarla si aún no existe.

La migración no se ejecuta en esta tarea. Antes de integrar un consumidor, validar
up/down en una BD PostgreSQL de pruebas con las migraciones previas aplicadas.
Las pruebas añadidas cubren comportamiento con repositorios simulados, generación
de SQL real y metadatos TypeORM; no sustituyen una prueba de persistencia/rollback
en PostgreSQL. No requieren Redis, nuevas dependencias ni una prueba de estrés.

## Alcance de validación

Los tests cubren creación y propietario, múltiples filas, JSONB y errores múltiples,
chunks (1001 filas), fallos de inserción, bloqueo, contadores, orden SQL, páginas
1/2, límite, totales, filtros true/false, operación inexistente/ajena, rechazo de
campos sensibles y correspondencia de índices/restricciones con la migración.

Frontend: no requiere cambios ni validación funcional nueva. Backend: comprobar
build, lint de archivos nuevos y tests; aplicar la migración solo cuando sea
autorizado. Redis/BullMQ, workers, storage, búsquedas JSONB específicas, expiración
automática y adaptación de importaciones quedan para fases posteriores.

La adaptación del preview de usuarios se documenta en [fase 2](./user-import-preview.md).
