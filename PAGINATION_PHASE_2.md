# Fase 2 — Paginación por estudiante

## Alcance y auditoría inicial

Se revisaron AGENTS.md, el estado actual de Fase 1 y los consumidores antes de modificar código. Existían cambios ajenos y cambios previos en APIs/hooks de asistencia y matrículas; se mantuvieron las funcionalidades de historial, permisos y configuración.

- Roster anterior: `GET /api/enrollments/:id/students`, colección completa de matrículas activas STUDENT de la materia y semestre del auxiliar. Orden apellido/nombre; se añadió desempate por matrícula en la variante paginada.
- Resumen anterior: `GET /api/enrollments/:id/student-grade-summary`, `{scheme, students}` de todo el grupo, con consultas agrupadas por estudiante/criterio. Consumido por EnrollmentDetail/useStudentGradeSummary y por la ficha individual.
- Matriz anterior: `GET /api/grades/matrix/:id?detailId=...`, contexto, criterios, actividades, estudiantes y notas completos. Consumido por useGradeMatrix/GradeManagement/GradePlanTable. Orden de estudiantes apellido/nombre/id; actividades según ACTIVITY_ORDER.
- Asistencia anterior: GET/POST `/api/attendances/sessions/:id`; GET/PATCH/DELETE de sesiones y GET del historial. AttendancePage combinaba roster completo con marcas completas; AttendanceSheet paginaba localmente. El historial de Fase 1 se conserva.
- Búsqueda anterior: filtro local por nombre, apellido, CI/RU; asistencia también incluía username. La variante nueva busca nombre/apellido en ambos órdenes, CI, RU y username en PostgreSQL.
- Matriz: borradores por `enrollmentId:activityId`, originales acumulados y persistencia en sessionStorage por usuario/materia. Bulk de hasta 1000 celdas y descarte global. Se reutilizaron sin cambiar cálculos.
- Asistencia: estados/observaciones por matrícula, pero se reiniciaban al cambiar roster; se separaron originales visitados, borradores por matrícula y acción global pendiente.
- Marcar todos afectaba TODO el curso, incluso con búsqueda activa. Se conserva.
- Fórmulas: cada resultado usa todas las actividades activas del criterio y los totales de sesiones, sin depender del número de estudiantes visibles. Los contadores de asistencia sí requieren alcance global. No existían promedios de curso ni contadores de aprobados en esta tarjeta.
- PaginationMeta y el interceptor ya exponían `meta` en el envelope exterior; se reutilizaron.

## Contratos finales

Se mantiene el envelope `status/statusCode/message/data/meta` del interceptor. La paginación se activa cuando se envía `page`, `limit` o `search`; llamadas sin esos parámetros conservan el contrato completo anterior para compatibilidad. Todos los nuevos flujos de grupo envían parámetros explícitos.

| Endpoint | Query paginada | data | meta |
| --- | --- | --- | --- |
| GET /api/enrollments/:id/students | page, limit, search | Enrollment[] de la página | Total filtrado de estudiantes |
| GET /api/enrollments/:id/student-grade-summary | page, limit, search | scheme, students con resultados, roster con matrículas visibles | Total filtrado de estudiantes |
| GET /api/grades/matrix/:id | detailId, page, limit, search | Contexto/criterios/actividades completos; students y grades de página | Total filtrado de estudiantes |
| GET /api/attendances/sessions/:id | page, limit, search | students de página, attendances explícitas de página y contadores globales de sesión | Total filtrado de estudiantes |

`meta = {page, limit, total, totalPages}`. Backend: página 1, límite por defecto 25, máximo 100. UI: índice 0; tarjeta inicia en 10, matriz/asistencia en 25. Se mantienen opciones existentes 5/10/25 de PaginationTable, sin introducir tamaños inconsistentes.

Búsqueda por nombre, apellido, CI, RU y username antes de skip/take, sin distinción de mayúsculas, con parámetros SQL y comodines escapados. Orden estable `lastname ASC, name ASC, idEnrollment ASC`. Cambio de búsqueda o tamaño vuelve a página inicial; cambio de criterio también. Debounce 350 ms, AbortController y comprobación de cancelación antes de adoptar respuestas. Se corrigen páginas fuera de rango usando totalPages sin bucles.

La tarjeta obtiene roster y resumen de notas en una sola respuesta cuando tiene permiso de notas; sin ese permiso utiliza el endpoint de estudiantes. No descarga todo el roster para filtrar localmente. useDataTable admite una opción remota y conserva intacto su comportamiento local para otros consumidores.

## Borradores y guardado

### Grade Matrix

Se conservan claves `enrollmentId:activityId`, originales y borradores de todas las páginas/criterios. Refetch actualiza originales sin sobrescribir celdas con borrador. Guardar envía todos los cambios acumulados, con el límite existente de 1000; solo limpia tras una confirmación válida. Descartar limpia todo. Las actividades no se paginan y siguen definiendo el divisor académico. El teclado se mueve únicamente dentro de la página visible, sin cambio automático de página.

### Asistencia

useAttendanceRoster conserva originales y borradores por matrícula entre páginas y búsquedas. Se muestra el borrador por encima del servidor. Se mantienen PRESENT/EXCUSED/ABSENT, observaciones opcionales solo para EXCUSED y limpieza al pasar a PRESENT/ABSENT. El texto conserva espacios durante la edición y se normaliza al comparar/guardar.

POST `/api/attendances/sessions/:id` sigue aceptando `attendances` y añade `markAll?: AttendanceStatus`. Sin markAll guarda los dirty acumulados de todas las páginas. Con markAll aplica primero la acción al roster activo completo de esa sesión y luego las excepciones en attendances. No toma el filtro visual como alcance. La acción sigue pendiente hasta Guardar; Cancelar la descarta. La UI mantiene “Marcar todos”.

El backend valida ownership y todos los IDs, bloquea la sesión en una transacción y realiza upserts por conjuntos (bloques de hasta 1000), evitando consultas por estudiante. Lee IDs mínimos del roster para la operación global. Las ausencias sin registro siguen implícitas: no inserta ABSENT para un estudiante sin marca. Con acción global devuelve únicamente las marcas de excepciones explícitas; el frontend refresca la página y el resumen después del éxito.

## Agregados y compatibilidad

- Asistencia cuenta todo el roster activo y agrega PRESENT/EXCUSED de la sesión, sin aplicar search a esos totales. Ausentes = total − presentes − permisos. Porcentaje reutiliza attendanceSummary y el peso existente.
- Sidebar mantiene porcentaje guardado de toda la sesión; conteos incorporan deltas de borradores de todas las páginas o la intención global pendiente. Se conserva el aviso de que guardar actualiza el porcentaje.
- Resumen académico mantiene helpers, ponderaciones, assistantPercentage, promedio de actividades y contribución de asistencia. Solo reduce los IDs consultados para notas/marcas por estudiante.
- Se conservan notas individuales `/api/grades/enrollment/:id`, criterios, actividades completas y variantes legacy sin query. La ficha académica individual conserva su consumidor actual de resumen completo; optimizarlo queda fuera de esta fase.
- No se añadieron dependencias, cambios de esquema, seeds/migraciones, Redis, cursores ni cambios de theme/layout/providers.

## Verificación

- Backend: build correcto; lint correcto. Bloque de enrollments/grades/attendances/student-roster: 11 suites y 114 pruebas correctas; 6 pruebas PostgreSQL omitidas porque RUN_GRADE_MATRIX_DB_TESTS no está habilitado. No se ejecutaron seeds ni migraciones.
- Frontend: 20 archivos y 133 pruebas correctas, incluyendo tabla, resumen, matriz, asistencia, APIs, estado y cálculo. Tras el ajuste final de edición de observaciones, se repitieron sus 10 pruebas afectadas y pasaron. Tras conservar búsqueda por username y ajustar una aserción de ownership se repitió también el bloque backend de roster/resumen.
- Lint frontend completo correcto; formato de archivos frontend afectados correcto. git diff --check correcto.
- Typecheck frontend: fallo preexistente TS2352 en `src/hooks/enrollments/useStudentAcademicRecord.test.ts:39`, ajeno a los archivos modificados. No se ocultó ni corrigió dentro de esta tarea.
- Las pruebas HTTP necesitaron acceso a localhost fuera del entorno restringido; sus 13 casos pasaron. Las pruebas Vitest usaron una carpeta temporal ignorada dentro de node_modules por EPERM en el temporal del entorno.
- Build frontend: correcto (26 páginas generadas). El intento restringido falló por EPERM al escribir .next; se repitió con acceso a esa carpeta y finalizó correctamente.

Validación manual recomendada: navegar entre páginas y búsquedas en las tres pantallas; editar página 1/2 y volver; guardar/descartar; verificar sesiones con estudiantes sin marcas, permisos con observación y acciones globales con filtro activo; revisar temas claro/oscuro y navegación Enter/Tab. No se ejecutó una sesión visual contra una base de datos en esta tarea.

## Archivos de esta implementación

- `apps/backend-nest/src/common/utils/student-roster.ts`
- `apps/backend-nest/src/common/utils/student-roster.spec.ts`
- `apps/backend-nest/src/dtos/enrollments/student-roster-query.dto.ts`
- `apps/backend-nest/src/controllers/enrollments/enrollments.controller.ts`
- `apps/backend-nest/src/services/enrollments/enrollments.service.ts`
- `apps/backend-nest/src/services/enrollments/student-grade-summary.spec.ts`
- `apps/backend-nest/src/controllers/grades/grades.controller.ts`
- `apps/backend-nest/src/dtos/grades/grade-matrix.dto.ts`
- `apps/backend-nest/src/dtos/grades/grade-matrix-query.dto.ts`
- `apps/backend-nest/src/services/grades/grades.service.ts`
- `apps/backend-nest/src/services/grades/grade-matrix.spec.ts`
- `apps/backend-nest/src/controllers/attendances/attendances.controller.ts`
- `apps/backend-nest/src/dtos/attendances/attendance-save.dto.ts`
- `apps/backend-nest/src/services/attendances/attendances.service.ts`
- `apps/backend-nest/src/services/attendances/attendances.service.spec.ts`
- `apps/materio-dashboard/src/api/enrollments.service.ts`
- `apps/materio-dashboard/src/api/grade-matrix.service.ts`
- `apps/materio-dashboard/src/api/attendances.service.ts`
- `apps/materio-dashboard/src/app/dashboard/enrollments/[idEnrollment]/page.tsx`
- `apps/materio-dashboard/src/app/dashboard/enrollments/[idEnrollment]/attendance/page.tsx`
- `apps/materio-dashboard/src/hooks/enrollments/useEnrollmentStudentsPage.ts`
- `apps/materio-dashboard/src/hooks/grades/useGradeMatrix.ts`
- `apps/materio-dashboard/src/hooks/grades/useGradeMatrix.test.ts`
- `apps/materio-dashboard/src/hooks/attendances/useAttendances.ts`
- `apps/materio-dashboard/src/hooks/attendances/useAttendanceRoster.ts`
- `apps/materio-dashboard/src/hooks/table/useDataTable.ts`
- `apps/materio-dashboard/src/hooks/student-pagination.test.ts`
- `apps/materio-dashboard/src/interfaces/grades/grade-matrix.interface.ts`
- `apps/materio-dashboard/src/views/admin/enrollments/EnrollmentDetail.tsx`
- `apps/materio-dashboard/src/views/admin/enrollments/EnrollmentStudentsCard.tsx`
- `apps/materio-dashboard/src/views/admin/enrollments/EnrollmentStudentsCard.test.tsx`
- `apps/materio-dashboard/src/views/admin/enrollments/grade-management/GradeManagement.tsx`
- `apps/materio-dashboard/src/views/admin/enrollments/grade-management/GradeManagement.test.tsx`
- `apps/materio-dashboard/src/views/attendance/AttendanceSheet.tsx`
- `apps/materio-dashboard/src/views/attendance/AttendancePage.test.tsx`

- `PAGINATION_PHASE_2.md`

## Recomendaciones posteriores (sin iniciar Fase 3)

Ejecutar la regresión PostgreSQL opt-in en una base de pruebas con fixtures apropiados; medir consultas con grupos grandes antes de decidir índices adicionales. Evaluar una consulta específica para la ficha individual y retirar variantes legacy solo después de migrar todos los consumidores. No se implementó ninguna de estas extensiones.
