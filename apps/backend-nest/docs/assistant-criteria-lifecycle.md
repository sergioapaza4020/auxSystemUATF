# Edición de criterios del auxiliar

El `PUT /api/assistant-grade-schemes/:idAssistantGradeScheme` conserva ownership
y permisos existentes. `details` contiene la distribución vigente y debe sumar
exactamente 100%. Los porcentajes de criterios son enteros, como su columna actual en BD. `deactivateDetailIds`, opcional, identifica explícitamente los
detalles que se archivan en esa misma operación. No acepta detalles de otro
esquema, criterios retenidos ni reactivaciones.

- Omitir un criterio sin actividades (incluidas las eliminadas lógicamente),
  notas ni sesiones de asistencia asociadas permite su eliminación física.
- Omitir un criterio con esos datos devuelve 409 y un mensaje de negocio.
- Autorizar su desactivación conserva el detalle, su porcentaje anterior,
  actividades y notas; registra `isActive=false` y `archivedAt`.
- Las sesiones de asistencia pertenecen a la matrícula del auxiliar. Se
  conservan y pueden seguir registrándose para control administrativo, sin
  contribución a la nota si no existe un criterio activo de asistencia.
- La redistribución es manual. Un total inválido devuelve 400, sin escrituras.
  La actualización utiliza una transacción con bloqueo del esquema y detalles.
- El esquema registra `updatedBy` y `updatedAt`. No existen versiones históricas
  completas de los porcentajes; editar criterios activos recalcula la nota
  vigente de todos los estudiantes. No se implementa reactivación de criterios.

La respuesta separa `details` activos de `archivedDetails`. Los activos incluyen
`hasAcademicData`, `activityCount`, `gradeCount` y `attendanceSessionCount` para
informar la edición; el servidor vuelve a comprobar dependencias al guardar.
Resumen, matriz y vistas de cálculo usan el helper compartido `activeCriteria`.
Los registros históricos permanecen almacenados, sin aportar al total actual.
La API de notas conserva la consulta de registros históricos. La configuración
muestra los nombres y porcentajes anteriores de criterios archivados; no añade
un explorador de todas las notas históricas.

## Despliegue y validación

Aplicar la migración `1792620000000-ArchiveAssistantCriteria` antes de arrancar
el backend actualizado. No requiere seed ni modifica asignaciones de roles.
La migración no se ejecuta automáticamente desde este cambio. Su reversión
rechaza esquemas con criterios archivados para evitar que vuelvan a computar.

Validar con una materia de prueba: retirar un criterio vacío; intentar retirar
otro con notas; desactivarlo con redistribución a 100%; comprobar que resumen y
matriz usan los porcentajes nuevos y que las filas históricas siguen presentes.
Las pruebas unitarias usan repositorios simulados; las suites PostgreSQL
existentes requieren habilitación explícita y una BD de pruebas migrada.
