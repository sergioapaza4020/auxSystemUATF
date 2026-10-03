# Importación de estudiantes existentes a una carrera

## Modelo

`User.careers` es una relación ManyToOne nullable hacia Career; su columna FK
también se llama `careers`. El nombre plural no significa múltiples carreras.
`Career.members` es el lado inverso. No existe Student independiente, relación por
gestión ni historial de carrera. Un estudiante válido es un User activo, no
eliminado, con rol STUDENT activo y no eliminado.

Esta importación solo rellena una carrera vacía. La pertenencia a la misma carrera
o a otra invalida la fila, incluso si la carrera anterior está inactiva o eliminada
lógicamente. El CRUD de miembros existente permite modificar la relación, pero no
define un procedimiento de traslado o historial: no se utiliza para reasignar.
No se altera Faculty, Enrollment, roles ni datos personales.

## Endpoints y permisos

- `GET /api/careers/:careerId/students/import/template`
- `POST /api/careers/:careerId/students/import/preview`
- `POST /api/careers/:careerId/students/import`

Los POST reciben un único campo multipart `file`; la carrera proviene de la URL.
El identificador debe ser un entero positivo representable como integer de BD.
Todos requieren autenticación y `career.update`, mediante los guards globales.
Se conserva el bypass SUPERADMIN. No se concede acceso por ser DIRECTOR: ese rol
necesita el permiso. El módulo actual de carreras no limita `career.update` a la
carrera dirigida por el actor; no se introduce una regla diferente en este endpoint.

## Archivo y preview

Se reutiliza el parser de RU de matrículas, extraído a
`src/common/imports/student-ru-import.ts`. El módulo de matrículas mantiene sus
exportaciones originales como alias, sin cambiar su contrato.

- XLSX válido, máximo 5 MiB, encabezado exacto `RU` en la primera hoja.
- Plantilla sin datos, ejemplos ficticios en una nota y columna con formato texto.
- RU único en User; se recortan espacios externos, se conservan ceros en texto.
- Se aceptan enteros seguros; no se interpretan fórmulas, fechas ni números imprecisos.
- Filas vacías intermedias se reportan como inválidas; las finales sin valores se ignoran.
- Se acumulan errores por archivo/fila, existencia/estado/rol del estudiante,
  duplicados, carrera actual y existencia/estado de la carrera destino.
- Preview no escribe en BD y conserva el número real de Excel (`row`).

El preview devuelve, dentro del envoltorio global `data`:

```json
{
  "total": 1,
  "valid": 0,
  "invalid": 1,
  "rows": [{
    "row": 2,
    "studentId": 123,
    "ru": "00123456",
    "fullName": "Nombre Apellido",
    "username": "00123456",
    "email": "ejemplo@example.com",
    "currentCareer": { "idCareer": 20, "name": "Ingeniería Civil" },
    "status": "INVALID",
    "errors": ["El estudiante ya pertenece a la carrera Ingeniería Civil. No se permite cambiar de carrera mediante esta importación."]
  }]
}
```

## Confirmación e integridad

Confirmar vuelve a parsear el archivo. La carrera, los estudiantes, sus roles y
sus relaciones se revalidan dentro de una transacción TypeORM SERIALIZABLE.
Una fila inválida provoca HTTP 400 antes de realizar actualizaciones.

Se consulta por lotes de 500 RU, con joins de roles y carrera actual, sin N+1.
Se actualiza en lotes de 500 IDs, únicamente `careers`, `updatedBy` y la fecha de
auditoría automática. Cada UPDATE exige carrera NULL y usuario activo/no eliminado.
Una cantidad afectada diferente de la prevista provoca rollback completo.

No es necesaria una constraint de pareja estudiante/carrera ni una entidad nueva:
la FK escalar existente ya permite como máximo una carrera por usuario. La condición
NULL y el aislamiento protegen contra asignaciones concurrentes. Conflictos de
integridad/serialización se traducen a HTTP 409 sin detalles de BD. Los errores
inesperados devuelven un mensaje genérico y no un resultado de éxito.

Éxito HTTP 201: `data: { imported, total, careerId }`.
El filtro global de errores conserva el mensaje, pero no filas adjuntas; tras un
rechazo se solicita otro preview para consultar los errores por fila.

## Verificación y límites

Las pruebas usan libros Excel reales, metadatos/SQL de TypeORM y dobles de
repositorios/transacciones. El fallo del segundo lote comprueba que no se confirma
el primero. No es una prueba de rollback o concurrencia contra PostgreSQL real.
No se requieren ni ejecutan migraciones o seeds.
