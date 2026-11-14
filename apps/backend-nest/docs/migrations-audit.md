# Auditoría integral de migraciones PostgreSQL

Fecha: 11 de noviembre de 2026, America/La_Paz. Rama inicial: `dev`.

## 1. Inventario de migraciones

Hay **22 migraciones**, con timestamps únicos y dependencias válidas en ejecución desde cero. El orden efectivo lo determina TypeORM por el timestamp de la clase, no el orden devuelto por el glob.

El [inventario completo](migrations-inventory.md) contiene tabla de archivos, timestamps, dependencias conservadoras, SHA256, tablas, ENUM, CHECK, FK, UNIQUE, índices y definición íntegra de columnas y métodos up/down. Los nombres se preservaron, incluido `RelationsBetweenActivitiesAndGraes`.

| Timestamp | Migración | Dependencia principal / resultado |
|---|---|---|
| 1784156907135 | MyFirstMigration | Base: usuarios, roles, permisos, carreras, facultades, cursos, esquemas, sesiones y tablas puente |
| 1784158316546 | ChangeNameRelationGradeDetails | Base; renombra FK/columna hacia grade_items |
| 1787831378220 | ModifyEnrollmentEntity | Base; semestres, matrículas y UNIQUE usuario/curso/semestre |
| 1787831793215 | NullableRUInUser | users; RU nullable |
| 1787854574886 | ModifyCourseRelationsEnum | user_courses y enrollments; reemplaza ENUM ASSITANT |
| 1788178632710 | AddGrades | enrollments y grade_scheme_details; notas numeric(5,2) |
| 1789015901575 | AddActivitiesEntity | grade_scheme_details; actividades |
| 1789074562933 | RelationsBetweenActivitiesAndGraes | grades y activities; FK actividad |
| 1789079384425 | AddRelationsEnrollmentToGradeScheme | enrollments y grade_schemes; esquema de auxiliar |
| 1789148941792 | AddAttendance | enrollments; sesiones y marcas, UNIQUE compuestas |
| 1790926042143 | AddBulkOperations | users; uuid-ossp, operaciones y filas JSONB |
| 1790973495493 | AddCompletedWithErrors | ENUM de operaciones |
| 1791223200000 | ActivityPublicationAndDeadline | actividades y esquemas de auxiliar; publicación y vencimiento |
| 1791317489801 | EditActivityFields | publicación anterior; reemplaza columna y reconstruye ENUM de operaciones |
| 1791547200000 | UniqueActivityGrade | grades; índice UNIQUE parcial matrícula/actividad |
| 1791655200000 | AttendanceExcusedWeight | attendances y grade_scheme_details; EXCUSED, peso y CHECK |
| 1791662400000 | AttendanceObservation | attendances; observación varchar(500) |
| 1792526400000 | AddAcademicImportTypes | ENUM operaciones; tipos de importación académica |
| 1792620000000 | ArchiveAssistantCriteria | grade_scheme_details; activo y archivado |
| 1792886400000 | AttendanceGeolocationModel | sesiones, marcas, users; configuración y evidencia GEO |
| 1794355200000 | AttendanceQrEnums | GEO; incorpora QR y requiere commit antes del siguiente paso |
| 1794355260000 | AttendanceQrChecks | ENUM QR confirmado; tres CHECK adicionales |

No hay timestamps ni clases duplicados. Hay reconstrucciones redundantes de ENUM en EditActivityFields, pero se conservan por ser históricas. No hay una migración incremental posterior que pueda proteger datos destruidos por un paso histórico anterior.

## 2. Estado del esquema: entidades versus migraciones

La inspección real `source.driver.createSchemaBuilder().log()` quedó sin consultas pendientes después de migrar. No se aplicó SQL generado ni se usó synchronize.

El [catálogo PostgreSQL exportado](migrations-schema.json) define el resultado exacto: **23 tablas incluyendo migrations, 222 columnas, 9 ENUM, 21 CHECK, 31 FK, 15 restricciones UNIQUE y 53 índices incluyendo PK/UNIQUE**. Incluye tipos, nulabilidad, defaults, longitudes, precisión, escala, reglas referenciales y expresiones de índices. No contiene datos de usuarios ni credenciales.

Se inspeccionaron las entidades de todos los dominios. La CLI carga los archivos entity del backend; la API registra las entidades con los módulos de usuarios, sesiones/auth, roles, permisos, facultades, carreras, cursos, esquemas, detalles, ítems, semestres, matrículas, notas, actividades, asistencias y operaciones masivas. Las tablas puente proceden del mismo metadata. API y worker no ejecutan migraciones al iniciar. El worker carga las entidades por su propio glob; no se cambió su arquitectura.

La comparación comprueba tipos, defaults, columnas, índices y relaciones a través de TypeORM; los catálogos y pruebas de rechazo de GEO/QR complementan la comparación de CHECK. No equivale a certificar el esquema de la base de aplicación, que no se consultó.

## 3. Problemas encontrados

| Prioridad | Archivo / causa | Impacto y resolución |
|---|---|---|
| CRÍTICO | 1791317489801-EditActivityFields: DROP/ADD publication_date | La fecha existente queda NULL. Reproducido con PostgreSQL. Conservada; bloquea actualizar desde antes de este paso con publicaciones sin un plan específico de preservación. Una migración posterior no recupera lo perdido. |
| ALTO | 1787854574886-ModifyCourseRelationsEnum: cast directo ASSITANT → ENUM sin ese valor | Falla ante datos anteriores reales. Reproducido; la transacción conserva fila, tipo e historial. Conservada; requiere reconciliación controlada previa para bases tan antiguas. |
| CRÍTICO | down históricos, especialmente GEO, AttendanceObservation, AddAttendance y relaciones/calificaciones | Eliminan evidencia, observaciones o tablas. El comando del paquete ahora los bloquea antes del down. Los archivos históricos no se reescribieron. |
| ALTO | Script migration:run con modo all por defecto y QR con override transaccional | TypeORM rechaza la ejecución o PostgreSQL no permite usar valores ENUM recién añadidos. Ejecutor del script corregido a each; estrategia del datasource no cambia. |
| ALTO | enumName explícito igual al nombre automático en cinco columnas | TypeORM instalado 0.3.30 lo introspecta como undefined y propone reconstruir cinco ENUM e índice dependiente aunque nombres/valores coinciden. Se retiró solo metadata redundante. Diff real posterior: vacío. |
| MEDIO | datasource con globs relativos solo TS | Dependencia del directorio actual; datasource compilado intentaba cargar TS. Rutas absolutas según extensión del archivo; CLI TS y JS comprobadas. |
| MEDIO | TypeORM instala extensiones durante initialize aunque synchronize=false | Se desactivó installExtensions en configuración compartida y helper temporal. uuid-ossp lo instala únicamente la migración explícita. migration:show todavía puede crear migrations: no tratarlo como consulta estrictamente de lectura. |
| ALTO, riesgo existente | CASCADE desde User/Course/Semester a Enrollment, y desde Enrollment a notas/esquemas/asistencia | Borrado físico puede eliminar registros académicos y evidencia. RESTRICT del actor no protege todas las rutas. Se reporta sin cambiar automáticamente reglas de retención. |
| MEDIO | AddCompletedWithErrors.down convierte COMPLETED_WITH_ERRORS en FAILED | Cambia significado del historial. Bloqueado por el nuevo comando de rollback. |
| MEDIO | ActivityPublicationAndDeadline retira order y convierte created_at usando zona de sesión | No garantiza conservar el orden antiguo ni una interpretación horaria única. Conservada; exigir revisión del prefijo histórico y backup al actualizar bases antiguas. |
| BAJO, opcional | Índices simples de tablas puente cuyo primer campo ya lidera una PK compuesta | Posible redundancia, sin eliminación automática ni incorporación especulativa de índices. Requiere medición de consultas/costos. |

## 4. Correcciones implementadas y archivos

- `package.json`: migration:run usa el ejecutor con preflight y each; migration:revert usa el ejecutor revisado.
- `src/database/datasource.ts`: globs absolutos TS/JS según el archivo que se ejecuta, sin cargar ambos runtimes.
- `src/core/config/database/database.config.ts`: instalación automática de extensiones desactivada.
- `src/entities/attendance/{attendance-session,attendance}.entity.ts`: se elimina enumName redundante; se preservan cambios previos y CHECK.
- `src/entities/bulk-operations/{bulk-operation,bulk-operation-row}.entity.ts`: mismo ajuste en tres columnas ENUM.
- `src/database/run-migrations.ts` y `src/database/utils/migration-preflight.ts`: detectan los dos prefijos históricos inseguros antes de ejecutar cualquier up y se detienen con MIGRATION_BLOCKED. No modifican valores ASSITANT ni descartan fechas para forzar el éxito. Se requieren escrituras detenidas durante el despliegue: el preflight no sustituye esa coordinación.
- `src/database/revert.ts` y `src/database/utils/safe-migration-revert.ts`: solo permiten revertir las dos migraciones QR revisadas, sujetas además a sus bloqueos de evidencia. Otros down requieren revisión individual y fallan explícitamente.
- `src/database/migrations-audit-postgres.spec.ts`: cadena completa, repetición, CLI, metadata, fallo transaccional, recuperación, riesgos históricos y bloqueo de rollback.
- `test/seeders-postgres.ts`: extensión automática desactivada para comprobar que la migración realmente la crea.
- Documentación: este informe, inventario y catálogo final.

No se modificó frontend, versiones, dependencias ni lockfile. No se hicieron commits ni staging. El árbol ya contenía numerosos cambios preparados, sin preparar y archivos nuevos de frontend, GEO, QR y seeders; se conservaron. Estos últimos no son implementaciones atribuibles a esta auditoría.

## 5. Migraciones nuevas

**Ninguna añadida por esta auditoría.** El esquema implementado tiene cobertura SQL y el diff final es vacío. Crear ALTER para ocultar el problema de enumName habría reconstruido tipos e índices innecesariamente. Las tres migraciones GEO/QR ya estaban presentes al empezar, aunque GEO estaba preparada y QR sin seguimiento.

## 6. Migraciones históricas y estado aplicado

Se conservaron íntegramente los 22 archivos encontrados, incluidos up/down peligrosos. No se asumió que estar versionado significa estar ejecutado. No se consultó la base de aplicación ni sus credenciales. El estado aplicado por entorno sigue **desconocido**.

Se revisó el historial Git de migraciones y la diferencia contra HEAD. Las 19 anteriores a GEO están versionadas y sin cambios locales; GEO es una adición preparada, QR son archivos nuevos. Git no demuestra qué contenido ejecutó una base. TypeORM registra id/timestamp/name en `public.migrations`, sin checksum. Comparar versiones realmente desplegadas y sus huellas con el inventario antes del despliegue; si no hay registros del artefacto anterior, no declarar probada la identidad de contenido histórico.

No se introdujo una excepción para editar historia aplicada. Para los dos problemas anteriores al esquema actual hace falta conocer la versión real y preparar una preservación específica sobre una copia restaurada; no se ejecutó una reparación especulativa.

## 7. ENUM y estado real de QR-2B

Resultado final real:

- attendance_sessions_mode_enum: MANUAL, GEOLOCATION, QR.
- attendances_registration_method_enum: MANUAL, GEOLOCATION, QR.
- attendances_status_enum: PRESENT, ABSENT, EXCUSED.
- enrollments_role_enum y user_courses_relationtype_enum: STUDENT, ASSISTANT, TEACHER, DIRECTOR, DEAN.
- bulk_operations_type_enum: USER_IMPORT, ENROLLMENT_IMPORT, CAREER_STUDENT_IMPORT.
- bulk_operations_status_enum: PENDING, PROCESSING, READY, IMPORTING, COMPLETED, COMPLETED_WITH_ERRORS, FAILED, EXPIRED.
- bulk_operation_rows_status_enum: PENDING, PROCESSED, FAILED.
- user_sessions_revoked_reason_enum: seis motivos, enumerados exactamente en el catálogo.

QR-2B **sí está implementada como persistencia**: dos migraciones, enums, CHECK, política de exclusión, documentación y pruebas. No hay flujo operativo de QR dinámico: DTO/service rechazan QR con QR_NOT_ENABLED. No se añadieron desafíos, tokens, endpoints, roles ni permisos QR. Su ejecución en la base de aplicación sigue sin verificar. Los defaults siguen MANUAL.

## 8. CHECK, FK, UNIQUE e índices

Los 21 CHECK incluyen 11 GEO/MANUAL de sesión, 4 de marca GEO, 3 QR, peso de permiso y 2 de operaciones masivas. Se preservan todas las expresiones originales. Las exigencias GEO y QR usan IS NOT NULL para impedir eludir evidencia requerida mediante UNKNOWN; los campos opcionales admiten NULL intencionadamente. Los CHECK de ventana GEO permiten borradores incompletos mientras no haya apertura; no se endurecieron reglas académicas.

Accuracy/distancia numeric(10,2) no negativas y menores que Infinity rechazan también NaN; coordenadas tienen límites. QR exige fechas finitas, presencia, actor, sesión y matrícula; prohíbe evidencia GEO en una marca QR y configuración GEO en una sesión QR. La fecha local QR usa zona explícita America/La_Paz. GEO no añade por esta auditoría la misma política de finitud para cada timestamp; ampliarla sería otra decisión de reglas.

FK y UNIQUE coinciden con metadata. Nulabilidad histórica de varias relaciones se conserva: un UNIQUE con NULL permite varias filas sin toda su identidad. No se convirtió a NOT NULL sin conocer datos y regla de negocio. Matrícula UNIQUE(usuario,curso,semestre), sesión UNIQUE(auxiliar,fecha), marca UNIQUE(sesión,matrícula), esquema de auxiliar UNIQUE(matrícula); nota UNIQUE parcial(matrícula,actividad) cuando actividad no es NULL. Usuarios, roles, permisos e ítems conservan sus claves únicas. No se inventaron UNIQUE de código/grupo de curso o año/período de semestre.

El catálogo lista las 31 FK con ON DELETE/UPDATE exactos. Grades, actividades, esquemas y asistencia tienen rutas CASCADE; actor de marca y creador de operación usan RESTRICT; otras relaciones conservan NO ACTION. No se alteraron políticas de borrado sin decisión institucional. Usar desactivación y evitar borrado físico hasta definir retención.

Los índices finales coinciden con metadata. No se añadieron índices FK por su nombre; faltan mediciones/EXPLAIN de carga real para justificar índices adicionales. Un UNIQUE/PK ya crea su índice. La reconstrucción redundante de ENUM en EditActivityFields recrea el índice de filas por operación/estado sin duplicarlo.

## 9. TypeORM CLI, runtime y transacciones

Datasource CLI y seeds: `src/database/datasource.ts`, configuración compartida `src/core/config/database/database.config.ts`. Variable requerida: DATABASE_URL (PostgreSQL). dotenv carga el entorno desde el directorio de ejecución; los scripts PNPM se ejecutan en apps/backend-nest. ConfigModule de API también usa su .env; asegurar la misma DATABASE_URL inyectada en API, worker, CLI y seeds durante despliegue, sin imprimirla.

No hay migrationsTableName explícito: TypeORM usa `migrations` en esquema public por defecto. synchronize=false; migrationsRun no habilitado. El datasource conserva la estrategia predeterminada all para llamadas directas, mientras **el ejecutor del script migration:run especifica each**. Las dos migraciones QR tienen transaction=true y necesitan un commit entre ellas; cada migración falla o confirma como unidad. Si falla la segunda, la primera permanece registrada y se reanuda sin fake ni borrar historial.

Se comprobó la CLI TS real contra el clúster aislado y la CLI JS contra dist tras build. El datasource compilado ahora carga JS exclusivamente. TypeORM efectivamente instalado: 0.3.30, permitido por el rango del manifiesto; no se actualizó ninguna versión.

Importante: migration:show de TypeORM crea migrations si falta. No usarlo en la aplicación bajo la autorización exclusivamente de lectura de esta tarea; consultar el historial con SQL dentro de una transacción READ ONLY.

## 10. Ejecución desde cero

PostgreSQL 16 local, clúster nuevo creado por initdb, directorio temporal único y puerto dinámico en 127.0.0.1, usuario seeders_test, base postgres, esquema public. El helper no lee DATABASE_URL y verifica data_directory y puerto contra sus valores recién creados. No usa la instancia de aplicación. Se detiene y elimina únicamente el directorio temporal verificado.

Las 22 migraciones se ejecutaron con each. uuid-ossp está declarado en AddBulkOperations; se prueba sin instalación automática en initialize. No hubo dependencias rotas en base vacía.

## 11. Actualización incremental y conservación

Las pruebas QR parten de las 20 migraciones anteriores, insertan usuarios, curso, semestre, matrículas, sesiones MANUAL/GEO y marcas EXCUSED/GEO con evidencia. Ejecutan las dos pendientes y comparan filas, columnas y CHECK históricos antes/después. Los seeders también comprueban conservación de registros académicos y datos existentes.

Se reprodujeron por separado dos prefijos históricos: cuatro migraciones + fila ASSITANT y trece migraciones + actividad publicada. El primero falla atómicamente en la quinta; el segundo demuestra pérdida de publication_date en la decimocuarta. Las pruebas afirman explícitamente esos resultados para evitar una falsa certificación. Por tanto no se certifica la actualización de **cualquier** versión anterior.

## 12. Idempotencia

La segunda ejecución del ejecutor devuelve cero migraciones. La CLI real responde `No migrations are pending`. No se duplican restricciones. Los seeds se ejecutan inicialmente y dos veces adicionales sin duplicar entidades ni relaciones. Esto es idempotencia mediante historial y claves de negocio; no significa que ejecutar manualmente cada up repetido sea válido.

## 13. Rollback, fallo intermedio y recuperación

Pruebas QR: down/down/up/up, bloqueo con sesiones QR o evidencia QR, bloqueo por dependencias desconocidas y conservación de CHECK/defaults/evidencia histórica. Sus métodos exigen transacción y bloquean ambas tablas antes de comprobar datos. No usan DROP CASCADE.

Prueba nueva: migración exclusivamente temporal crea una tabla y falla; each revierte la tabla y no añade historial. Se retira el fallo de la lista temporal y se reejecuta correctamente. También se comprueba que el wrapper permite las dos reversiones QR sin datos QR y bloquea la siguiente histórica GEO antes de tocar historial.

No se ejecutó down destructivo de GEO, notas, matrículas o publicaciones para probar pérdida. Se auditó estáticamente y se bloqueó su uso mediante el script. El acceso directo a la CLI sigue siendo una herramienta administrativa capaz de saltarse el wrapper: no usar migration:revert directo en despliegue. Recuperación real: corrección hacia adelante o restauración ensayada; no revertir automáticamente una cadena académica.

## 14. Seeders

Se conservaron los cambios previos de seed-runner y seeders. El runner exige historial y ausencia de pendientes, usa transacción por unidad, detiene la cadena ante error y restringe demo a development/test con opt-in. Orden: permisos, facultades, ítems, esquemas, semestres, detalles, cursos, carreras, roles, usuarios demo y matrículas demo. Las pruebas PostgreSQL existentes cubren idempotencia, referencias, conflictos, passwords y conservación académica.

Los seeds modifican catálogos/permisos: que sean idempotentes no los convierte en lectura ni autoriza su ejecución en producción. No se ejecutaron en la aplicación. No se añadieron seeds destructivos.

## 15. Seguridad de datos

**No se conectó ni modificó la base de aplicación.** No se ejecutaron migration:run, revert, seeds, DDL ni DML contra ella. Todas las escrituras PostgreSQL fueron sobre clústeres temporales verificados. No se usaron DROP DATABASE, DROP SCHEMA, TRUNCATE, synchronize=true, fake, borrado de historial o reinicios de secuencia en la aplicación. Las operaciones de limpieza/datos de fixtures pertenecen exclusivamente a pruebas aisladas.

## 16. Pruebas

Resultados finales y comandos de verificación se registran en la sección de validación al final. Un primer intento restringido no permitió iniciar initdb ni conexiones HTTP locales; se repitió fuera de esa restricción, siempre con aislamiento verificado. Dos fallos iniciales de las pruebas nuevas se debieron al orden no garantizado del array source.migrations; el test ahora ordena por timestamp antes de preparar prefijos, igual que el ejecutor. No se atribuyen esos fallos al historial del repositorio.

Quedaron omitidas nueve pruebas existentes: tres de activities.integration y seis de grade-matrix.integration. Exigen RUN_ACTIVITY_DB_TESTS/RUN_GRADE_MATRIX_DB_TESTS y fixtures en el datasource de aplicación; no se habilitaron contra esa base. No se certifican esas dos suites opt-in ni Redis/colas reales. Las pruebas aisladas de migraciones, notas preservadas por seeds, GEO y QR sí se ejecutaron. No hubo pruebas en la base de aplicación.

## 17. Lint, TypeScript, build y formato

Se ejecutaron los scripts reales del backend y tsc --noEmit. No se usó check-types raíz ni se corrigieron archivos frontend. Ver resultados finales abajo. La advertencia PNPM sobre resolutions en el paquete frontend ya existía y no se cambió.

## 18. Comandos reales

Desde la raíz del monorepo. **Solo lectura de la base de aplicación**, con conexión de solo lectura autorizada y URL inyectada sin escribir credenciales en el comando:

```powershell
psql "$env:DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_database(), current_schema(), inet_server_addr(), inet_server_port(), current_setting('TimeZone'); SELECT to_regclass('public.migrations'); COMMIT;"
# Ejecutar el siguiente únicamente si public.migrations existe:
psql "$env:DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT id, timestamp, name FROM public.migrations ORDER BY timestamp; COMMIT;"
```

Para metadatos usar los SELECT de catálogo del test, rodeados por BEGIN READ ONLY/COMMIT. Comparar nombres/timestamps con inventario y esquema; una fila del historial por sí sola no demuestra su contenido SQL.

**CLI para entorno aislado o despliegue futuro expresamente autorizado**. DATABASE_URL debe estar configurada al destino validado. show puede crear historial; run modifica esquema/datos; seed modifica datos; revert modifica esquema y está restringido por el wrapper.

```powershell
pnpm --filter aux-system-uatf-backend migration:show
pnpm --filter aux-system-uatf-backend migration:run
pnpm --filter aux-system-uatf-backend migration:revert
pnpm --filter aux-system-uatf-backend seed
# Solo fixtures demo aislados:
$env:NODE_ENV='test'
$env:SEED_DEMO_DATA='true'
pnpm --filter aux-system-uatf-backend seed
```

El script run impone each en el ejecutor; acepta opcionalmente --transaction each y rechaza otras opciones. Llamar directamente a DataSource.runMigrations requiere `{ transaction: 'each' }`. No aplicar migration:generate automáticamente: usar el modo de inspección del test.

CLI compilada, después de build y desde el directorio backend mediante PNPM:

```powershell
pnpm --filter aux-system-uatf-backend exec typeorm migration:show -d dist/database/datasource.js
pnpm --filter aux-system-uatf-backend exec node dist/database/run-migrations.js
# Wrapper compilado, con las mismas restricciones de rollback:
pnpm --filter aux-system-uatf-backend exec node dist/database/revert.js
```

Pruebas y verificaciones, sin configurar DATABASE_URL de aplicación:

```powershell
$env:MIGRATION_TEST_PG_BIN='C:/Program Files/PostgreSQL/16/bin'
$env:ATTENDANCE_TEST_PG_BIN=$env:MIGRATION_TEST_PG_BIN
$env:SEED_TEST_PG_BIN=$env:MIGRATION_TEST_PG_BIN
pnpm --filter aux-system-uatf-backend build
$env:MIGRATION_AUDIT_COMPILED='true'
pnpm --filter aux-system-uatf-backend test --runInBand
pnpm --filter aux-system-uatf-backend test --runInBand migrations-audit-postgres attendance-qr-postgres attendance-geolocation-postgres seeders-postgres
pnpm --filter aux-system-uatf-backend exec tsc --noEmit --incremental false
pnpm --filter aux-system-uatf-backend lint
pnpm --filter aux-system-uatf-backend format
git diff --check
# Exportar nuevamente el catálogo solamente desde el test aislado:
$env:MIGRATION_AUDIT_EXPORT='true'
pnpm --filter aux-system-uatf-backend test --runInBand migrations-audit-postgres
```

## 19. Plan de actualización y recuperación

1. Identificar versión/artefacto actual, historial mediante SELECT READ ONLY y esquema real. Comparar huellas del SQL realmente desplegado. No inferir applied desde Git.
2. Determinar pendientes. **Detener plan** si cruza el cast ASSITANT o el reemplazo de publicación sin reconciliación/preservación probada. Si ya se ejecutó DROP/ADD, investigar backup histórico: la fecha original no puede deducirse de NULL.
3. Crear backup con pg_dump formato custom usando identidad autorizada. Comprobar exit code, existencia, tamaño no cero y hash SHA256. Guardar versión de PostgreSQL, extensiones, roles/propietarios y configuración horaria. No incluir credenciales en informe/log.
4. Verificar listado del archivo y restaurar en un clúster aislado vacío con pg_restore --exit-on-error. Comparar conteos, PK/FK, notas exactas, relaciones, fechas y evidencia. El listado o hash por sí solos no prueban restaurabilidad. Ensayar también roles/permisos requeridos para recuperación.
5. Ejecutar el mismo artefacto y pendientes sobre esa restauración. Comparar antes/después de usuarios, matrículas, notas, sesiones/marcas MANUAL/GEO/QR y restricciones; medir duración y bloqueos. Backup lógico debe ser consistente; detener escrituras para la captura final/cambio cuando sea necesario.
6. Revisar privileges para uuid-ossp, DDL y ENUM; revisar timezone y librerías del runtime; no cambiar TimeZone para reinterpretar datos históricos. Acordar ventana y recuperación.
7. Detener API/worker/escrituras, desplegar artefacto de migración, ejecutar run each **solo después de autorización real**. Si el backend nuevo usa columnas GEO/QR ausentes, no arrancarlo antes del esquema. No se certifica versión mixta: API y worker deben actualizarse coordinadamente.
8. Si falla, mantener escrituras detenidas, revisar historial y esquema. Cada migración ya confirmada permanece; corregir causa y reanudar sin fake ni borrar historial. No lanzar revert de cadena.
9. Comprobar catálogo e inspección metadata sin aplicar SQL generado. Ejecutar seeds solo si están autorizados y con demo desactivado. Comprobar permisos, login, matrículas, notas, MANUAL y GEO; QR operativo sigue rechazado hasta su fase correspondiente.
10. Arrancar API/worker compatibles, hacer smoke tests y monitorizar. Si debe restaurarse, hacerlo primero y probarlo en aislamiento; la restauración real requiere decisión explícita y manejo de escrituras posteriores al backup. No arrancar un backend viejo contra un esquema incompatible sin ensayarlo.

Comandos de backup/ensayo (no ejecutados aquí; variables deben apuntar a destinos revisados):

```powershell
pg_dump --dbname="$env:DATABASE_URL" --format=custom --file="$env:AUDIT_BACKUP_FILE"
Get-Item -LiteralPath $env:AUDIT_BACKUP_FILE
Get-FileHash -LiteralPath $env:AUDIT_BACKUP_FILE -Algorithm SHA256
pg_restore --list "$env:AUDIT_BACKUP_FILE"
# AUDIT_RESTORE_URL: exclusivamente una base vacía en clúster aislado verificado.
pg_restore --dbname="$env:AUDIT_RESTORE_URL" --exit-on-error "$env:AUDIT_BACKUP_FILE"
```

## 20. Riesgos pendientes

**Bloqueantes para autorizar una base existente:** historial/versión/esquema reales desconocidos, ausencia de backup restaurado y ensayado de esa base, rutas históricas destructivas o incompatibles si aún están pendientes, y política de borrado físico con CASCADE. La actualización del prefijo reciente GEO→QR sí fue probada; no representa todos los estados reales posibles.

**Mejoras opcionales:** medir índices de FK y redundancias, política explícita de fechas de semestre, CHECK de finitud GEO si la regla se aprueba, checksum de artefactos de migración en despliegue. No se añadieron reglas de negocio por inferencia.

## 21. Veredicto

**LISTO SOLO PARA PRUEBAS.** Código de ejecución corregido, preflight que bloquea rutas históricas conocidas inseguras y esquema vacío reproducible, coherente con metadata, con idempotencia, seeds y actualización reciente preservando evidencia. **No se certifica actualizar una base existente de versión desconocida**: dos defectos históricos demostrados requieren conocer el punto de partida y preservar datos mediante un plan específico. La base de aplicación permanece pendiente de toda inspección/actualización autorizada.

## Validación final

| Control | Resultado |
|---|---|
| Suite backend con PostgreSQL temporal (última ejecución general) | **99 suites aprobadas, 0 fallidas, 2 omitidas; 936 pruebas aprobadas, 0 fallidas, 9 omitidas** |
| Cuatro suites de migraciones/GEO/QR/seeds aislados | **118 pruebas aprobadas** en ejecución dirigida anterior a ampliar el test de auditoría |
| Auditoría final después de añadir preflight y ejecutor definitivo | **3 pruebas aprobadas**, 58,727 s; incluye CLI TS desde cero, CLI JS compilada, metadata, fallo intermedio, guardas de rollback y los dos riesgos históricos |
| Backend build | Aprobado, incluye los ejecutores compilados |
| Backend tsc --noEmit --incremental false | Aprobado |
| Backend lint | Aprobado; se corrigió un require-await del test nuevo detectado en una ejecución intermedia |
| Backend format | Aprobado |
| git diff --check | Aprobado |
| Base de aplicación | Sin conexión ni modificaciones; historial real pendiente |

La última suite general precedió al añadido final del preflight; después se repitió la suite afectada completa, TypeScript, lint, build y formato. No se presenta la suite general como una segunda ejecución posterior a ese añadido. El primer intento restringido tuvo fallos de entorno EACCES/initdb; la ejecución posterior con permisos para servicios locales los resolvió. Los dos fallos iniciales del test nuevo por preparar prefijos sin ordenar también se corrigieron y comprobaron.

Advertencia no bloqueante observada: pg/TypeORM emite deprecación por consultas concurrentes durante introspección. Se conserva la versión instalada; no hubo fallos asociados y no se añadió dependencia.

Validación funcional pendiente para un despliegue real: restaurar backup de la base objetivo, comparar su historial y ejecutar smoke tests de usuarios/permisos, matrículas, notas, MANUAL y GEO tras ensayar exactamente sus pendientes. Frontend no modificado; comprobar allí login, permisos y pantallas de notas/asistencia en ese ensayo.
