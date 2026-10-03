# Preview de usuarios persistido y paginado (fase 2)

Solo se adapta el preview. El Excel se valida una vez por POST; las siguientes
páginas consultan PostgreSQL y no necesitan el archivo. El POST final mantiene
`file` y `roleName`, revalidación e implementación existente. No hay confirmación
por operationId ni cambios de esquema/migración. No se ejecutan migraciones, seeds
ni importación de 10k.

## Endpoints y contrato HTTP

Ambos endpoints requieren autenticación y el permiso existente `user.create`.
El propietario se obtiene de `@CurrentUser().idUser`, nunca de body/query.

- POST `/api/users/import/preview`, multipart file + roleName, HTTP 201.
  Primera página fija: page 1, limit 25.
- GET `/api/users/import/preview/:operationId`, HTTP 200. Query: page (entero >= 1,
  default 1), limit (25/50/100, default 25), status (all/valid/invalid, default all),
  search (opcional, máximo 200 caracteres). El UUID se valida con ParseUUIDPipe.
- GET template y POST `/api/users/import` conservan sus contratos anteriores.

POST y GET tienen la misma estructura, con statusCode 201 y 200 respectivamente.
Ejemplo filtrado con 3 errores, ilustrando solo una fila del array:

```json
{
  "status": true,
  "statusCode": 200,
  "data": {
    "operationId": "b73a79d0-02ca-4a3a-8a47-5516cae13e47",
    "total": 10000,
    "valid": 9997,
    "invalid": 3,
    "data": [
      {
        "row": 2,
        "name": "Carlos",
        "lastname": "Quispe Flores",
        "ci": "900000001",
        "ru": "99000001",
        "email": "student000001@example.test",
        "username": "99000001",
        "valid": false,
        "errors": ["Ya existe un usuario con este RU"]
      }
    ],
    "meta": { "page": 1, "limit": 25, "total": 3, "totalPages": 1 }
  }
}
```

El POST sin filtros para 10k devuelve 25 filas en `data.data` y meta
`{ page: 1, limit: 25, total: 10000, totalPages: 400 }`. Los contadores externos
total/valid/invalid siempre representan todo el archivo; meta.total es filtrado.
Se elimina preview.rows del contrato. row es el número Excel incluyendo encabezado;
la tabla conserva su presentación previa de row - 1.

El controller devuelve `{ data: preview }`: el interceptor existente extrae el
sobre conservando el objeto completo y su propia data/meta. No se cambia el
interceptor global; se agrega una prueba de regresión y documentación Swagger.

## Persistencia, estados y seguridad

1. Validar rol, archivo, extensión .xlsx y límite de 5 MB (también en Multer).
2. Crear USER_IMPORT PENDING con createdBy y metadata
   `{ roleName: rolNormalizado, originalFileName }`.
3. Marcar PROCESSING/startedAt. Ejecutar una sola vez el lector existente,
   conservando headers, campos, RU según rol, duplicados Excel y conflictos BD.
4. Llamar saveRows con todos los resultados normalizados. Se permite solo
   name/lastname/ci/ru/email/username en data; rowNumber/valid/errors se preservan.
   BulkOperationsService hace INSERT multivalor en chunks de 500 y confirma filas
   y contadores en una transacción, sin duplicar esa lógica en UsersService.
5. Marcar READY y consultar primera página mediante getImportPreview/findRows.

Si falla después de crear la operación se intenta marcar FAILED sin sustituir
el error original si esa actualización también falla. Filas inválidas no impiden
READY: son resultados del preview. No se genera ni persiste password/hash.

No se abre una transacción durante lectura/validación de Excel. READY se escribe
después de confirmar filas; un fallo de inserción revierte sus lotes. La operación
vacía puede quedar FAILED; un fallo posterior puede dejar filas en FAILED. El
endpoint solo consulta previews READY. No hay cleanup automático.

El endpoint verifica propiedad, type USER_IMPORT y READY. Ajena/inexistente y otro
tipo devuelven 404; un preview no READY devuelve 400. La consulta de filas vuelve
a limitar por propietario y operación. Se mantienen los cinco roles importables;
ADMIN/SUPERADMIN siguen bloqueados.

## Búsqueda SQL y frontend

Users construye Brackets con OR de `row.data ->> 'campo' ILIKE :userImportSearch`
para name, lastname, ci, ru, email y username; concat*ws también permite buscar
nombre completo. Entrada parametrizada; %, * y backslash se escapan para búsqueda
literal equivalente al includes anterior. Case-insensitive, sin quitar acentos.

findRows recibe un Brackets opcional de código interno y lo agrega como AND
agrupado; no conoce campos USER_IMPORT ni sustituye propiedad/orden/limit/offset.
Se utiliza un parámetro de dominio con nombre propio para evitar colisiones.
No se crea buscador JSONB universal ni índices JSONB sin mediciones previas.

El frontend conserva Stepper, resumen, tabla y acciones. useUserImportPreview
reutiliza el patrón de useUsersPage: debounce 350 ms, AbortController, descarte
de respuestas canceladas y vuelta a página 1 para search/status/limit. El POST
aporta primera página sin GET duplicado. Los cambios consultan backend mediante
la instancia Axios existente; las filas anteriores permanecen visibles atenuadas
durante carga, con error/reintento independiente del loading inicial.

No quedan filtros ni slice locales. Se sigue el patrón remoto de UsersTable,
con encabezado fijo y orden rowNumber del servidor. useDataTable solo ordena y
pagina en memoria, por lo que no sirve para esta página remota; no se modifica
ese hook ni se crea una abstracción genérica de tabla.

## Archivos y pruebas

Creados backend: dtos/users/users-import-preview.dto.ts,
services/users/users-import-preview.ts, services/users/users-import-preview.spec.ts
y este documento. Creado frontend: hooks/users/useUserImportPreview.ts.

Modificados backend: UsersController y test, UsersModule, UsersService,
users-import.spec.ts, BulkOperationsService, crud.service.spec.ts (solo registrar
nueva dependencia), response.interceptor.spec.ts (solo test), y enlace desde
bulk-operations.md. Modificados frontend: users.service.ts, user-import.test.ts,
user-import.interface.ts, UserImportPage.tsx, ImportReviewTable.tsx, user-import.ts
y user-import.test.ts de la pantalla.

Tests usan Excel real pequeño, repositorios simulados y SQL real de TypeORM.
Cubren creación/propiedad, metadata sin secretos, resultados persistidos, roles,
reglas, duplicados/conflictos, READY/FAILED, contadores, paginación, filtros,
búsqueda parametrizada y sobre HTTP. No son mediciones contra PostgreSQL ni tests
de estrés. Los tests frontend verifican contrato/parámetros GET y multipart final.

## Repetir la medición manual de 10.000 filas

Baseline proporcionado: POST preview 9,78 s; Response aproximadamente 1,8 MB.
No se ejecutó esta medición durante la implementación.

1. Iniciar frontend/backend y abrir `/dashboard/super-admin/users/import` con
   user.create. Usar el mismo Excel, rol, estado de BD y entorno del baseline.
2. DevTools > Network > Fetch/XHR: activar Preserve log y Disable cache, mantener
   las mismas condiciones de throttling del baseline; mostrar Method, Time y Size.
   Limpiar lista antes de cada corrida completa.
3. Seleccionar Excel de 10k y pulsar Revisar archivo. Debe haber un solo POST
   `/api/users/import/preview` y ningún GET inicial duplicado. No pulsar Importar.
4. Registrar Duration/Time y, si interesa, Waiting for server response en Timing.
   Pasar cursor sobre Size para registrar transferred y resource/body size por
   separado; comparar el mismo tipo de tamaño que el baseline considerando compresión.
5. En Preview/Response expandir data: registrar operationId, total/valid/invalid,
   data.length (25), meta.page (1), limit (25), total (10000), totalPages (400).
   El array en el JSON HTTP está en response.data.data.
6. Pulsar siguiente página: GET con el mismo operationId, page=2, limit=25,
   status=all. Registrar tiempo/tamaño/25 filas, orden ascendente posterior a
   página 1. No debe reenviarse Excel ni aparecer otro POST.
7. Escribir apellido o RU existente, esperar ~350 ms: GET con page=1 y search.
   Registrar texto, tiempo, tamaño y meta.total filtrado; probar mayúsculas/minúsculas.
8. Borrar search y elegir Con errores: GET page=1/status=invalid. Registrar tiempo,
   tamaño, valid=false y meta.total igual a errores. Las cards no cambian. Si el
   archivo no tiene errores, esperar array vacío/meta.total=0/totalPages=0.
9. Cambiar a 50/100 filas: GET page=1 con nuevo limit. Para repetir POST usar
   Elegir otro archivo y seleccionar el mismo Excel. Cada POST crea nueva operación.
   Preferir tres corridas, distinguiendo calentamiento de mediana, sin importación final.

Anotar POST (tiempo/body/filas), GET página 2 (tiempo/body/filas), búsqueda
(texto/tiempo/body/total filtrado), invalid (tiempo/body/total filtrado).
La respuesta disminuye porque solo transporta 25 filas; no se promete menor tiempo
POST, que ahora añade persistencia mientras la validación sigue siendo síncrona.
La discrepancia preexistente de username en importUsers para TEACHER/DIRECTOR/DEAN
no se modifica en esta fase; confirmación/importación por operationId queda pendiente.
