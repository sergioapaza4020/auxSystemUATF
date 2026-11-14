# Auditoría de seeders — 11 de noviembre de 2026

## 1. Seeder defectuoso

`EnrollmentSeeder.create`, último seeder del comando
`pnpm --filter aux-system-uatf-backend seed`.
La ejecución original desde cero terminaba; su repetición fallaba en la primera
fila de matrículas. El destino semilla corresponde a la materia SIS-313,
grupo 2, semestre II-2026 y participación ASSISTANT. Se omiten identificadores
personales del registro.

## 2. Error original

Reproducido con PostgreSQL 16 temporal y las 20 migraciones reales:

- SQLSTATE: `23505`.
- Tabla: `enrollments`.
- Restricción: `UQ_f0c733a26362d184c12a54f9249`.
- Clave: `id_user`, `id_course`, `id_semester`.
- Operación: `INSERT INTO enrollments (...) VALUES (..., $1, $2, $3, $4)`.
- Mensaje original: `duplicate key value violates unique constraint "UQ_f0c733a26362d184c12a54f9249"`.
- Stack relevante original: `EnrollmentSeeder.create`, línea 66 de la versión
  anterior. No se guardan parámetros, hashes ni datos de la persona.

## 3. Causa raíz

`findOne({ where: { user, semester, course } })` recibía entidades completas.
TypeORM añadía predicados sobre datos personales, roles y diez timestamps.
Las fechas de JavaScript conservan milisegundos, mientras PostgreSQL guarda
microsegundos; ese filtro podía no encontrar la relación ya existente.
El INSERT posterior chocaba con la clave compuesta correcta.
Incluso cuando encontraba la matrícula, el código anterior lanzaba una excepción:
la segunda ejecución tampoco podía terminar por esa otra rama.

No se reprodujo un fallo ENUM, GEOLOCATION ni una migración pendiente como causa
de este incidente.

## 4. Corrección implementada

- Matrículas: consultar exclusivamente por los tres IDs, incluir eliminadas
  lógicamente, reutilizar la misma participación y rechazar conversiones.
- Usuarios: contrastar email, username, CI y RU antes de insertar; reutilizar una
  cuenta coherente sin actualizarla. Un email personal cambiado se conserva si
  username y CI siguen identificando inequívocamente la misma cuenta.
  Identificadores repartidos entre cuentas o CI/username/RU contradictorios
  producen un conflicto explícito, sin fusión automática.
- Materias: resolver por código **y grupo**; rechazar referencias ambiguas.
- Referencias no únicas: comprobar cardinalidad y estado de padres antes de crear.
- Catálogos: reconocer registros eliminados lógicamente sin duplicarlos ni
  reactivarlos. Mantener fechas, descripciones y asignaciones personalizadas.
- Distribuciones académicas generales con detalles existentes: conservarlas
  completas, sin rellenar criterios que un usuario pudo retirar. La creación de
  una distribución nueva se ejecuta dentro de la unidad transaccional del seeder.
- Roles: conservar sincronización aditiva de permisos, incluidos los personalizados.
- Orquestación: comprobar migraciones, transacción por seeder, exclusión mutua
  entre comandos seed mediante advisory lock transaccional y aborto dependiente.
- CLI: salida de error no exitosa, cierre de conexión y diagnóstico seguro con
  seeder, fila cuando corresponde, SQLSTATE, tabla, constraint, operación y acción.

Archivos de implementación: `seed.ts`, `seed-runner.ts`,
`utils/seed-integrity.ts`, `seeders/base.seeder.ts`, `seeders/users.seeder.ts`,
`seeders/enrollments.seeder.ts`, `seeders/courses.seeder.ts`,
`seeders/careers.seeder.ts`, `seeders/grade-scheme-details.seeder.ts`,
`seeders/roles.seeder.ts`, `interfaces/enrollments.interface.ts`,
`data/enrollments.data.ts` y `.env.example` (todos dentro del backend;
las rutas de código parten de `src/database`).

## 5. Cambios en datos semilla

Las tres matrículas especifican `courseGroup: 2`, concordante con la materia ya
definida. No se cambian identidades, contraseñas, porcentajes, permisos ni roles
del catálogo. No se añaden entidades, columnas o migraciones.

Los usuarios existentes del archivo son **demo** y contienen credenciales fijas.
Por ello, usuarios y matrículas demo requieren activación explícita y solo pueden
ejecutarse en `development` o `test`. El seed por defecto crea/sincroniza catálogos
y roles, sin crear esas cuentas. No sirve para aprovisionar un administrador de
producción; ese alta debe realizarse con credenciales seguras por el procedimiento
operativo autorizado.

## 6. Dependencias y orden

El orden original se conserva:

| Orden | Seeder                      | Padres requeridos                                               |
| ----- | --------------------------- | --------------------------------------------------------------- |
| 1     | PermissionSeeder            | Ninguno                                                         |
| 2     | FacultySeeder               | Ninguno                                                         |
| 3     | GradeItemSeeder             | Ninguno                                                         |
| 4     | GradeSchemeSeeder           | Ninguno                                                         |
| 5     | SemesterSeeder              | Ninguno                                                         |
| 6     | GradeSchemeDetailSeeder     | GradeScheme, GradeItem                                          |
| 7     | CareerSeeder                | Faculty                                                         |
| 8     | CourseSeeder                | Career, GradeScheme                                             |
| 9     | RoleSeeder                  | Permission                                                      |
| 10    | UserSeeder, solo demo       | Role, Career si se indica                                       |
| 11    | EnrollmentSeeder, solo demo | User, rol activo para nuevas matrículas, Course/grupo, Semester |

No existen seeders de especialidades ni de AttendanceSession/Attendance en esta
cadena. No se modifica asistencia para acomodar datos de seed.

Existe además `seed:own-enrollments`, que ejecuta `sync-own-enrollments.ts`.
Es una sincronización puntual y transaccional del permiso personal de STUDENT y
ASSISTANT, no otro inicializador completo. Se inspeccionó y no se modificó ni
ejecutó sobre la aplicación.

## 7. Idempotencia

Las pruebas ejecutan el flujo completo desde cero, segunda y tercera ejecución,
comparando cantidades de entidades y tablas intermedias. La relación ya existente
se reconoce pese a timestamps con microsegundos. No se usa `orIgnore` para ocultar
conflictos.

## 8. Datos existentes

La cuenta existente no se guarda de nuevo: conserva hash, email, nombres,
username, CI/RU, carrera, estado y roles. Tampoco se reactivan matrículas o
catálogos. Una participación distinta en la misma clave compuesta se informa
como conflicto, sin conversión. Los roles reciben solo permisos semilla faltantes;
no se eliminan concesiones manuales. Las pruebas preservan facultad/decano,
carrera/director, curso, esquema, detalles, actividades, notas y asistencia.

## 9. Transacciones

Cada seeder utiliza repositorios del mismo EntityManager transaccional.
Un fallo revierte esa unidad e impide ejecutar las siguientes. Las unidades
anteriores ya confirmadas permanecen y se reutilizan al reintentar. No hay una
transacción global sobre toda la inicialización.

## 10. Tests PostgreSQL

`src/database/seeders/seeders-postgres.spec.ts` utiliza
`test/seeders-postgres.ts`: `initdb` crea un clúster nuevo, se elige un puerto
efímero en 127.0.0.1 y se comprueban puerto y `data_directory`. Nunca toma la
conexión de `DATABASE_URL`. Aplica las migraciones existentes, ejecuta seeds,
detiene el servidor y elimina únicamente el directorio temporal verificado.

Escenarios: base vacía; repetición; regresión UNIQUE; interrupción/rollback y
reintento; conflictos de identidad; conservación de datos representativos;
incorporación de check-in y retención del permiso personalizado anterior;
registros inactivos/eliminados; participación diferente; semestre inválido;
referencias ambiguas; código de materia compartido entre grupos; demo desactivada
por defecto y bloqueada en producción.

Comando de prueba en PowerShell, usando los binarios locales existentes:

```powershell
$env:SEED_TEST_PG_BIN = 'C:\Program Files\PostgreSQL\16\bin'
pnpm --filter aux-system-uatf-backend test --runInBand seeders-postgres seed-runner roles.seeder permissions.seeder
```

## 11. Regresión del fallo original

La prueba fuerza un timestamp de microsegundos, confirma que el predicado antiguo
devuelve null y que un INSERT duplicado recibe `23505` con la constraint original.
Luego ejecuta el seeder corregido y comprueba que no aumenta el número de matrículas.
La prueba de interrupción realiza una inserción real dentro del EntityManager del
seeder antes de lanzar el fallo; verifica que la cuenta no queda persistida.

## 12. Suite backend

Suite completa: **96 suites aprobadas, 812 pruebas aprobadas, 0 fallidas**;
3 suites / 67 pruebas omitidas por sus condiciones de integración. Las omitidas
son `activities.integration.spec.ts`, `grade-matrix.integration.spec.ts` y
`attendance-geolocation-postgres.spec.ts`. Las dos primeras utilizan la conexión
de aplicación y se mantuvieron explícitamente deshabilitadas
(`RUN_ACTIVITY_DB_TESTS=0`, `RUN_GRADE_MATRIX_DB_TESTS=0`); no se activó el flag
de la suite GEO independiente. La suite nueva de seeders sí ejecutó PostgreSQL
real aislado.

Después de la revisión final se repitieron las cuatro suites focalizadas:
**24/24 pruebas aprobadas**, incluidas **13 pruebas PostgreSQL**, el entrypoint
real del comando y conservación de una contraseña modificada. La prueba del
entrypoint establece una conexión local explícita al mismo clúster verificado;
no utiliza la URL configurada de la aplicación.

`src/database/seed-runner.spec.ts` cubre además redacción de errores, rechazo de
demo en producción y bloqueo previo a escrituras si faltan migraciones.

## 13. TypeScript, lint, build y formato

Se ejecutan por aplicación con PNPM; no se valida frontend porque no hay cambios
ni una dependencia funcional que lo requiera. Se incluye `git diff --check`.

- `pnpm --filter aux-system-uatf-backend exec tsc --noEmit --incremental false`: aprobado.
- `pnpm --filter aux-system-uatf-backend lint`: aprobado.
- `pnpm --filter aux-system-uatf-backend build`: aprobado.
- `pnpm --filter aux-system-uatf-backend format`: aprobado.
- `git diff --check`: aprobado.

## 14. Seguridad operativa

La conexión configurada corresponde a un host remoto Neon y la BD `aux_system_db`.
No se puede demostrar por la URL si es desarrollo o producción; se trata como
información real. Solo se consultó su historial mediante `BEGIN READ ONLY` y
`ROLLBACK`: las 20 migraciones disponibles estaban aplicadas, incluida
`AttendanceGeolocationModel1792886400000`. No hay una migración QR-2B adicional
en la lista actual del repositorio; no se supone aplicada una fase inexistente.

No se ejecutaron seeds, migraciones, cambios de datos ni limpieza sobre esa BD.
No se habilitó synchronize, no se deshabilitaron constraints y no se modificaron
migraciones antiguas. Las escrituras y la reproducción se limitaron a PostgreSQL
temporal.

## 15. Problemas adicionales y límites

Confirmados: búsqueda de usuarios solo por email; identificación de materias sin
grupo; falta de idempotencia de matrículas; ausencia de una unidad transaccional
por seeder y de cierre seguro en errores. Se corrigen dentro del flujo de seeds.

Los nombres de esquemas y la pareja período/año no tienen una UNIQUE en el esquema
actual. Si existen referencias ambiguas, el seed se detiene: no fusiona ni borra
datos para resolverlas. No se añaden constraints globales sobre datos existentes.
Las distribuciones parciales heredadas de una ejecución antigua se preservan y
requieren revisión: no puede distinguirse automáticamente una interrupción de
una edición académica legítima. La transacción nueva evita crear nuevas
distribuciones parciales.

No se encontraron fallos preexistentes en las verificaciones backend ejecutadas.
PNPM mantiene una advertencia no bloqueante sobre `resolutions` del paquete
frontend; no se cambió su configuración.

## 16. Recomendación y operación manual

No se requiere una migración nueva para esta corrección. En cualquier otro entorno
hay que revisar primero `pnpm --filter aux-system-uatf-backend migration:show` y
aplicar las pendientes solo con autorización. El seed se negará a continuar si
hay pendientes; no altera el esquema para compensarlas.

En un entorno existente, revisar primero destino y posibles conflictos de
identidad/referencias. El comando habitual ejecuta catálogos sin datos demo:

```powershell
pnpm --filter aux-system-uatf-backend seed
```

Solo para una base de desarrollo/pruebas verificada, se puede habilitar el flujo
completo de demostración:

```powershell
$env:NODE_ENV = 'development'
$env:SEED_DEMO_DATA = 'true'
pnpm --filter aux-system-uatf-backend seed
```

Estos comandos de seed se documentan, pero no se ejecutaron sobre la aplicación.
