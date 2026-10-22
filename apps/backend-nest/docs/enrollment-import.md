# Importación de estudiantes y matrículas

## Destino y autorización

La importación pertenece a `courseId + semesterId`. Los endpoints existentes requieren
`enrollment.create`, autenticación y ownership de la operación. Un ASSISTANT sin
ADMIN/SUPERADMIN necesita matrícula ASSISTANT activa en ese mismo destino.
No se otorgan permisos globales de usuarios ni se aceptan roles desde Excel.
El destino se guarda en BulkOperation y se revalida al confirmar.

## Plantillas

La plantilla nueva contiene, en este orden:

`Nombres | Apellidos | CI | RU | Email`

Para cuentas nuevas son obligatorios todos los campos y un email válido. Se recortan
espacios y se normaliza email a minúsculas, como en la importación administrativa.
El usuario será RU y la contraseña inicial será CI con bcrypt costo 10; la cuenta
recibe únicamente STUDENT. Carrera es opcional y no se infiere ni modifica.
Para estudiantes existentes basta RU; los datos suministrados no sobrescriben su cuenta.
Se sigue aceptando la plantilla antigua de una columna `RU` para cuentas existentes.
El parser compartido con importaciones de carrera permanece intacto.

Solo se acepta .xlsx de hasta 5 MiB. RU/CI admiten texto o enteros seguros no negativos;
los ceros iniciales deben conservarse como texto. Se rechazan fórmulas, fechas,
objetos de celda, columnas extra y filas vacías intermedias.

## Identidades y preview

El preview no crea usuarios ni matrículas. Las filas exponen una acción:

- CREATE_ACCOUNT: crear cuenta y matricular.
- ENROLL: usar cuenta existente y matricular.
- SKIP: matrícula STUDENT activa existente; no se duplica.
- ERROR: error real que impide confirmar el archivo completo.

RU duplicado, CI/email duplicados, identidad contradictoria, usuario inactivo/eliminado,
rol STUDENT ausente/inactivo y matrícula inactiva/eliminada/de otra participación son
conflictos. Una cuenta existente válida nunca se rechaza por existir.
El CI suministrado debe coincidir con el usuario resuelto por RU. CI/email/username
pertenecientes a otra identidad no se fusionan. Las contraseñas y demás datos de las
cuentas existentes no se modifican.

El envelope y la paginación siguen siendo los mismos. `valid` incluye filas SKIP;
`newAccounts`, `existingAccounts` y `skipped` son contadores globales adicionales.
El filtro valid incluye ejecutables y omitidas; invalid incluye solo errores.
Los previews antiguos sin acción se interpretan como ENROLL/ERROR según validez.

Los datos normalizados necesarios para confirmar se guardan en `BulkOperationRow.data.input`.
CI es un identificador personal sensible, accesible solo dentro del contexto privado de
la operación; no se incluye en las respuestas de preview de matrículas ni en resultados,
y no se almacenan hashes ni contraseñas bajo otro campo. Se conserva la política de
acceso/retención de BulkOperation. No se relaja su protección de campos sensibles.

## Confirmación e integridad

Se envía únicamente `{ operationId }`. `executeReady` bloquea la operación y ejecuta
las escrituras en una única transacción SERIALIZABLE. Se reconsultan usuarios por lotes,
identidades y matrículas antes de escribir. Si una cuenta apareció después del preview,
se reutiliza solo si su identidad es coherente. Si apareció su matrícula activa, se omite.
Un usuario existente al revisar debe conservar su ID al confirmar.

Los nuevos usuarios, su relación STUDENT, las matrículas y la finalización de la operación
se confirman juntos o se revierten juntos. Se mantienen todas las restricciones únicas.
Los conflictos 23505/40001/40P01 tienen hasta tres intentos con revalidación; si persisten
se responde 409 sin escrituras parciales. Una operación completada conserva su resultado
en metadata y repetir la confirmación devuelve ese resultado sin volver a insertar.

El resultado conserva `total`, `imported`, `courseId`, `semesterId` y agrega
`accountsCreated`, `accountsReused`, `skipped`, `errors`. `imported` cuenta matrículas
nuevas, no filas omitidas; accountsReused cuenta cuentas existentes matriculadas en
esta ejecución. Las operaciones completamente omitidas son confirmables sin inserciones.
El status conserva filas procesadas y expone también el resultado desglosado.

Frontend mantiene búsqueda/paginación del preview. La confirmación no usa el timeout
Axios general de 10 s, porque crear hashes puede tardar más; no se cambia el cliente global.

## Validación

Pruebas con libros Excel reales y dobles transaccionales cubren formatos, identidades,
cuentas nuevas/existentes, hashing real, omisiones, rollback, reintentos y ownership.
No equivalen a pruebas de concurrencia/rollback contra PostgreSQL real. Las acciones,
inputs y contadores usan JSON existente y no requieren una migración nueva. Sí debe
estar aplicada la migración previa de tipos de importación descrita a continuación.
No se ejecutan seeds ni migraciones automáticamente.

## Requisito de esquema y diagnóstico

La BD debe tener aplicada la migración existente
`AddAcademicImportTypes1792526400000`. Su `up` agrega de forma aditiva e idempotente
ENROLLMENT_IMPORT y CAREER_STUDENT_IMPORT al enum de operaciones, sin borrar registros.
Cambiar el parser o el seed no aplica esta migración automáticamente.
Si solo existe USER_IMPORT, PostgreSQL rechaza el preview antes de persistirlo con
22P02 (invalid input value for enum bulk_operations_type_enum).
Ahora esa condición responde 503 con una indicación segura de actualización pendiente;
los errores desconocidos conservan el 500 genérico. El log registra fase, tipo de error,
código y nombres de table/column/constraint; nunca SQL, parámetros, CI o contraseñas.
La pantalla conserva el mensaje seguro devuelto por el backend.

Antes de habilitar este flujo en otra BD, revisar `pnpm --filter aux-system-uatf-backend migration:show`.
Aplicar migraciones solo con autorización explícita; no usar synchronize ni recrear el enum.
No hace falta cambiar de nuevo el formato Excel para resolver este requisito.
