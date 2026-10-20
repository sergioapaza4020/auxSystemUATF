# Importación de matrículas de estudiantes existentes

## Modelo y destino

`Enrollment` relaciona `User`, `Course` y `Semester`. El estudiante es un usuario
activo con rol `STUDENT` activo; no existe una entidad Student independiente.
`Course.group` identifica el grupo/paralelo y `Semester` contiene gestión y periodo.
El destino es, por tanto, `courseId + semesterId`, no solamente la materia.
No se crea ninguna oferta, usuario, rol, carrera, nota ni asistencia.

No existe un catálogo de ofertas habilitadas por periodo ni un estado de cierre
de matrícula. Se exige materia y semestre activos, como en el CRUD existente.
Las fechas del semestre no se usan como ventana de inscripción: el CRUD actual
tampoco aplica esa regla. La relación antigua `UserCourse` no contiene periodo
y no se utiliza en este proceso.

## API

Todos los endpoints requieren autenticación y `enrollment.create` mediante los
guards globales. Se conserva el bypass de SUPERADMIN. Un actor con rol ASSISTANT,
sin ADMIN/SUPERADMIN, debe tener matrícula ASSISTANT activa en ese mismo destino.
Tener una asignación de auxiliar no sustituye el permiso general de creación.

- `GET /api/enrollments/import/template?courseId=10&semesterId=20`
- `POST /api/enrollments/import/preview`
- `GET /api/enrollments/import/preview/:operationId?page=1&limit=25&status=all&search=...`
- `GET /api/enrollments/import/:operationId/status`
- `POST /api/enrollments/import`

El POST preview recibe multipart con `file`, `courseId` y `semesterId`. El POST
final recibe JSON `{ "operationId": "uuid" }`; no vuelve a recibir archivo, filas
ni destino. El contexto guardado en la operación determina la ejecución.
La plantilla sigue siendo binaria y las respuestas conservan el envelope global.
Las operaciones y sus páginas son accesibles únicamente por su creador.

Preview (HTTP 200, también cuando existen filas inválidas), dentro de `data`:

```json
{
  "operationId": "00000000-0000-4000-8000-000000000001",
  "total": 1,
  "valid": 1,
  "invalid": 0,
  "data": [{
    "row": 2,
    "studentId": 123,
    "ru": "00123456",
    "fullName": "Nombre Apellido",
    "username": "00123456",
    "email": "ejemplo@example.com",
    "status": "VALID",
    "errors": []
  }],
  "meta": { "page": 1, "limit": 25, "total": 1, "totalPages": 1 }
}
```

Resultado confirmado (HTTP 201), dentro de `data`:
`{ "total": 1, "imported": 1, "courseId": 10, "semesterId": 20 }`.
Ante cualquier fila inválida, la confirmación devuelve HTTP 400 y cero inserciones.
Para volver a obtener errores por fila se debe solicitar un nuevo preview.
El filtro global de errores devuelve mensajes, no objetos adicionales del error.
Un conflicto concurrente devuelve HTTP 409; los errores internos se ocultan.

## Excel y validaciones

- Solo `.xlsx`, hasta 5 MiB, en memoria con Multer y ExcelJS ya instalados.
- Primera hoja: encabezado exacto `RU`, única columna. La plantilla coloca dos
  ejemplos ficticios en una nota del encabezado, no como estudiantes a importar.
- RU es único en `User`. Se recortan espacios exteriores; no se altera su contenido.
- Se aceptan texto y números enteros seguros no negativos; se rechazan fórmulas,
  fechas y objetos de celda. Los ceros iniciales deben conservarse como texto;
  no se reconstruyen identificadores que Excel ya convirtió a números.
- Filas vacías intermedias son inválidas y conservan su número Excel. Filas finales
  sin valores se ignoran. Una hoja sin registros se rechaza.
- Se acumulan errores: RU vacío/duplicado, usuario inexistente/inactivo/eliminado,
  rol de estudiante ausente/inactivo y matrícula ya existente.
- Matrículas inactivas o eliminadas también bloquean duplicados; no se reactivan.

## Integridad y rendimiento

Se resuelven usuarios/roles y matrículas por lotes de 500 identificadores, usando
mapas y conjuntos para las validaciones. No hay una consulta por estudiante.
Solo se seleccionan campos necesarios; nunca contraseñas.

Confirmar lee las filas normalizadas persistidas y revalida el estado de BD dentro de una única
transacción TypeORM `SERIALIZABLE`. Las inserciones de 500 filas comparten esa
transacción. Cualquier error se propaga fuera del callback para provocar rollback.

Se reutiliza `UNIQUE(id_user, id_course, id_semester)`, ya declarado por la entidad
y la migración `1787831378220-ModifyEnrollmentEntity`; también cubre matrículas de
otros roles y registros inactivos. La migración de Fase 3 amplía únicamente el enum de tipos BulkOperation. Conflictos
23505/40001/40P01 se traducen a un mensaje seguro para volver a revisar el archivo.

## Verificación

Las pruebas usan ExcelJS con libros reales y dobles de repositorios/transacciones:
validaciones, revalidación, lotes, fallo del segundo lote sin commit, permisos y
alcance del auxiliar. No constituyen una prueba de concurrencia o rollback contra
PostgreSQL real. No se ejecutan seeds ni migraciones.


## Preview persistido (Fase 3)

Se reutilizan BulkOperation/BulkOperationRow y findRows. El POST persiste todas las
filas y devuelve solo 25. GET acepta page >= 1, limit 25/50/100, status
all/valid/invalid y search (máximo 200 caracteres). Los totales externos son del
archivo completo; meta.total es filtrado. Orden fijo rowNumber ASC. Buscar/filtrar
ocurre en PostgreSQL antes del límite/offset. No hay filtros ni slice locales.

READY → IMPORTING → COMPLETED comparte una transacción SERIALIZABLE con las
matrículas y las filas PROCESSED. Una segunda ejecución devuelve conflicto. Si
falla la revalidación o una escritura, todo revierte y la operación sigue READY.
La ejecución exige cero filas inválidas, como antes; no importa parcialmente.
También se verifica que el RU siga resolviendo al mismo studentId del preview.
La lectura paginada no carga el archivo completo. El parsing y la ejecución siguen
siendo síncronos y pueden conservar el conjunto completo en memoria.

No se introduce Redis, cola ni cleanup. Las operaciones permanecen hasta una
política futura; desmontar la pantalla no las elimina. Ver el informe
[de Fase 3](../../../PAGINATION_PHASE_3.md) para contratos y verificación.
