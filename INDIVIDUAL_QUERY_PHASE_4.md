# Fase 4 — Consultas individuales

## Alcance

Se revisó AGENTS.md antes de editar. Se auditó y reportó la propuesta antes de implementar. Se conservaron los cambios existentes de las fases anteriores. No se instalaron dependencias, no se crearon ni ejecutaron migraciones, no se modificaron entidades, fórmulas académicas, reglas de asistencia, importaciones, Grade Matrix, theme, layouts, providers o estilos globales. No se inició Fase 5.

## Auditoría y decisiones

- La ficha `/dashboard/enrollments/:idEnrollment/students/:studentEnrollmentId` consultaba matrícula gestionada, esquema del auxiliar, notas, asistencia y el resumen **grupal** sin paginación. Buscaba al estudiante con `find` en ese resumen. El roster de Fase 2 ya tiene consultas paginadas; la ficha todavía utilizaba el contrato grupal anterior.
- Se conserva el roster y el resumen grupal para sus consumidores. El nuevo resumen individual utiliza el mismo cálculo backend con una matrícula validada. No depende de la página del roster, caché o navegación previa.
- `getManagedEnrollment` comprobaba acceso del auxiliar a la materia del estudiante, pero no vinculaba ambos IDs de la ruta de ficha. El nuevo resumen verifica ownership del auxiliar y matrícula de estudiante activa en la misma materia y semestre antes de calcular resultados.
- `summarizeStudentAttendance` obtenía sesiones con `attendances.enrollment`, cargando marcas de otros estudiantes, y filtraba en memoria. El resumen no utiliza observaciones ni historial. Se mantienen las comprobaciones propias/gestionadas y el error de contexto ambiguo cuando hay varios auxiliares.
- AttendanceSession no tiene `isActive` ni borrado lógico. Las sesiones existentes del contexto cuentan tal como antes; no se introdujeron filtros ficticios. Las matrículas del contexto sí deben estar activas.
- `UsersService.getOneById` cargaba `roles.permissions` y `enrollments`. Consumidores encontrados: controller de usuario, `AuthService.getSession` y comprobación de usuario en `getUserEnrollments`. Ninguno necesita esa relación de matrículas: el último consulta sus matrículas separadamente.
- El único consumidor frontend encontrado de `/users/id/:idUser` es `UserDetailsDialog`: usa datos básicos y roles, sin matrículas. Se conservan permisos anidados para compatibilidad.
- Login usa `getForAuthentication`, con selección explícita del hash; `/auth/me` y refresh utilizan `getSession`. El payload de sesión utiliza id, nombre, username, email, roles y permisos efectivos completos. AuthProvider, navegación y `hasPermission` no requieren matrículas. No se modifica el provider ni el bypass SUPERADMIN.
- La matrícula gestionada incluía también `course.gradeScheme.details.activities`, aunque la ficha utiliza el esquema del auxiliar. Se agrega una opción explícita para omitir esa relación sin cambiar el valor predeterminado. La lectura individual de notas utiliza esa misma opción durante su comprobación de acceso; las otras operaciones conservan su comportamiento.

## Endpoints y contratos finales

Todas las rutas siguientes llevan el prefijo `/api`.

| Endpoint | Resultado / cambio |
| --- | --- |
| GET `/enrollments/:idEnrollment/students/:studentEnrollmentId/grade-summary` | Nuevo. Envoltorio ResponseInterceptor habitual con `data: { scheme, student }`, un objeto de estudiante con details, totalRaw y assistantContribution. Permiso `grade.get-by-enrollment`, ownership y contexto verificados en backend. Estudiante inexistente, inactivo o fuera de materia/semestre: 404; auxiliar ajeno: 403. |
| GET `/enrollments/managed/:idEnrollment?includeCourseScheme=false` | Misma matrícula individual y permiso existente. Omite únicamente el esquema del curso. Parámetro booleano validado; por defecto `true` conserva el contrato anterior. |
| GET `/grades/enrollment/:id` | Mismo contrato, notas completas sin paginación. La comprobación de acceso evita cargar el esquema del curso. |
| GET `/attendances/student/:id` y `/attendances/student/my/:id` | Mismo resumen y permisos. Implementación agregada, sin historial ni observaciones. |
| GET `/users/id/:idUser` | Datos básicos y `roles.permissions` conservados; se omite `enrollments`, sin consumidores encontrados en el repositorio. Password sigue excluido por la entidad. |
| GET `/auth/me` | JSON sin cambios: idUser, idSession, name, username, email, roles y permissions completos. Ya no carga matrículas. |

No se retiraron endpoints existentes. El nuevo DTO e interfaz individual reutilizan los tipos de cálculo del resumen grupal sin introducir otro modelo académico.

## Asistencia y consultas

Antes: una lectura relacional hidrataba todas las sesiones y todas sus marcas, incluidas las de otros estudiantes; luego filtraba por matrícula.

Ahora, tras las comprobaciones de acceso existentes:

1. COUNT de AttendanceSession por `assistantEnrollment.idEnrollment`.
2. COUNT FILTER de PRESENT y EXCUSED de Attendance, con join de sesión, filtrando `session.id_assistant_enrollment` y `attendance.id_enrollment`.
3. Consulta existente de configuración de permiso y cálculo mediante `attendanceSummary`.

No hay consulta por sesión ni roster completo. No se selecciona observation. La unicidad sesión/matrícula existente evita contar dos marcas del mismo estudiante en una sesión.

Se conserva `absent = totalSessions - present - excused` y la fórmula compartida `(present + excused * permissionWeight) / totalSessions`, con el tratamiento existente de cero sesiones. Por ejemplo, 10 sesiones, 3 presentes y 1 permiso dejan 6 ausencias implícitas. No se crean ausencias físicas.

La ficha mantiene cinco lecturas HTTP principales, pero reemplaza el resumen de N estudiantes por uno y elimina la relación de esquema del curso que no utiliza. El cálculo de resumen limita las consultas de notas/asistencia a un ID. Usuario/sesión eliminan el join y la hidratación de matrículas. Son reducciones verificadas por contratos y SQL generado, sin afirmar tiempos de benchmark.

## Frontend

`useStudentAcademicRecord` valida primero ambos IDs mediante el resumen individual y después utiliza las lecturas individuales existentes. La página deja de llamar `useStudentGradeSummary`; un solo estado de carga/error gobierna la ficha. Una asistencia sin permiso o con error conserva las notas y muestra su mensaje existente. Se mantiene la protección contra respuestas posteriores al desmontaje.

StudentAcademicRecord recibe `summary.student`, sin búsqueda en un array grupal. Se conservan cabecera, CI/RU, criterios, actividades, asistencia, selector de representación y edición directa. La carga por URL está cubierta por pruebas de ruta y hook; no se ejecutó una sesión manual de navegador con una base de datos real.

## Archivos de esta fase

- [apps/backend-nest/src/services/attendances/attendances.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/attendances/attendances.service.ts)
- [apps/backend-nest/src/services/attendances/attendances.service.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/attendances/attendances.service.spec.ts)
- [apps/backend-nest/src/services/attendances/individual-attendance-query.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/attendances/individual-attendance-query.spec.ts)
- [apps/backend-nest/src/dtos/enrollments/student-grade-summary.dto.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/dtos/enrollments/student-grade-summary.dto.ts)
- [apps/backend-nest/src/services/enrollments/enrollments.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/enrollments/enrollments.service.ts)
- [apps/backend-nest/src/controllers/enrollments/enrollments.controller.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/controllers/enrollments/enrollments.controller.ts)
- [apps/backend-nest/src/services/enrollments/student-grade-summary.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/enrollments/student-grade-summary.spec.ts)
- [apps/backend-nest/src/services/users/users.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/users/users.service.ts)
- [apps/backend-nest/src/services/users/users-individual-query.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/users/users-individual-query.spec.ts)
- [apps/backend-nest/src/services/grades/grades.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/grades/grades.service.ts)
- [apps/backend-nest/src/services/grades/individual-grades.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/grades/individual-grades.spec.ts)
- [apps/materio-dashboard/src/interfaces/enrollments/student-grade-summary.interface.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/interfaces/enrollments/student-grade-summary.interface.ts)
- [apps/materio-dashboard/src/api/enrollments.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/api/enrollments.service.ts)
- [apps/materio-dashboard/src/api/individual-reads.test.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/api/individual-reads.test.ts)
- [apps/materio-dashboard/src/hooks/enrollments/useStudentAcademicRecord.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/hooks/enrollments/useStudentAcademicRecord.ts)
- [apps/materio-dashboard/src/hooks/enrollments/useStudentAcademicRecord.test.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/hooks/enrollments/useStudentAcademicRecord.test.ts)
- [apps/materio-dashboard/src/app/dashboard/enrollments/[idEnrollment]/students/[studentEnrollmentId]/page.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/app/dashboard/enrollments/[idEnrollment]/students/[studentEnrollmentId]/page.tsx)
- [apps/materio-dashboard/src/views/admin/enrollments/student-record/StudentAcademicRecord.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/admin/enrollments/student-record/StudentAcademicRecord.tsx)
- [apps/materio-dashboard/src/views/admin/enrollments/student-record/StudentAcademicRecord.test.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/admin/enrollments/student-record/StudentAcademicRecord.test.tsx)
- [apps/materio-dashboard/src/views/admin/enrollments/student-record/StudentRecordPage.test.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/admin/enrollments/student-record/StudentRecordPage.test.tsx)

## Verificación

| Comprobación | Resultado |
| --- | --- |
| Backend: `pnpm --filter aux-system-uatf-backend exec jest --runInBand` | 70 suites / 477 pruebas aprobadas; 2 suites / 9 pruebas de integración PostgreSQL optativas omitidas. Incluye attendance, grades, enrollments, users, auth y permisos/roles. |
| Frontend: `pnpm --filter aux-system-uatf-frontend exec vitest run` | 59 archivos / 375 pruebas aprobadas. Incluye ficha, contratos de usuario/sesión, permisos y VerticalMenu. |
| Backend focalizado asistencia/resumen | 54 pruebas aprobadas antes de avanzar al bloque de usuario. |
| Backend focalizado consultas finales | 32 pruebas aprobadas; se agregaron después 3 pruebas de notas individuales, cubiertas por la suite completa. |
| Frontend focalizado final | 7 archivos / 74 pruebas aprobadas; el caso adicional de proyección queda cubierto también por la suite completa. |
| `pnpm --filter aux-system-uatf-backend build` | Aprobado. |
| `pnpm --filter aux-system-uatf-frontend build` | Aprobado, incluidos lint y tipos de producción. |
| `pnpm --filter aux-system-uatf-frontend exec tsc --noEmit --incremental false` | Aprobado. Se corrigió la conversión de tipos del mock useState de la prueba de ficha que ya se estaba modificando. |
| `pnpm --filter aux-system-uatf-backend exec tsc --noEmit --incremental false` | Fallan únicamente los dos archivos preexistentes de pruebas de importaciones indicados abajo. |
| Lint por aplicación | Aprobado en frontend y backend. |
| Prettier en archivos de esta fase y `git diff --check` | Aprobados. |

Las omisiones PostgreSQL corresponden a `activities.integration.spec.ts` y `grade-matrix.integration.spec.ts`, habilitadas mediante RUN_ACTIVITY_DB_TESTS y RUN_GRADE_MATRIX_DB_TESTS. Las pruebas de SQL generado de esta fase verifican el mapeo TypeORM sin conectarse a una base de datos.

No se detectaron regresiones en las suites ejecutadas. Los avisos PNPM sobre resolutions en el paquete frontend y los mensajes controlados de las pruebas de importación ya existían; no se alteró esa configuración.

Cobertura añadida: equivalencia numérica de asistencia, cero sesiones, presentes, ausencia explícita e implícita, permisos 100/50/33,3/0%, filtros SQL por contexto/estudiante, ausencia de hidratación de marcas, resumen de un estudiante, contexto inválido, ownership, permisos del endpoint, proyección de matrícula y compatibilidad del valor predeterminado, notas individuales completas, rechazo de acceso, detalle de usuario sin matrículas ni hash, sesión con todos los permisos/SUPERADMIN y consulta de login con hash.

También se ejecutan las regresiones existentes de notas, matrícula, auth, roles/permisos, login, navegación, ficha y contratos de usuario. No hay test específico previo de AuthProvider o UserDetailsDialog: se cubren sus contratos de lectura, y se conserva su implementación.

## Límites y compatibilidad

- No se ejecutaron migraciones ni seed. Las pruebas de integración PostgreSQL optativas requieren configuración externa; se informa su omisión por separado.
- El análisis standalone de tipos backend arrastra errores preexistentes en `bulk-operations-metadata.spec.ts:96` (TS2589) y `user-import-jobs.spec.ts:102` (TS2345), ajenos a esta fase. No se ocultaron ni se modificaron las importaciones para resolverlos.
- La eliminación de enrollments del detalle de usuario se basa en la búsqueda de consumidores de este repositorio; no verifica clientes externos no disponibles.
- Mantener el resumen grupal sin parámetros conserva compatibilidad. La ficha ya no lo utiliza.

## Recomendación para una futura Fase 5

Medir con datos representativos los planes de consulta y la latencia real antes de decidir nuevos índices u otras optimizaciones. Ejecutar las integraciones PostgreSQL optativas en el entorno preparado y comprobar manualmente una URL directa con distintos auxiliares y semestres. No se implementó trabajo de Fase 5.
