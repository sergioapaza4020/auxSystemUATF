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
- `POST /api/enrollments/import`

Los POST reciben multipart con `file`, `courseId` y `semesterId`. No reciben roles
ni resultados de un preview anterior. Los identificadores son enteros positivos.
La plantilla se entrega como binario `.xlsx`; los otros resultados conservan el
envoltorio global `{ status, statusCode, message, data }`.

Preview (HTTP 200, también cuando existen filas inválidas), dentro de `data`:

```json
{
  "total": 1,
  "valid": 1,
  "invalid": 0,
  "rows": [{
    "row": 2,
    "studentId": 123,
    "ru": "00123456",
    "fullName": "Nombre Apellido",
    "username": "00123456",
    "email": "ejemplo@example.com",
    "status": "VALID",
    "errors": []
  }]
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

Confirmar vuelve a leer el archivo y valida el estado de BD dentro de una única
transacción TypeORM `SERIALIZABLE`. Las inserciones de 500 filas comparten esa
transacción. Cualquier error se propaga fuera del callback para provocar rollback.

Se reutiliza `UNIQUE(id_user, id_course, id_semester)`, ya declarado por la entidad
y la migración `1787831378220-ModifyEnrollmentEntity`; también cubre matrículas de
otros roles y registros inactivos. No se necesita una migración nueva. Conflictos
23505/40001/40P01 se traducen a un mensaje seguro para volver a revisar el archivo.

## Verificación

Las pruebas usan ExcelJS con libros reales y dobles de repositorios/transacciones:
validaciones, revalidación, lotes, fallo del segundo lote sin commit, permisos y
alcance del auxiliar. No constituyen una prueba de concurrencia o rollback contra
PostgreSQL real. No se ejecutan seeds ni migraciones.
