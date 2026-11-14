# QR-2B: persistencia, despliegue y reversión

## Alcance

QR se incorpora a `public.attendance_sessions_mode_enum` y
`public.attendances_registration_method_enum`, sin columnas, tablas de desafíos,
tokens, permisos ni roles nuevos. Los defaults siguen siendo MANUAL.
No se modifica AttendanceStatus, el cálculo GEO/MANUAL ni las migraciones previas.
El DTO y el service rechazan crear QR (`QR_NOT_ENABLED`); las sesiones QR externas
no pueden gestionarse por las rutas actuales. QR queda fuera del predicado SQL y
de la computabilidad pura hasta QR-3; pedir su estado operativo todavía falla.

## Auditoría del esquema del repositorio

- Tablas: `public.attendance_sessions`, `public.attendances`.
- UNIQUE: `UQ_8cd3866ee6beebfc50a0bab1962` (auxiliar/fecha),
  `UQ_7880aee9d2b1416261167c83e86` (sesión/matrícula).
- `date`: date obligatorio; cinco timestamps de sesión: timestamptz nullable.
- Coordenadas/configuración y evidencia nullable para compatibilidad histórica.
- FK de sesión/matrículas: CASCADE. Actor: `FK_attendance_marked_by`, RESTRICT.
- Última migración anterior: `1792886400000-AttendanceGeolocationModel`.
- Se conservan los 11 CHECK de sesión y 4 de marcas definidos por esa migración:
  coordenadas, radio, precisión, ventana, exclusividad cierre/cancelación,
  apertura y límites del cierre, configuración GEO/MANUAL, accuracy/distancia
  finitas y no negativas, evidencia GEO y PRESENT GEO.

No se ha consultado ni actualizado la base de aplicación. Las FK nullable
históricas y las rutas CASCADE no equivalen a una política completa de retención.

## Restricciones nuevas

- `CHK_attendance_session_qr_fields`: matrícula de auxiliar requerida y cuatro
  campos GEO nulos solo para QR.
- `CHK_attendance_session_qr_window`: fechas finitas; activación exige ventana,
  apertura anterior al fin y fecha de inicio local America/La_Paz. La cancelación
  activada pertenece a [openedAt, startsAt). Los borradores incompletos y su
  cancelación sin ventana siguen siendo válidos.
- `CHK_attendance_qr_evidence`: PRESENT, hora finita, actor, sesión y matrícula
  requeridos; accuracy/distancia nulas solo para método QR.

La comprobación de fecha usa `AT TIME ZONE 'America/La_Paz'` con zona explícita,
independiente del TimeZone de la conexión. No cambia Semester ni fechas GEO.
Las condiciones `IS NOT NULL` impiden eludir los requisitos con UNKNOWN de SQL.
El método de una marca MANUAL no tiene que coincidir con el modo de la sesión.

## Ejecución futura autorizada

TypeORM 0.3 usa `all` por defecto; el datasource no cambia ese valor globalmente.
Ambas migraciones declaran `transaction = true`: TypeORM rechaza `all` antes de
ejecutar migraciones pendientes. Es obligatorio usar una transacción por migración:

```powershell
pnpm --filter aux-system-uatf-backend migration:run --transaction each
```

La migración de enums debe confirmar antes de la de CHECK. Dos archivos ejecutados
en una sola transacción no cumplen este requisito PostgreSQL. No usar `none`:
aunque el override transaccional protege estas dos migraciones, no garantiza
transacciones para el resto de la cadena. Si falla la segunda migración, la primera
queda registrada; corregir la causa y reejecutar el mismo comando.

Estos comandos se documentan para un despliegue autorizado; no se ejecutan contra
la base de aplicación como parte de QR-2B. El test temporal usa el mismo ejecutor
TypeORM, el historial real y la opción `transaction: 'each'`.

## Reversión

```powershell
pnpm --filter aux-system-uatf-backend migration:revert --transaction each
```

Cada ejecución revierte una migración. Revertir primero CHECK y después ENUM.
Cada down exige transacción, adquiere ACCESS EXCLUSIVE en ambas tablas y aborta
con `QR_ROLLBACK_BLOCKED` si hay cualquier sesión QR o marca QR. La comprobación
precede a cualquier DROP y el bloqueo impide inserciones concurrentes durante ella.

El down de enums reconstruye los tipos sin QR porque PostgreSQL no ofrece DROP
VALUE. Conserva los CHECK GEO/MANUAL existentes por definición de catálogo,
defaults y datos. No emplea CASCADE, DELETE, UPDATE ni reclasificación de datos.
Una dependencia externa desconocida (por ejemplo una vista del modo) hace fallar
la transacción completa; se conserva y requiere análisis antes de continuar.

Los dos comandos de reversión no son una única operación atómica: después del
primero todavía existe el literal QR sin sus CHECK. Detener escrituras externas
durante ese procedimiento. Si aparece QR entre ambos pasos, el segundo aborta;
no borrar datos para poder revertir. En producción con evidencia, preferir una
corrección hacia adelante. La aplicación debe seguir rechazando QR hasta QR-3.

## Compatibilidad con los seeders recientes

El runner comprueba migraciones pendientes y usa transacciones por seeder; no
aplica migraciones ni crea asistencia. Los catálogos conservan el permiso GEO
`attendance.check-in` de STUDENT y no se agregan permisos QR. La prueba del flujo
completo se adapta a 22 migraciones y `each`, sin cambiar implementación de seeds.
No se consideran resueltos por QR los conflictos de datos que el runner detecta.

## Validación aislada

```powershell
$env:ATTENDANCE_TEST_PG_BIN = 'C:/Program Files/PostgreSQL/16/bin'
$env:SEED_TEST_PG_BIN = $env:ATTENDANCE_TEST_PG_BIN
pnpm --filter aux-system-uatf-backend test --runInBand
```

Las suites temporales crean clústeres nuevos en localhost con puertos efímeros;
el helper QR verifica data_directory y puerto antes de cualquier migración.
No leen DATABASE_URL para elegir el destino. La suite QR ejecuta las 20 migraciones
históricas y las dos nuevas, compara datos/columnas/CHECK y prueba up/down/up,
rechazo del modo all, límites temporales, FK, UNIQUE y rollback bloqueado.

## QR-3 pendiente

Ciclo QR, contratos/endpoints, permisos específicos, HMAC y gestión de claves,
contexto y matrícula propia, check-in, computabilidad y agregados consistentes,
lectura propia para reconciliación. No habilitar QR solo retirando el rechazo del
DTO: primero completar esas protecciones y sus pruebas.

## Resultados verificados el 11/11/2026

| Comprobación                                                    | Resultado                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Suite backend completa con PostgreSQL temporal GEO/QR y seeders | 98 suites, 932 pruebas aprobadas; 2 suites/9 pruebas omitidas por flags ajenos a Attendance |
| Suite QR final, incluida evidencia GEO histórica y CLI real     | 46 pruebas aprobadas                                                                        |
| TypeScript por aplicación, sin emitir ni incremental            | Aprobado                                                                                    |
| Lint backend completo                                           | Aprobado                                                                                    |
| Build backend                                                   | Aprobado                                                                                    |
| Formato backend completo y comprobación final del test QR       | Aprobado                                                                                    |
| git diff --check                                                | Aprobado                                                                                    |

Después de la suite completa se reforzó únicamente la fixture histórica QR con
una marca GEO completa y se repitió esa suite y su lint: 46 pruebas aprobadas.
Los resultados de esa ejecución específica no se suman a los de la suite completa.
Las suites omitidas son las
integraciones optativas de activities y grade-matrix. No se activaron contra la
base de aplicación. La primera ejecución restringida no pudo iniciar PostgreSQL
ni HTTP local; la ejecución autorizada completó ambos con aislamiento.

El rollback preservó marcas históricas MANUAL/EXCUSED y GEO/PRESENT con su actor,
hora, precisión y distancia, además de sesiones, columnas, defaults y CHECK
anteriores. La prueba de metadata parsea los CHECK de entidades en tablas
temporales y compara su definición PostgreSQL con la migrada. La reaplicación
final usa el CLI real con el datasource del proyecto y DATABASE_URL explícita
del clúster verificado. No usa seeders para preparar la suite QR.

## Archivos de QR-2B

Todos relativos a `apps/backend-nest`; los demás cambios del árbol son previos:

- `src/common/enums/attendanceSessionMode.ts`
- `src/common/enums/attendanceRegistrationMethod.ts`
- `src/common/utils/attendance-session-policy.ts`
- `src/common/utils/attendance-session-policy.spec.ts`
- `src/dtos/attendances/attendance-session-create.dto.ts`
- `src/entities/attendance/attendance-session.entity.ts`
- `src/entities/attendance/attendance.entity.ts`
- `src/services/attendances/attendances.service.ts`
- `src/services/attendances/attendance-geolocation-compatibility.spec.ts`
- `src/services/attendances/attendance-session-lifecycle-http.spec.ts`
- `src/services/attendances/attendance-qr-postgres.spec.ts` (nuevo)
- `src/database/migrations/1794355200000-AttendanceQrEnums.ts` (nuevo)
- `src/database/migrations/1794355260000-AttendanceQrChecks.ts` (nuevo)
- `src/database/utils/attendance-qr-rollback.ts` (nuevo)
- `src/database/seeders/seeders-postgres.spec.ts` (solo adapta ejecución de migraciones en tests)
- `docs/attendance-qr-2b.md` (nuevo)
