# Fase 5 — Catálogos y materias actuales

## Resultado

Courses y GradeSchemes globales usan paginación remota en sus pantallas administrativas. Mis materias solicita las matrículas del semestre actual con una representación ligera, sin paginar unas pocas tarjetas. Careers y Permissions conservan su gestión local por el volumen justificable desde el código. Se eliminó la descarga completa de carreras para resolver el contexto de una sola.

Se leyó AGENTS.md y se auditó/revisó el código actual antes de editar. La auditoría se comunicó antes de implementar. Se preservaron los cambios existentes de las fases anteriores y se verificaron los bloques en orden: Courses, GradeSchemes, Mis materias y contexto de carrera.

## Auditoría y decisión por módulo

| Módulo                       | Estado encontrado                                                                                                                                                          | Decisión                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Courses                      | GET completo con userCourses y career; ReferenceCatalogTable filtraba código/nombre/grupo y estado localmente; el editor solo usa campos escalares. Sin paginación previa. | Tabla remota, proyección de idCourse/code/name/group/isActive sin colecciones. Orden fijo code ASC, idCourse ASC.                                                                   |
| GradeSchemes globales        | GET completo con details.gradeItem; filtros nombre/descripción y estado, sort y slice locales. Fase 1 solo había corregido reset/clamp.                                    | Tabla remota, filtros y orden escalar global en SQL. Se conservan details.gradeItem necesarios para los chips; no se cargan Activities ni Courses.                                  |
| Mis materias                 | Todas las matrículas propias activas STUDENT/ASSISTANT, sin semestre, con course.gradeScheme.details.activities y user. Solo Principal consume esa API en frontend.        | Principal pide current=true. Backend reutiliza SemestersService.getCurrentSemester, por fechas e isActive; devuelve curso/semestre/rol mínimos. Sin histórico ni paginación nuevos. |
| Careers                      | Seed de 2 carreras, catálogo institucional con faculty/director. El hook del contexto de importación descargaba todas con status=all y buscaba un ID.                      | Se mantiene local por volumen institucional reducido. El contexto ahora se resuelve mediante un filtro SQL por clave primaria.                                                      |
| Permissions                  | Seed de 102 permisos, listado sin relaciones; tabla administrativa con búsqueda, estado y grupo/prefijo locales.                                                           | Se mantiene local por volumen moderado y ligado a funcionalidades. Selector de Roles completo y agrupado, sin cambios.                                                              |
| Facultades                   | Seed de 13, relaciones careers/dean.                                                                                                                                       | Local. Con el catálogo institucional observado no hay evidencia que justifique paginación ni un cambio adicional de relaciones.                                                     |
| Roles, Semesters, GradeItems | Roles reducidos, crecimiento lento de semestres y criterios acotados.                                                                                                      | Permanecen locales. Sin cambios por uniformidad.                                                                                                                                    |

Estos volúmenes provienen de los seeds y del diseño actual, no de una medición de la base de datos de producción.

## Endpoints y contratos finales

Todos llevan el prefijo `/api` y conservan los permisos existentes.

| Endpoint                                                                                          | Comportamiento                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/courses?page=1&limit=5&search=SIS&status=all`                                               | Respuesta PaginatedApiResponse: data con la página, meta con page/limit/total/totalPages. Búsqueda por code/name/group y estado antes del offset/limit. Orden code ASC, idCourse ASC. Sin userCourses, career, gradeScheme ni enrollments.                                                         |
| GET `/courses` o con solo status                                                                  | Conserva el array anterior para compatibilidad. La tabla administrativa ya no usa esta descarga completa.                                                                                                                                                                                          |
| GET `/grade-schemes?page=1&limit=5&search=Parcial&status=all&sortBy=idGradeScheme&sortOrder=DESC` | Página con details.gradeItem. Búsqueda por nombre/descripción y estado antes de paginar. sortBy solo admite idGradeScheme/name/isActive; sortOrder ASC/DESC. Desempate por idGradeScheme DESC cuando se ordena por otro campo.                                                                     |
| GET `/grade-schemes` sin parámetros                                                               | Conserva el array anterior. Una consulta explícita de página, límite, búsqueda, estado u orden utiliza el contrato paginado.                                                                                                                                                                       |
| GET `/enrollments/my-enrollments?current=true`                                                    | Array ligero de matrículas activas propias en el semestre vigente; conserva STUDENT y ASSISTANT. Solo idEnrollment, role, isActive y campos visuales de course/semester. No carga usuario, scheme, details ni activities. Si no existe semestre vigente: array vacío. Otros errores no se ocultan. |
| GET `/enrollments/my-enrollments` sin current                                                     | Conserva el contrato histórico previo para compatibilidad. Principal ya no lo utiliza. No se añadió una pantalla de histórico.                                                                                                                                                                     |
| GET `/careers?idCareer=7&status=all`                                                              | Mismo permiso career.get-all y contrato de array, limitado por WHERE idCareer a cero/una carrera. Conserva faculty/director y contexto inactivo. El helper frontend devuelve el objeto individual o null.                                                                                          |

Los DTOs validan page >= 1 y 1 <= limit <= 100. Las tablas conservan las opciones compartidas existentes 5/10/25, con tamaño inicial 5. El estado inicial de las tablas es all; si el backend recibe una consulta paginada sin status utiliza el filtro activo habitual.

Se reutilizan PaginationMeta, PaginatedApiResponse, ResponseInterceptor y Axios existentes. No hay clientes HTTP paralelos ni nuevos sistemas de paginación.

## Compatibilidad de carrera

El GET individual `/careers/id/:idCareer` existente exige career.get-one-by-id y solo encuentra carreras activas. Sustituir directamente la lectura anterior habría cambiado tanto permisos como el contexto inactivo y habría omitido faculty en el resultado. Por eso se agregó el filtro por ID al GET existente con el mismo permiso, sin modificar el GET individual ni los permisos del sistema. El filtro se aplica en persistencia y no descarga el catálogo para hacer find en el navegador. No se cambió preview, ejecución ni reglas de importación.

## Frontend y concurrencia

useCatalogPage concentra únicamente la consulta remota compartida por estos dos catálogos: page, limit, search, status, orden cuando aplica, rows, meta, loading y error. Usa AbortController y descarta respuestas canceladas; debounce de 300 ms con búsqueda. Un cambio de búsqueda/estado/tamaño/orden vuelve a página 1; cambiar solo página conserva el resto. Una recarga tras eliminar/desactivar ajusta la página al último resultado válido.

Ambas tablas usan useDataTable en modo remote: no filtran, ordenan ni vuelven a cortar la página recibida. PaginationTable usa meta.total. Courses mantiene su orden fijo sin controles engañosos. GradeSchemes conserva los controles escalares de sort, respaldados por SQL. Los detalles para editar esquemas siguen viniendo del GET individual; las rutas y operaciones CRUD no cambiaron.

Principal y EnrollmentCard conservan su diseño y navegación por idEnrollment. Se agregó cancelación para no aplicar una respuesta después de salir/cambiar de usuario. La tarjeta no depende de relaciones eliminadas.

## Comparación conceptual

- Courses: antes todas las filas más dos colecciones; ahora 5/10/25 filas escalares y total, consultadas bajo demanda.
- GradeSchemes: antes todos los esquemas con detalles; ahora una página filtrada con sus detalles. TypeORM skip/take sobre entidades con relaciones múltiples pagina las entidades raíz y conserva sus detalles completos; getManyAndCount calcula el total filtrado.
- Mis materias: antes todas las matrículas activas históricas más esquemas y actividades; ahora las del semestre vigente y campos de tarjeta.
- Contexto de carrera: antes catálogo completo más find local; ahora búsqueda por clave primaria y a lo sumo una carrera.

No se afirma un benchmark de latencia. Las verificaciones cubren contratos, consultas construidas con metadata real de TypeORM, permisos, filtros y comportamiento de consumidores.

## Archivos modificados en esta fase

- [apps/backend-nest/src/dtos/courses/course-query.dto.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/dtos/courses/course-query.dto.ts)
- [apps/backend-nest/src/controllers/courses/courses.controller.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/controllers/courses/courses.controller.ts)
- [apps/backend-nest/src/services/courses/courses.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/courses/courses.service.ts)
- [apps/backend-nest/src/services/courses/courses-page.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/courses/courses-page.spec.ts)
- [apps/backend-nest/src/dtos/grade-schemes/grade-scheme-query.dto.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/dtos/grade-schemes/grade-scheme-query.dto.ts)
- [apps/backend-nest/src/controllers/grade-schemes/grade-schemes.controller.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/controllers/grade-schemes/grade-schemes.controller.ts)
- [apps/backend-nest/src/services/grade-schemes/grade-schemes.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/grade-schemes/grade-schemes.service.ts)
- [apps/backend-nest/src/services/grade-schemes/grade-schemes-page.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/grade-schemes/grade-schemes-page.spec.ts)
- [apps/backend-nest/src/controllers/enrollments/enrollments.controller.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/controllers/enrollments/enrollments.controller.ts)
- [apps/backend-nest/src/services/enrollments/enrollments.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/enrollments/enrollments.service.ts)
- [apps/backend-nest/src/services/enrollments/my-enrollments.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/enrollments/my-enrollments.spec.ts)
- [apps/backend-nest/src/dtos/careers/career-query.dto.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/dtos/careers/career-query.dto.ts)
- [apps/backend-nest/src/controllers/careers/careers.controller.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/controllers/careers/careers.controller.ts)
- [apps/backend-nest/src/services/careers/careers.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/careers/careers.service.ts)
- [apps/backend-nest/src/services/careers/career-context.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/services/careers/career-context.spec.ts)
- [apps/backend-nest/src/controllers/catalog-pages-http.spec.ts](D:/uatf/investigation2026/auxSystemUATF/apps/backend-nest/src/controllers/catalog-pages-http.spec.ts)
- [apps/materio-dashboard/src/interfaces/catalog-page.interface.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/interfaces/catalog-page.interface.ts)
- [apps/materio-dashboard/src/interfaces/enrollments/enrollment.interface.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/interfaces/enrollments/enrollment.interface.ts)
- [apps/materio-dashboard/src/api/courses.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/api/courses.service.ts)
- [apps/materio-dashboard/src/api/grade-scheme.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/api/grade-scheme.service.ts)
- [apps/materio-dashboard/src/api/enrollments.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/api/enrollments.service.ts)
- [apps/materio-dashboard/src/api/careers.service.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/api/careers.service.ts)
- [apps/materio-dashboard/src/hooks/useCatalogPage.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/hooks/useCatalogPage.ts)
- [apps/materio-dashboard/src/hooks/catalog-page.test.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/hooks/catalog-page.test.ts)
- [apps/materio-dashboard/src/hooks/grade-schemes/useGradeSchemes.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/hooks/grade-schemes/useGradeSchemes.ts)
- [apps/materio-dashboard/src/hooks/careers/useCareerStudentImportContext.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/hooks/careers/useCareerStudentImportContext.ts)
- [apps/materio-dashboard/src/views/admin/catalogs/ReferenceCatalogTable.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/admin/catalogs/ReferenceCatalogTable.tsx)
- [apps/materio-dashboard/src/views/admin/catalogs/CoursesTable.test.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/admin/catalogs/CoursesTable.test.tsx)
- [apps/materio-dashboard/src/views/admin/grade-schemes/GradeSchemesTable.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/admin/grade-schemes/GradeSchemesTable.tsx)
- [apps/materio-dashboard/src/views/admin/grade-schemes/GradeSchemesTable.test.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/admin/grade-schemes/GradeSchemesTable.test.tsx)
- [apps/materio-dashboard/src/views/principal/Principal.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/principal/Principal.tsx)
- [apps/materio-dashboard/src/views/principal/Principal.test.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/views/principal/Principal.test.tsx)
- [apps/materio-dashboard/src/components/principal/EnrollmentCard.tsx](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/components/principal/EnrollmentCard.tsx)
- [apps/materio-dashboard/src/api/catalog-pages.service.test.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/api/catalog-pages.service.test.ts)
- [apps/materio-dashboard/src/hooks/grade-schemes/grade-schemes-page.test.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/hooks/grade-schemes/grade-schemes-page.test.ts)
- [apps/materio-dashboard/src/hooks/careers/useCareerStudentImportContext.test.ts](D:/uatf/investigation2026/auxSystemUATF/apps/materio-dashboard/src/hooks/careers/useCareerStudentImportContext.test.ts)

Este informe es el archivo adicional `PAGINATION_PHASE_5.md`. La lista corresponde únicamente a esta fase; el árbol de trabajo contiene también cambios previos que se conservaron.

## Verificación

| Comprobación final                   | Resultado                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Backend completo                     | 75 suites aprobadas, 509 pruebas aprobadas; 2 suites / 9 pruebas PostgreSQL optativas omitidas. |
| Frontend completo                    | 65 archivos y 401 pruebas aprobadas.                                                            |
| Build backend                        | Aprobado.                                                                                       |
| Build frontend                       | Aprobado, incluidas validación de tipos y generación de rutas.                                  |
| Lint backend y frontend              | Aprobados, sin errores ni advertencias ESLint.                                                  |
| Typecheck frontend completo          | Aprobado.                                                                                       |
| Typecheck backend completo           | Solo los dos errores preexistentes indicados abajo.                                             |
| Prettier sobre archivos de esta fase | Aprobado.                                                                                       |
| git diff --check                     | Aprobado.                                                                                       |

No se detectaron regresiones en las suites ejecutadas. Los logs controlados de USER_IMPORT y el aviso PNPM sobre resolutions del paquete frontend ya existían y no se modificaron en esta fase.

- Frontend completo: 65 archivos / 401 pruebas aprobadas.
- Backend focalizado de nuevos contratos y consultas: 5 suites / 31 pruebas aprobadas; se añadió después un caso de orden ascendente por ID, cubierto en la suite final.
- Pruebas específicas de configuración del auxiliar incluidas y aprobadas junto a GradeSchemes; tests existentes de CRUD, notas, auth, imports y demás flujos se incluyen en las suites generales.
- Typecheck frontend: aprobado.
- Typecheck backend: únicamente dos errores preexistentes, detallados abajo.
- Lint de ambas aplicaciones: aprobado.
- Formato Prettier en los archivos de esta fase y git diff --check: aprobados.

Comandos ejecutados:

```text
pnpm --filter aux-system-uatf-backend exec jest --runInBand courses-page courses.service.spec
pnpm --filter aux-system-uatf-backend exec jest --runInBand grade-schemes-page grade-schemes.service.spec
pnpm --filter aux-system-uatf-backend exec jest --runInBand my-enrollments career-context careers.service.spec
pnpm --filter aux-system-uatf-backend exec jest --runInBand catalog-pages-http courses-page grade-schemes-page my-enrollments career-context
pnpm --filter aux-system-uatf-backend exec jest --runInBand
pnpm --filter aux-system-uatf-frontend exec vitest run
pnpm --filter aux-system-uatf-backend exec tsc --noEmit --incremental false
pnpm --filter aux-system-uatf-frontend exec tsc --noEmit --incremental false
pnpm --filter aux-system-uatf-backend lint
pnpm --filter aux-system-uatf-frontend lint
pnpm --filter aux-system-uatf-backend build
pnpm --filter aux-system-uatf-frontend build
```

También se ejecutaron pruebas focalizadas de las tablas, hooks de paginación, Principal, contratos API y contexto de carrera. Prettier se ejecutó con --write y --check sobre la lista de archivos de esta fase. Se utilizó un directorio temporal dentro del workspace para Vitest en Windows.

Cobertura añadida: páginas 1/2, total y límite, búsqueda/estado SQL, orden estable, proyección sin colecciones, detalles de esquemas sin Activities, inclusión de esquemas de auxiliar, allowlist de sort, metadatos HTTP, permisos sin cambios, rechazo de consultas inválidas, petición por página, reset de filtros/tamaño, debounce/cancelación y respuestas tardías, clamp tras eliminación, carga/error, CRUD de esquemas por sus endpoints originales, ambos roles de Mis materias, semestre actual sin histórico accidental, navegación de tarjetas y contexto de una carrera con cancelación.

## Fallos preexistentes y límites

- `apps/backend-nest/src/services/bulk-operations/bulk-operations-metadata.spec.ts:96`: TS2589, instanciación excesivamente profunda de tipos.
- `apps/backend-nest/src/services/users/user-import-jobs.spec.ts:102`: TS2345, unknown no asignable a Object.

Ambos ya estaban documentados al finalizar Fase 4. No se modificaron esas pruebas de importación ni se ocultaron los errores. El build backend excluye tests y puede aprobar aunque el análisis standalone completo siga señalándolos.

Las integraciones PostgreSQL optativas de Activities y Grade Matrix requieren su entorno y variables RUN_ACTIVITY_DB_TESTS / RUN_GRADE_MATRIX_DB_TESTS. No se ejecutaron migraciones ni seed para habilitarlas. No se realizó una validación manual de navegador con datos de producción.

## Riesgos pendientes y cierre

- Mantener correctamente las fechas y el estado del semestre vigente; sin uno configurado Principal mostrará el estado vacío existente.
- Las decisiones de Careers/Permissions se basan en el volumen institucional y seeds disponibles. Reevaluar si el uso real crece significativamente; el selector de permisos de Roles sigue requiriendo selección global.
- Se conservan contratos completos anteriores para consumidores externos; los consumidores administrativos optimizados usan siempre las consultas acotadas nuevas.
- Validar en el entorno real búsqueda/estado/cambio de página, edición y recarga de ambas tablas; en Principal, los dos roles y la navegación al detalle; en carrera, la resolución del ID con sus permisos existentes.

No se crearon migraciones, dependencias, cursor ni Redis; no se modificaron reglas académicas, permisos del sistema, Matrix, Attendance, ficha individual o procesos de importación. No se rediseñaron pantallas ni se modificaron theme/layout/providers/estilos globales. No se tocaron Roles, Facultades, Semesters, GradeItems o Permissions.

Con esta implementación se completa el alcance de mejoras de las Fases 1–5, manteniendo pendientes únicamente las limitaciones de verificación y defectos preexistentes señalados.
