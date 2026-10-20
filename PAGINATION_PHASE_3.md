# Fase 3 — Importaciones masivas persistidas y paginadas

## Auditoría y decisión

Se revisó AGENTS.md y el código actual antes de modificarlo. Matrícula y carrera
recibían un Excel tanto en preview como en ejecución; no recibían rows[] del
navegador. Devolvían el preview completo y sus tablas filtraban/ordenaban/paginaban
localmente. Se conservaron rutas de pantalla y POST, formatos Excel, permisos,
mensajes de validación y las reglas de cada dominio.

La referencia real USER_IMPORT ya persiste BulkOperation/BulkOperationRow, pagina
con findRows, comprueba propietario/tipo/estado y confirma mediante una cola y un
worker. Su documentación antigua de preview describe un contrato final anterior;
se tomó el código actual como referencia. Su lógica y frontend no se modificaron.

Se reutilizan ambas entidades genéricas, JSONB, creación transaccional con filas,
contadores, inserciones de 500 filas, ownership y findRows. Se añade una operación
síncrona genérica executeReady para bloquear y confirmar estado junto a las
escrituras del dominio. Las validaciones académicas continúan en sus servicios.
No se crean tablas o sistemas de importación paralelos.

**Regla conservada:** ambas importaciones son de todo o nada. Un preview con una
fila inválida bloquea la ejecución completa. No se cambió a importación parcial.
La ejecución revalida el estado actual de BD y la correspondencia RU/studentId.

## Tipos y migración

Tipos finales: USER_IMPORT, ENROLLMENT_IMPORT y CAREER_STUDENT_IMPORT.

El campo type es un enum real PostgreSQL, por lo que se crea
`1792526400000-AddAcademicImportTypes.ts`. Solo agrega los dos valores nuevos;
no cambia columnas ni tablas. La reversión se niega a retirar esos tipos si hay
operaciones que los utilizan, para evitar pérdida de datos/historial.

**Migración creada, no ejecutada. Debe aplicarse antes de utilizar estos flujos.**
No se ejecutaron seeds, migraciones ni importaciones reales contra la BD.

## Contratos finales

Las pantallas siguen en:

- /dashboard/enrollments/:idEnrollment/students/import
- /dashboard/admin/careers/:careerId/students/import

El envelope global permanece `status/statusCode/message/data`. Como USER_IMPORT,
el objeto preview completo se encuentra en data y contiene su propia data/meta:

```json
{
  "status": true,
  "statusCode": 200,
  "data": {
    "operationId": "00000000-0000-4000-8000-000000000001",
    "total": 10000,
    "valid": 9999,
    "invalid": 1,
    "data": [{ "row": 2, "studentId": 123, "ru": "00123456", "fullName": "Nombre Apellido", "username": "00123456", "email": "ejemplo@example.com", "status": "VALID", "errors": [] }],
    "meta": { "page": 1, "limit": 25, "total": 10000, "totalPages": 400 }
  }
}
```

El ejemplo abrevia las filas: el POST devuelve como máximo 25, no 10000. Carrera
añade currentCareer nullable a cada fila. Se mantiene row como número real de Excel.

| Flujo | Preview inicial (HTTP 200) | Páginas posteriores (GET) | Ejecución (HTTP 201) | Estado (GET) |
| --- | --- | --- | --- | --- |
| Matrícula | POST /api/enrollments/import/preview, multipart file/courseId/semesterId | /api/enrollments/import/preview/:operationId | POST /api/enrollments/import, JSON {operationId} | /api/enrollments/import/:operationId/status |
| Carrera | POST /api/careers/:careerId/students/import/preview, multipart file | /api/careers/:careerId/students/import/preview/:operationId | POST /api/careers/:careerId/students/import, JSON {operationId} | /api/careers/:careerId/students/import/:operationId/status |

Los endpoints template conservan sus contratos. No se conserva el contrato
multipart obsoleto de ejecución: se adaptaron todos sus consumidores encontrados.
El POST final no acepta filas o contexto sustituto como datos de importación.

Éxito de matrícula: `{imported, total, courseId, semesterId}`; de carrera:
`{imported, total, careerId}`. Estado: operationId, status, total, valid, invalid,
imported y failed. El resumen siempre viene de la operación persistida.

## Persistencia y paginación

1. Validar archivo/contexto y procesar el Excel con el parser RU existente.
2. Validar en el servicio del dominio y persistir operación y TODAS sus filas en
   una transacción genérica. El estado inicial es PENDING; tras confirmar filas
   se marca READY. Si falla esa transición se intenta marcar FAILED.
3. Guardar rowNumber, valid, errors y datos normalizados mínimos en data JSONB.
   No se guarda el Excel, contraseña ni hash. Carrera guarda currentCareer para
   mostrar los conflictos originales.
4. Responder la primera página mediante findRows. Las consultas siguientes no
   parsean ni vuelven a subir el archivo y no cargan todas las filas para hacer slice.

page empieza en 1; limit es 25 por defecto y admite 25/50/100 (máximo 100).
status admite all/valid/invalid. search admite hasta 200 caracteres y consulta
nombre completo, RU, username y email; carrera también consulta currentCareer.name.
ILIKE parametrizado, con comodines escapados para búsqueda literal. Búsqueda y
validez se aplican antes de LIMIT/OFFSET. Orden fijo rowNumber ASC.

Los contadores total/valid/invalid son globales del archivo. meta.total es del
conjunto filtrado; nunca se toma rows.length como total global.

## Ownership, contexto y ejecución

El propietario viene exclusivamente del JWT. Los GET preview/estado y POST final
comprueban propietario y tipo; una operación ajena, inexistente o de otro dominio
no expone datos. Carrera también exige coincidencia entre la URL y careerId guardado.
Matrícula vuelve a validar el alcance del auxiliar en materia/semestre al leer el
preview y al ejecutar, además del permiso enrollment.create del controller.
Carrera conserva el permiso career.update, sin inventar otra regla de dirección.

Matrícula guarda courseId + semesterId (el grupo está representado por Course).
Carrera guarda careerId. Ejecutar toma el destino de metadata y las filas de la
operación, sin confiar en valores o arrays editables reenviados desde frontend.
Los UUID y las queries se validan mediante DTOs/pipes existentes.

executeReady abre una transacción SERIALIZABLE y bloquea la operación por
propietario con el patrón de bloqueo ya existente. Solo READY, vigente, no vacía
y sin filas inválidas puede pasar a IMPORTING. Recupera filas válidas en consultas
de 500; revalida en el servicio de dominio y conserva sus escrituras en lotes.
Comprueba que cada RU siga resolviendo al mismo studentId validado en preview.

Se mantienen prevención de matrículas duplicadas, rol STUDENT, auditoría, carrera
NULL para asignar y verificación de filas afectadas. No se reactivan matrículas ni
se reasignan carreras. Cualquier conflicto/error revierte TODAS las escrituras.
Las filas PROCESSED, los contadores finales y COMPLETED se confirman en la misma
transacción. Repetir una operación completada devuelve conflicto. Al fallar la
transacción la operación continúa READY, sin contadores de éxito parcial.

La ejecución sigue siendo síncrona. IMPORTING no es un progreso por lotes visible
antes del commit; el GET status permite comprobar el estado durable tras la
respuesta o una interrupción de red. No se introduce BullMQ/Redis para estos flujos.
El parsing inicial y la ejecución pueden conservar el conjunto completo en memoria;
la mejora de esta fase limita las respuestas y las consultas de preview.

## Frontend

useImportPreview es un hook pequeño compartido por estos dos dominios. Reutiliza
el patrón de useUserImportPreview sin cambiarlo: adopta la primera página del POST
sin GET duplicado, conserva filas durante carga/error, permite reintentar, cancela
requests y descarta respuestas obsoletas. Debounce de búsqueda: 350 ms. Cambios de
búsqueda, validez o tamaño vuelven a página 1; se corrigen páginas fuera de rango.

Las tablas mantienen sus columnas, mensajes, componentes MUI y TablePagination
existente, con tamaños 25/50/100 y meta.total. useDataTable usa la opción remota
existente de Fase 2. Los encabezados mantienen el orden fijo del Excel en lugar de
ofrecer ordenación local sobre una página incompleta. Los antiguos helpers de
filtrado local se retiraron. Las cards de resumen no cambian con búsqueda/página.

Confirmar usa únicamente operationId (y la URL de carrera), con el bloqueo de
doble clic existente. La pantalla conserva el archivo para mostrar nombre/tamaño,
pero no lo vuelve a enviar al ejecutar.

No se añade recuperación compleja de operationId por URL/storage. La operación
backend permanece al desmontar la pantalla. No existe cleanup/expiración automática
nuevo: sin expiresAt explícito, las operaciones quedan retenidas indefinidamente.

## Verificación

- Bloque backend de importaciones: 14 suites, 188 pruebas correctas; incluye bulk,
  matrícula, carrera, contratos HTTP y regresión USER_IMPORT (preview, jobs,
  processor y worker).
- Bloque frontend de importaciones: 9 archivos, 37 pruebas correctas; incluye
  APIs, hook remoto, ambas tablas/pantallas y regresión de usuarios/polling.
- Suite general backend: 67 suites correctas, 455 pruebas correctas; 2 suites y
  9 pruebas de integración PostgreSQL omitidas por sus banderas opt-in
  RUN_GRADE_MATRIX_DB_TESTS/RUN_ACTIVITY_DB_TESTS. No hay pruebas fallidas.
- Suite general frontend: 58 archivos, 367 pruebas correctas. No hay fallos.
- Build backend correcto y build frontend correcto (26 páginas generadas).
- Lint completo de ambas aplicaciones correcto. Prettier de todos los archivos
  fuente afectados y git diff --check correctos.
- Los typechecks completos presentan únicamente los errores previos detallados
  abajo; no se ocultaron ni modificaron esas pruebas dentro de esta fase.

Comandos ejecutados por aplicación:

```text
pnpm --filter aux-system-uatf-backend exec jest --runInBand bulk-operations bulk-import-execution enrollment-import career-student-import student-import-preview student-import-http user-import users-import
pnpm --filter aux-system-uatf-backend exec jest --runInBand --silent
pnpm --filter aux-system-uatf-backend exec tsc --noEmit
pnpm --filter aux-system-uatf-backend lint
pnpm --filter aux-system-uatf-backend build
pnpm --filter aux-system-uatf-frontend exec vitest run src/api/enrollment-import.test.ts src/api/career-student-import.test.ts src/hooks/imports src/views/admin/import-previews.test.tsx src/views/admin/enrollments/import src/views/admin/careers/import src/api/user-import.test.ts src/views/super-admin/users/import src/hooks/users/userImportPolling.test.ts
pnpm --filter aux-system-uatf-frontend exec vitest run
pnpm --filter aux-system-uatf-frontend exec tsc --noEmit
pnpm --filter aux-system-uatf-frontend lint
pnpm --filter aux-system-uatf-frontend build
```

Las pruebas HTTP necesitaron acceso a localhost y el build frontend escritura en
.next. Vitest utilizó una carpeta temporal ignorada dentro de node_modules para
evitar las restricciones del temporal del entorno. No se instalaron dependencias.
No se detectaron regresiones en las suites ejecutadas.

Se prueban libros Excel reales pequeños, servicios con repositorios/transacciones
simulados, SQL generado por TypeORM y contratos HTTP Nest/interceptor/guards. Las
pruebas no son una medición de 10000 filas, ni una prueba de concurrencia/rollback
contra PostgreSQL real. La migración no fue aplicada a una base de pruebas.

Typecheck frontend completo: TS2352 previo en
`src/hooks/enrollments/useStudentAcademicRecord.test.ts:39`.
Typecheck backend completo: TS2589 en
`src/services/bulk-operations/bulk-operations-metadata.spec.ts:96` y TS2345 en
`src/services/users/user-import-jobs.spec.ts:102`. Se reprodujeron ambos contra
las fuentes originales anteriores a Fase 3 con el compilador, sin alterar el árbol
de trabajo; no se introdujeron en esta implementación. Se informan por separado.

## Archivos de Fase 3

- `apps/backend-nest/src/common/enums/bulk-operation.ts`
- `apps/backend-nest/src/common/imports/student-import-preview.ts`
- `apps/backend-nest/src/common/imports/student-import-preview.spec.ts`
- `apps/backend-nest/src/common/imports/student-import-http.spec.ts`
- `apps/backend-nest/src/common/test-mocks/bulk-import.mock.ts`
- `apps/backend-nest/src/database/migrations/1792526400000-AddAcademicImportTypes.ts`
- `apps/backend-nest/src/dtos/bulk-operations/import-preview.dto.ts`
- `apps/backend-nest/src/services/bulk-operations/bulk-operations.service.ts`
- `apps/backend-nest/src/services/bulk-operations/bulk-import-execution.spec.ts`
- `apps/backend-nest/src/dtos/enrollments/enrollment-import.dto.ts`
- `apps/backend-nest/src/controllers/enrollments/enrollment-import.controller.ts`
- `apps/backend-nest/src/controllers/enrollments/enrollment-import.controller.spec.ts`
- `apps/backend-nest/src/services/enrollments/enrollment-import.service.ts`
- `apps/backend-nest/src/services/enrollments/enrollment-import.spec.ts`
- `apps/backend-nest/src/modules/enrollments/enrollments.module.ts`
- `apps/backend-nest/src/dtos/careers/career-student-import.dto.ts`
- `apps/backend-nest/src/controllers/careers/career-student-import.controller.ts`
- `apps/backend-nest/src/controllers/careers/career-student-import.controller.spec.ts`
- `apps/backend-nest/src/services/careers/career-student-import.service.ts`
- `apps/backend-nest/src/services/careers/career-student-import.spec.ts`
- `apps/backend-nest/src/modules/careers/careers.module.ts`
- `apps/materio-dashboard/src/interfaces/import-preview.interface.ts`
- `apps/materio-dashboard/src/interfaces/enrollments/enrollment-import.interface.ts`
- `apps/materio-dashboard/src/interfaces/careers/career-student-import.interface.ts`
- `apps/materio-dashboard/src/api/enrollments.service.ts`
- `apps/materio-dashboard/src/api/careers.service.ts`
- `apps/materio-dashboard/src/api/enrollment-import.test.ts`
- `apps/materio-dashboard/src/api/career-student-import.test.ts`
- `apps/materio-dashboard/src/hooks/imports/useImportPreview.ts`
- `apps/materio-dashboard/src/hooks/imports/useImportPreview.test.ts`
- `apps/materio-dashboard/src/views/admin/import-previews.test.tsx`
- `apps/materio-dashboard/src/views/admin/enrollments/import/EnrollmentImportPage.tsx`
- `apps/materio-dashboard/src/views/admin/enrollments/import/EnrollmentImportReviewTable.tsx`
- `apps/materio-dashboard/src/views/admin/enrollments/import/enrollment-import.ts`
- `apps/materio-dashboard/src/views/admin/enrollments/import/enrollment-import.test.ts`
- `apps/materio-dashboard/src/views/admin/careers/import/CareerStudentImportPage.tsx`
- `apps/materio-dashboard/src/views/admin/careers/import/CareerStudentImportReviewTable.tsx`
- `apps/materio-dashboard/src/views/admin/careers/import/career-student-import.ts`
- `apps/materio-dashboard/src/views/admin/careers/import/career-student-import.test.ts`
- `apps/backend-nest/docs/enrollment-import.md`
- `apps/backend-nest/docs/career-student-import.md`
- `PAGINATION_PHASE_3.md`

## Validación operativa y recomendaciones posteriores

Tras aplicar la migración autorizada en el entorno correspondiente, verificar con
un archivo grande: tamaño de respuesta inicial (25 filas), GET de página 2 sin
nuevo POST, búsqueda y filtro, resumen constante y confirmación por UUID. Probar
operación de otro usuario, otra carrera, doble confirmación y cambios en BD entre
preview/ejecución. Revisar claro/oscuro en ambas pantallas. No se realizó una sesión
visual conectada a BD en esta tarea.

Para una fase posterior: medir latencia y memoria con volúmenes reales antes de
decidir asincronía; definir retención de previews antiguos y probar reversión de
la migración en una base aislada. No se inició Fase 4.
