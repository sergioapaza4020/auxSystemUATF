# Importación asíncrona de usuarios — Fase 3

El preview de Fase 2 conserva su contrato y valida Excel una sola vez. La confirmación usa su `operationId`, sin enviar archivo, rol, propietario ni filas. El trabajo pesado se ejecuta en un contexto Nest independiente del servidor HTTP.

## Arquitectura y dependencias

```text
Frontend → API → PostgreSQL (preview, ownership, estado/progreso)
              → Redis / cola bulk-user-import
                        → Worker Nest → PostgreSQL (users, user_role, filas, progreso)
```

- Dependencias nuevas: `@nestjs/bullmq@11.0.5` y `bullmq@5.81.5`, compatibles con Nest 11 y el entorno CommonJS/Jest existente. No se añadió un cliente Redis directo ni una dependencia para limitar concurrencia.
- `UserImportQueueModule` registra únicamente la cola/productor. `UsersModule` no registra ningún consumer.
- `WorkerModule` reutiliza configuración TypeORM y todas las entidades existentes para resolver sus relaciones. No importa `AppModule`, no configura autenticación HTTP y no abre puertos.
- `src/worker.ts` usa `NestFactory.createApplicationContext`. Desarrollo y producción generan/usan `dist-worker`, separado de `dist`, para evitar que dos procesos watch borren la salida del otro.
- Cola: `bulk-user-import`; job: `user-import`; payload exclusivo: `{ operationId }`.
- PostgreSQL sigue siendo la fuente durable del preview y del progreso. Redis no contiene filas, passwords ni hashes.

## Endpoints y contratos

Todos requieren autenticación, permiso `user.create` y ownership obtenido de `@CurrentUser()`. El UUID se valida con `ParseUUIDPipe`. Operaciones ajenas, inexistentes o de otro tipo se ocultan con 404.

### POST `/api/users/import/:operationId/confirm`

Sin body ni multipart. Acepta un preview `READY`, no expirado, con al menos una fila y todas válidas. Cambia a `IMPORTING`, registra `startedAt`, encola y responde HTTP **202** sin esperar bcrypt ni inserts. La respuesta normal del interceptor es:

```json
{
  "status": true,
  "statusCode": 202,
  "data": {
    "operationId": "11111111-1111-4111-8111-111111111111",
    "status": "IMPORTING",
    "total": 10000,
    "processed": 0,
    "failed": 0,
    "progress": 0,
    "startedAt": "2026-10-02T17:00:00.000Z",
    "completedAt": null
  }
}
```

Una confirmación repetida de `IMPORTING` devuelve 202 con los contadores existentes y vuelve a asegurar la entrega del mismo job. No resetea filas, fechas ni progreso. Los estados terminales u otros estados rechazan la confirmación con 409; un preview inválido/vacío devuelve 400.

### GET `/api/users/import/:operationId/status`

HTTP 200; mismo envelope y mismos campos que confirmación, con `statusCode: 200`. No devuelve filas ni datos de usuarios. `processed` cuenta filas exitosas; `failed` cuenta errores definitivos de fila; el progreso es `(processed + failed) / total * 100` (0 para un total vacío).

Estados terminales: `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`, `EXPIRED`. Un fallo global conserva los contadores de lotes ya confirmados. `startedAt` representa aceptación de la importación, incluyendo espera en cola; `completedAt` representa su terminación.

Se conservan POST/GET de preview y GET del template. El antiguo POST `/api/users/import` responde **410 Gone** y deja de ejecutar importaciones síncronas. La pantalla nueva no lo utiliza. No se modificó globalmente `ResponseInterceptor`; se añadió una prueba de su envelope 202.

## Idempotencia, entrega y recuperación

1. Una transacción corta bloquea `BulkOperation` mediante `SELECT FOR UPDATE`, filtra también por propietario y realiza `READY → IMPORTING`. Dos confirmaciones no pueden reclamar independientemente la misma operación.
2. El `jobId` es el UUID de la operación. BullMQ conserva los jobs completados y fallidos, evitando recrearlos accidentalmente. No se implementa limpieza de jobs en esta fase.
3. PostgreSQL y Redis no comparten transacción. `IMPORTING` es la intención durable de encolado. Si Redis rechaza/falla o no confirma en cinco segundos, API devuelve 503 **sin revertir a READY**: una respuesta de Redis perdida podría haber aceptado el job.
4. El worker revisa operaciones USER_IMPORT `IMPORTING` al iniciar y cada 30 segundos, en páginas de 100; agrega los jobs ausentes con el mismo UUID. También refleja un job agotado/fallido en PostgreSQL. Este mecanismo recupera la ventana entre commit PostgreSQL y enqueue y un reinicio/pérdida de Redis. No es un cron de expiración ni polling de jobs desde el navegador.
5. Los retries consumen únicamente filas `PENDING`, ordenadas por `rowNumber`. `PROCESSED` y `FAILED` permanecen intactas. No se implementa reintento manual de filas fallidas.

## Batches, reglas y transacciones

- Batch default: **250**, configurable y validado (1–1000).
- Bcrypt default: **4 hashes simultáneos**, configurable (1–32), rounds **10**. Un conjunto acotado de promesas evita tanto hashing secuencial como 10.000 hashes simultáneos. La contraseña derivada de CI y el hash existen únicamente en memoria; el hash se inserta solo en `User.password`.
- Job concurrency default: **1** por proceso worker, configurable (1–8). No levantar múltiples réplicas pesadas durante las primeras mediciones.
- Antes de cada batch se valida el DTO persistido, la regla RU/username y los identificadores duplicados del lote. Se consultan conflictos CI/RU/email/username con una consulta SQL por conjuntos (`ANY`), incluyendo usuarios soft-deleted cuyos identificadores siguen sujetos a unicidad. Se repite la consulta dentro de la transacción para reducir la ventana de carrera. No se relee Excel ni se consulta Role por usuario.
- Se resuelve el rol activo una vez por job y se verifica/bloquea su vigencia una vez por batch. ADMIN y SUPERADMIN siguen prohibidos. STUDENT/ASSISTANT usan RU como username; TEACHER/DIRECTOR/DEAN usan CI. RU vacío se inserta como NULL/default nullable, permitiendo múltiples usuarios sin RU.
- Validación/hashing ocurren fuera de la transacción. Cada batch bloquea operación y filas pendientes por su FK, sin joins nullable en el `FOR UPDATE`; vuelve a comprobar que siguen pendientes. Luego inserta Users con una única sentencia multi-row `INSERT ... ON CONFLICT DO NOTHING RETURNING id_user, username`, asigna relaciones `user_role` en conjunto, persiste estados/errores del lote y reconstruye ambos contadores desde las filas terminales.
- Usuarios, roles, estados de fila y progreso se confirman juntos. Si falla cualquier paso, todo ese batch hace rollback; lotes anteriores se conservan. No hay una transacción de 10.000 usuarios. El próximo intento no duplica filas ya confirmadas.
- Los conflictos de negocio/validación marcan la fila `FAILED`, conservan mensajes útiles y permiten continuar. Los inserts omitidos por unicidad se identifican y registran como errores de fila. Al finalizar todo el recorrido: cero fallidos → `COMPLETED`; uno o más → `COMPLETED_WITH_ERRORS`.
- Fallos técnicos inesperados/transitorios lanzan error para BullMQ. **3 intentos**, backoff exponencial inicial **2 segundos**. El último fallo marca la operación `FAILED`; un contexto inválido (rol/tipo/estado inconsistente) usa `UnrecoverableError` y no se reintenta. Los errores enviados a Redis/logs se sanitizan para no incluir parámetros SQL/passwords/hashes.

## Configuración y arranque

En `apps/backend-nest/.env` conservar la configuración PostgreSQL/JWT existente y añadir (usar `.env.example` como referencia, sin sobrescribir secretos existentes):

```dotenv
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD= (solo si el servidor Redis requiere contraseña)
BULK_USER_IMPORT_BATCH_SIZE=250
BULK_USER_IMPORT_BCRYPT_CONCURRENCY=4
BULK_USER_IMPORT_JOB_CONCURRENCY=1
```

En Docker, API/worker usan `REDIS_HOST=redis`, definido en Compose. Redis usa `redis:7.4-alpine`, AOF, volumen `redis_data`, política `noeviction` y healthcheck. El puerto solo se publica en `127.0.0.1`, para permitir desarrollo local. El Redis de Compose es de desarrollo sin contraseña; si se configura `REDIS_PASSWORD`, configurar también autenticación del servidor correspondiente. No publicar Redis a otras interfaces.

### Migración previa al arranque

Nueva migración **1790973495493-AddCompletedWithErrors.ts**: agrega el valor al enum PostgreSQL existente. La migración histórica de Fase 1 se conserva intacta. `down` transforma ese estado a `FAILED` y recrea el enum anterior; conserva filas/contadores, pero pierde la distinción del resultado parcial. No fue ejecutada durante esta tarea.

Revisar pendientes y aplicar mediante el flujo normal del proyecto, sobre la base seleccionada explícitamente, antes de iniciar API/worker:

```powershell
pnpm --filter aux-system-uatf-backend migration:show
pnpm --filter aux-system-uatf-backend migration:run
```

### Desarrollo local con PostgreSQL existente

Desde la raíz, con Docker instalado, levantar solamente Redis (no reinicia ni sustituye PostgreSQL existente):

```powershell
docker compose up -d redis
```

En tres terminales independientes desde la raíz:

```powershell
pnpm --filter aux-system-uatf-backend dev
pnpm --filter aux-system-uatf-backend worker:dev
pnpm --filter aux-system-uatf-frontend dev
```

Frontend necesita `NEXT_PUBLIC_API_URL=http://localhost:3001` en su entorno local. `pnpm dev` raíz sigue arrancando las aplicaciones habituales; el worker se inicia explícitamente en su propia terminal. Las tareas Turbo nuevas permiten invocar `worker:dev` y `worker:build` sin convertirlo en un consumer del API.

Producción local:

```powershell
pnpm --filter aux-system-uatf-backend build
pnpm --filter aux-system-uatf-backend worker:build
pnpm --filter aux-system-uatf-backend prod
# Otra terminal:
pnpm --filter aux-system-uatf-backend worker:prod
```

### Docker con cinco servicios

Para un entorno Compose ya preparado y con sus migraciones aplicadas:

```powershell
docker compose config --quiet
docker compose up -d --build postgres redis backend worker frontend
docker compose logs -f backend worker
```

Con código fuente montado para watch:

```powershell
docker compose -f docker-compose.dev.yml config --quiet
docker compose -f docker-compose.dev.yml up -d --build postgres redis backend worker frontend
```

No usar `down -v` para preparar pruebas. Compose conserva `postgres_data` y su mount existente; se declara `PGDATA` explícitamente en esa ruta porque la imagen PostgreSQL 18 cambió su ubicación default. No cambia ni convierte la versión de datos de un volumen existente. Verificar la versión del volumen antes de reutilizarlo. La [imagen oficial documenta el cambio de PGDATA](https://hub.docker.com/_/postgres).

Backend y worker comparten Dockerfile/build, con comandos diferentes y sin montar dependencias Windows sobre el contenedor. Redis/PostgreSQL deben estar saludables antes de arrancarlos. Frontend recibe `NEXT_PUBLIC_API_URL` como build arg público, default localhost:3001. `.dockerignore` excluye dependencias, builds y archivos de secretos locales; el backend recibe su entorno con `env_file` en runtime. No se hornean passwords/JWT del `.env` dentro de la imagen.

### Verificar procesos separados

```powershell
docker compose ps
docker compose top backend worker
docker compose logs backend worker
```

API registra `API HTTP ready pid=...; no USER_IMPORT consumer`. Worker registra `Worker application context ready pid=...; no HTTP listener`, `USER_IMPORT started`, `USER_IMPORT batch committed ... processed=... failed=... total=...` y `USER_IMPORT finished`. Los PIDs pueden ser iguales en namespaces distintos: confirmar contenedores/comandos separados, no solo el número. Fuera de Docker, las terminales muestran PIDs distintos. Durante una importación, otras consultas HTTP deben continuar atendidas por API.

## Frontend

Se conserva Stepper, revisión remota, MUI y acciones. Confirmación llama únicamente al endpoint por ID. Resultado muestra contadores y barra determinate real, distingue éxito/parcial/fallo global/expiración y consulta estado cada dos segundos **después** de terminar la solicitud anterior. No hay intervalos con requests superpuestas. AbortController y cleanup cancelan solicitud/timer al desmontar. Un error temporal de consulta no se presenta como fallo definitivo de importación.

El identificador se conserva en la URL `?operationId=...` para recuperar el estado durable tras refresh, sin guardar credenciales/filas. Ante una confirmación con respuesta perdida, se consulta el estado antes de declarar que no se inició. El timeout Axios temporal de 120 segundos vuelve a su valor anterior de 10 segundos; no se aumenta ningún timeout global.

## Preparar posteriormente una prueba limpia de 10.000 usuarios

No se ejecutó una importación ni se borraron los 10.000 usuarios anteriores. Usar una base aislada para la medición (preferido), con roles/permisos/actor de pruebas preparados mediante el flujo habitual; o generar un archivo nuevo con CI, RU, email y username que no coincidan con ningún usuario existente. Cambiar solo emails no basta. Validar que el preview nuevo tenga `invalid=0` antes de confirmar. No volver a confirmar una operación terminal.

Primero verificar con un archivo pequeño: 202, progreso, usuario/rol correctos, refresh y un conflicto introducido deliberadamente entre preview y confirmación en datos de prueba. Para comprobar recuperación técnica, detener y reiniciar únicamente el worker mientras trabaja: filas confirmadas se conservan y las PENDING continúan cuando BullMQ detecta el job stalled/reintenta. Esto es una comprobación manual posterior, no realizada en esta tarea.

Para la medición de 10.000 autorizada posteriormente, DevTools → Network → Preserve log, limpiar registros, revisar archivo nuevo y confirmar:

1. POST preview: anotar Duration, tamaño Response y verificar 25 filas en `data.data`, además de resumen global 10.000. Baseline anterior: 9,78 s / aproximadamente 1,8 MB.
2. GET página 2, búsqueda y `status=invalid`: medir Duration/tamaño y comprobar paginación/filtro SQL existentes.
3. POST `/:operationId/confirm`: verificar **202**, payload sin multipart, tiempo/tamaño pequeño, `data.status=IMPORTING`. No debería permanecer abierto durante bcrypt.
4. GET `/:operationId/status`: verificar llamadas serializadas cada ~2 segundos, contadores ascendentes y porcentaje derivado de PostgreSQL. Recargar con la URL para comprobar recuperación.
5. Al llegar a un estado terminal, comprobar que se detienen las consultas y registrar tiempo completo del worker, usuarios creados y fallidos. La duración total de bcrypt puede seguir siendo elevada: la mejora es separar ese trabajo de la petición HTTP y dar progreso correcto.

## Inventario de esta fase

Creado en backend (prefijo `apps/backend-nest/`):

- `.env.example`, `tsconfig.worker.json`, `docs/user-import-async.md`.
- `src/worker.ts`, `src/worker.spec.ts`.
- `src/common/types/user-import-job.ts`, `src/core/config/bulk-import.config.ts`.
- `src/database/migrations/1790973495493-AddCompletedWithErrors.ts`.
- `src/dtos/users/user-import-status.dto.ts`.
- `src/modules/bulk-operations/user-import-queue.module.ts`.
- `src/modules/worker/worker.module.ts`, `user-import-worker.ts`, `user-import-worker.spec.ts`, `worker.module.spec.ts`.
- `src/services/users/user-import-jobs.service.ts`, `user-import-jobs.spec.ts`, `user-import-processor.ts`, `user-import-processor.spec.ts`, `user-import-rules.ts`, `user-import-concurrency.ts`.

Modificado en backend: `package.json`, `dockerfile`, `src/common/enums/bulk-operation.ts`, `src/main.ts`, `src/modules/users/users.module.ts`, `src/controllers/users/users.controller.ts`, `users.controller.spec.ts`, `src/services/users/users.service.ts`, `users-import.spec.ts`, `src/core/interceptors/response/response.interceptor.spec.ts`. `BulkOperationsService` permanece genérico y no recibió lógica de usuarios.

Creado en frontend (prefijo `apps/materio-dashboard/`): `src/hooks/users/useUserImportProgress.ts`, `userImportPolling.ts`, `userImportPolling.test.ts`.

Modificado en frontend: `dockerfile`, `src/api/users.service.ts`, `src/api/user-import.test.ts`, `src/api/config/config.ts` (únicamente timeout), `src/interfaces/users/user-import.interface.ts`, `src/views/super-admin/users/import/UserImportPage.tsx`.

Raíz: `.dockerignore` nuevo; `.gitignore` (dist-worker), `pnpm-lock.yaml`, `turbo.json`, `docker-compose.yml`, `docker-compose.dev.yml` modificados. Los cambios previos ajenos a esta fase se preservaron.

## Validación realizada

- API build y worker build: correctos. Bootstrap de contexto sin HTTP y resoluci�n del m�dulo real cubiertos con infraestructura aislada; no se inició el worker contra la base de desarrollo.
- Suite backend: 50 suites / 237 tests correctos. Incluye confirmación/ownership/estados/tipo/expiry/doble confirmación/jobId/deadline, interceptor 202, filas pendientes, batches, cuatro conflictos, cinco roles, rollback/retry, roles, contadores, resultados parciales, fallos técnicos/permanentes, recuperación de encolado, configuración y concurrencia bcrypt.
- Suite frontend: 13 archivos / 66 tests correctos; 15 tests relevantes de API/polling correctos. Confirmación sin Excel, estado/cancelación, terminales, no superposición, errores temporales y cleanup.
- TypeScript frontend (`tsc --noEmit`) y ESLint de archivos frontend modificados: correctos.
- ESLint de código/tests nuevos backend y controller/module/main/interceptor modificados: correcto. Al incluir `UsersService`, quedan seis errores preexistentes `no-base-to-string` del lector Excel de Fase 2 (líneas 257, 290–293, 302), conservados por estar fuera de esta fase.
- Metadata TypeORM y SQL de bloqueo/insert se generaron offline con entidades compiladas: límite 250, FOR UPDATE sin joins y `ON CONFLICT ... RETURNING` comprobados, sin abrir conexión.
- Ambos YAML parsean y las cinco entradas/dependencias/puerto localhost Redis están comprobadas. `docker compose config` no se pudo ejecutar porque Docker no está instalado; no se construyeron/arrancaron contenedores ni se hizo una prueba integrada Redis/PostgreSQL real.
- No se ejecutó la migración nueva, seeds, limpieza ni prueba de estrés.

Comandos utilizados (CLI por aplicación; los binarios Node explícitos evitan un problema de resolución de shims Windows en el entorno de ejecución):

```powershell
pnpm --filter aux-system-uatf-backend add @nestjs/bullmq@11.0.5 bullmq@5.81.5
pnpm --filter aux-system-uatf-backend build
pnpm --filter aux-system-uatf-backend worker:build
pnpm --filter aux-system-uatf-backend test --runInBand
pnpm --filter aux-system-uatf-backend exec node node_modules/eslint/bin/eslint.js <archivos-modificados>
pnpm --filter aux-system-uatf-frontend exec node node_modules/typescript/bin/tsc --noEmit
pnpm --filter aux-system-uatf-frontend exec node node_modules/eslint/bin/eslint.js <archivos-modificados>
pnpm --filter aux-system-uatf-frontend test
docker compose config --quiet
docker compose -f docker-compose.dev.yml config --quiet
```

Los últimos dos comandos fallaron por herramienta ausente. Vitest requirió ejecución fuera del sandbox para crear procesos; la suite pasó después. La instalación conservó versiones existentes; los warnings de peers frontend (Vitest/coverage y react-apexcharts) ya existían. `msgpackr-extract` es una optimización nativa opcional ignorada por PNPM; BullMQ dispone de fallback JavaScript.

Queda pendiente validar conexión real, aplicación de migración y recuperación tras crash con servicios levantados. Redis conserva jobs indefinidamente para idempotencia en esta fase; su retención/limpieza se decidirá posteriormente. No se implementaron Object Storage, WebSockets/SSE, edición/reintento de fallidos, otras operaciones masivas ni cleanup de expirados.
