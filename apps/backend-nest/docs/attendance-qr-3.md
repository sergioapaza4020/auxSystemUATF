# QR-3 — Backend de asistencia mediante QR dinámico

Fecha de verificación: 12/11/2026. Alcance: backend, pruebas y configuración de
ejemplo. No se modifica frontend, esquema ni migraciones. No se ejecutan seeds o
migraciones en la base de aplicación.

## 1. Auditoría inicial

Se verificaron AGENTS.md, rama dev, cambios previos, QR-2B y su documentación.
Los bloqueos temporales estaban en DTO, creación/gestión del service y política
académica. La API usa CurrentUser/JwtPayload.idUser, JwtStrategy y sesión activa;
PermissionsGuard conserva su bypass SUPERADMIN, pero el dominio exige matrícula.
Ownership: matrícula propia ASSISTANT activa. GEO usa un lock pessimistic_write
de AttendanceSession para check-in, lifecycle y guardado. Los filtros globales
normalizan errores y el interceptor envuelve respuestas. Los seeders ya realizan
sincronización aditiva y preservan personalizaciones.

Después de QR-2B existe un wrapper de migraciones con preflight y transacciones
por migración. Se conserva, junto con todos los cambios de trabajo anteriores.
La configuración depende de process.env/dotenv. No se leen ni imprimen secretos
locales de la aplicación durante la auditoría.

## 2. Archivos de esta fase

Todos relativos a `apps/backend-nest`. Nuevos:

- `src/services/attendances/attendance-qr-token.service.ts`
- `src/services/attendances/attendance-qr-token.service.spec.ts`
- `src/services/attendances/attendance-qr-backend-postgres.spec.ts`
- `src/dtos/attendances/attendance-qr.dto.ts`
- `src/core/filters/http-exception/attendance-qr-validation.filter.ts`
- `src/common/utils/attendance-academic-counts.ts`
- `docs/attendance-qr-3.md`

Existentes modificados:

- `.env.example`
- `src/common/enums/attendanceCheckInCode.ts`
- `src/common/errors/attendance-check-in.exception.ts`
- `src/common/utils/attendance-session-policy.ts`
- `src/common/utils/attendance-session-policy.spec.ts`
- `src/controllers/attendances/attendances.controller.ts`
- `src/core/filters/http-exception/http-exception.filter.ts`
- `src/database/data/permissions.data.ts`
- `src/database/data/roles.data.ts`
- `src/database/seeders/roles.seeder.spec.ts`
- `src/dtos/attendances/attendance-session-create.dto.ts`
- `src/modules/attendances/attendances.module.ts`
- `src/services/attendances/attendances.service.ts`
- `src/services/attendances/attendances.service.spec.ts`
- `src/services/attendances/attendance-geolocation-compatibility.spec.ts`
- `src/services/attendances/attendance-session-lifecycle-http.spec.ts`
- `src/services/attendances/attendance-qr-postgres.spec.ts`
- `src/services/attendances/individual-attendance-query.spec.ts`
- `src/services/enrollments/enrollments.service.ts`
- `src/services/enrollments/student-grade-summary.spec.ts`
- `src/services/crud.service.spec.ts`

Los tests de bloqueo QR-2B se sustituyen por los contratos habilitados QR-3; se
mantienen los tests de evidencia y las migraciones originales. Los cambios en
package.json, datasource, seeders de implementación y modelos de bulk operations
son anteriores a esta fase y se preservan.

## 3. Ciclo de vida

MANUAL sigue sin estado operativo. GEO y QR comparten política temporal derivada:
DRAFT sin activar, SCHEDULED antes de startsAt, OPEN durante [startsAt, endsAt),
CLOSED por tiempo o closedAt, CANCELLED antes de la apertura efectiva.
openedAt significa activación, incluso al programar. Configurar QR requiere ambos
instantes ISO con offset/Z, orden, límites del semestre y fecha local de inicio.
open-now solo en DRAFT ajusta inicio/fecha y conserva endsAt. Se congelan horario,
fecha y modo al activar. Solo se elimina físicamente un DRAFT sin marcas.

Crear QR y reasignar una matrícula propietaria adquieren el mismo lock de la fila
Enrollment. La reasignación vuelve a comprobar registros dentro de la transacción;
así no puede introducir un cambio indirecto de propietario/curso/semestre tras
crear una sesión. No se cambian los límites temporales de Semester ni Haversine.

## 4. Configuración HMAC y claves

- `ATTENDANCE_QR_ACTIVE_KID`: clave emisora activa, 1–16 caracteres ASCII permitidos.
- `ATTENDANCE_QR_KEYS_JSON`: objeto de kid a clave Base64 estándar canónica.
- Entre 1 y 8 claves, cada una de 32 a 128 bytes decodificados.
- Claves exclusivas QR y distintas por entorno; no reutilizar las claves JWT.

La configuración se valida al construir el proveedor. Ausencia o invalidez deja
QR cerrado con `503 QR_NOT_AVAILABLE`; no impide arrancar MANUAL/GEO. Crear y
configurar un borrador no necesita emitir tokens. No se incluyen claves reales
en archivos; las claves de tests son material sintético reconocible.

Rotación: distribuir primero la nueva verificadora a todos los procesos,
manteniendo la emisora actual; después cambiar ACTIVE_KID; retirar la anterior
solo cuando hayan vencido todos sus códigos emitidos. En un compromiso, retirar
la clave en todos los procesos inmediatamente, sin gracia. La configuración se
carga por proceso: aplicar cambios mediante reinicio/despliegue coordinado.

## 5. Formato y validación

`q1.<kid>.<sid>.<slot>.<mac>`. HMAC-SHA-256 sobre los primeros cuatro segmentos,
MAC completo de 32 bytes en Base64URL sin padding. No es JWT ni autentica usuarios.
Máximo 128 caracteres; sid decimal canónico positivo hasta 2147483647; slot
decimal canónico no negativo de hasta 12 dígitos. Algoritmo fijo, clave conocida,
Base64URL recodificada para comprobar canonicalidad y timingSafeEqual para MAC.
El sid autenticado debe coincidir con la ruta. El payload no contiene datos
personales. Misma sesión/slot/clave produce el mismo token en procesos distintos.

## 6. Rotación temporal

Slot = floor(unixMilliseconds / 30000). Código actual durante su periodo; anterior
solo hasta 5 s después de su fin nominal, límite exclusivo. Ningún slot futuro.
expiresAt = min(fin nominal + 5 s, endsAt); rotateAt = min(fin nominal, endsAt).
No se acepta un periodo nominal que terminó antes de abrir/activar la sesión.
La sesión debe seguir OPEN en el punto de decisión; closedAt invalida el uso
operativo inmediatamente. No hay tolerancias adicionales ni reserva al consultar.
La hora final y markedAt se capturan después del lock y las consultas de contexto.

## 7. Endpoints finales

Todos bajo `/api/attendances`, con el envelope y filtros existentes:

| Método/ruta                                                  | Permiso                   | Resultado                                                          |
| ------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------ |
| POST /sessions                                               | attendance.session.create | Crea DRAFT QR con matrícula propia; contrato MANUAL conservado     |
| PATCH /sessions/:idSession/qr                                | attendance.session.update | Configura startsAt/endsAt completos solo en DRAFT                  |
| PATCH /sessions/:idSession/activate, open-now, close, cancel | attendance.session.update | Operaciones compartidas con GEO                                    |
| GET /sessions/:idSession/qr                                  | attendance.qr.get         | 200: token, idAttendanceSession, serverNow, rotateAt, expiresAt    |
| POST /sessions/:idSession/qr-context                         | attendance.qr.check-in    | 200: materia/grupo, fecha/ventana, OPEN, expiración y marca propia |
| POST /sessions/:idSession/qr-check-in                        | attendance.qr.check-in    | 201: SUCCESS, idAttendance, PRESENT, QR y markedAt                 |
| GET /sessions/:idSession/qr-own-mark                         | attendance.qr.check-in    | 200: ownMark o null; sin token y válido también después del cierre |

Contexto y check-in reciben exclusivamente `{ token }`. Configuración recibe
exclusivamente `{ startsAt, endsAt }`. Se rechazan propiedades extra aunque el
pipe global normalmente las elimine. El GET y el contexto no registran asistencia.
ownMark incluye solo status, registrationMethod y markedAt (nullable histórico).
No se devuelven actor, listas, notas, matrículas ajenas o evidencia geográfica.

## 8. Permisos y roles

QR get se asigna a ASSISTANT; QR check-in solo a STUDENT, no a la lista base que
hereda ASSISTANT. No se reutiliza el permiso GEO. El seeder existente agrega los
grants faltantes sin retirar personalizaciones; la idempotencia sigue probada.
Actualizar seeds no actualiza JWT ya emitidos: renovar autenticación al desplegar.

## 9. Matrículas

El estudiante se resuelve por idUser JWT, Course y Semester de la matrícula de
auxiliar de la sesión, rol STUDENT y actividad. QR comprueba además usuario activo,
propietario y contexto académico activos y límites del semestre. Los roles
globales no sustituyen la matrícula; SUPERADMIN tampoco. La lectura propia no
distingue sesión inexistente de una ajena mediante su error de matrícula.

## 10. Orden de validación

JWT/permiso → DTO/parámetro → MAC y sesión firmada → transacción y lock de sesión
→ matrícula/contexto → QR OPEN → duplicado → hora final y nueva comprobación de
estado/periodo → inserción. La firma temprana evita transacciones por basura; la
vigencia definitiva se valida tarde para incluir espera y latencia de consultas.
Los errores mantienen code/message/statusCode/path/timestamp y no revelan claves.

## 11. Concurrencia

Se comparte el lock existente con cierre, cancelación, GEO, guardado manual y
markAll. Dos check-ins de una matrícula producen una fila y ALREADY_REGISTERED;
distintos alumnos reutilizan el token. UNIQUE es la última defensa, traduciendo
solo su constraint conocido. No se hace upsert QR. El cierre puede ganar y
rechazar QR; si QR gana, el cierre posterior consolida la marca. La expiración se
decide bajo lock. Reconciliar un timeout nunca prueba que el POST no pudo terminar.

## 12. Evidencia persistida

Sesión, matrícula, PRESENT, método QR, hora de servidor, actor estudiante;
accuracy/distanceMeters nulos. No se guardan token, MAC, fotografía, coordenadas,
secretos, identificadores temporales ni nuevas columnas/tablas.

## 13. Correcciones manuales

GEO y QR mantienen bloqueo de sobrescritura y borrado ordinario. markAll no
reemplaza evidencia protegida ni aplica un lote parcialmente destructivo. Las
excepciones MANUAL para otros estudiantes siguen permitidas en OPEN/CLOSED,
incluidos PRESENT/EXCUSED y la semántica histórica de ausencia implícita. Corregir
una marca protegida requiere un futuro historial; esta fase no lo implementa.

## 14. Computabilidad

MANUAL conserva comportamiento histórico. GEO y QR solo computan estando
activadas, estructuralmente válidas, CLOSED y no canceladas. OPEN sin marca es
pendiente de presentación; CLOSED sin marca es ABSENT implícito. No se persiste
PENDING ni se insertan ausencias masivas. El historial mantiene todos los estados.

## 15. Snapshot académico

attendance-academic-counts ejecuta una sola sentencia con CTE computable
MATERIALIZED, filtrada por auxiliar y now común. Total de sesiones y marcas se
obtienen de esa misma relación y snapshot, tanto en asistencia individual como
en el resumen ponderado de Enrollments. No cambian fórmulas ni pesos. Varios
auxiliares sin asociación explícita siguen generando el rechazo por ambigüedad;
no se escoge uno arbitrariamente.

Las comparaciones QR del predicado SQL usan mode::text para poder consultar
MANUAL/GEO en un esquema histórico sin el literal QR. Esto no habilita QR sin
sus migraciones ni convierte modos desconocidos en MANUAL.

## 16. Secretos, errores y logs

No hay logging de configuración, cuerpos QR o emisión. Errores inesperados pasan
por el filtro global sin detalles internos. El filtro elimina query de path en
rutas QR para no reflejar secretos enviados accidentalmente en URL. Respuestas
sensibles y errores QR llevan Cache-Control: no-store. No se añaden tokens a URLs
de API. Proxy/APM/analítica externos requieren revisión de redacción al desplegar.

## 17. Rate limiting

PENDIENTE operativo: no había throttling de Attendance y no se introduce un
contador local ni un límite pequeño compartido por IP. Antes de producción,
aplicar límites por identidad autenticada y operación con almacenamiento compartido
o un gateway autorizado; separar emisión de intentos y probar la Wi-Fi del aula.
La infraestructura Redis existente para bulk jobs no se reutiliza automáticamente
como rate limiter. No se añade otra dependencia o almacenamiento en esta fase.

## 18. Tests unitarios — IMPLEMENTADO Y PROBADO

30 pruebas HMAC: formato, canonicalidad, manipulación, kid/sid, periodos y gracia,
claves inválidas, rotación y emisión determinista. Incluye dos procesos Node
separados con la misma configuración y hora fija, sin memoria compartida.

## 19. HTTP — IMPLEMENTADO Y PROBADO

La nueva suite integrada emplea controller, JWT firmados, JwtStrategy, guards,
ValidationPipe, filtros, interceptor y service real con PostgreSQL. Comprueba
contratos, permisos, multirrol, DTO estricto, no-store, privacidad y errores.
No inicia el backend conectado a la base de aplicación.

## 20. PostgreSQL — IMPLEMENTADO Y PROBADO

Las suites QR prueban HMAC, tiempo, configuración indisponible, HTTP con JWT
firmados, DTO estricto, privacidad, ownership, roles/matrícula, lifecycle, estados,
duplicados, varios alumnos, carreras con cierre/markAll, cancelación/activación,
expiración bajo lock y snapshots concurrentes. Los tests PostgreSQL crean y
verifican su propio data_directory y puerto antes de migrar; no usan la URL de
aplicación. Las nuevas fixtures se preparan por INSERT de datos ficticios, no seeds.

La integración HTTP utiliza JwtStrategy real y firmas JWT, con assertActiveSession
simulado. La persistencia/revocación completa de autenticación pertenece a las
pruebas generales de auth; no se presenta esta fixture como un E2E con login real.

| Suite PostgreSQL                                 | Pruebas aprobadas |
| ------------------------------------------------ | ----------------: |
| Backend QR, HTTP y concurrencia, ejecución final |                46 |
| Modelo/migraciones QR-2B                         |                46 |
| Regresión GEO y concurrencia                     |                58 |
| Seeders completos                                |                13 |
| Auditoría de la cadena de migraciones            |                 3 |

La prueba de periodo mantiene un lock hasta que vence el QR mientras la sesión
sigue OPEN y comprueba QR_TOKEN_EXPIRED sin marca. Otra espera cruza endsAt y
recibe SESSION_CLOSED. También se cubre cierre concurrente, markAll y reasignación.
Se verificó un caso adicional real: el validador ISO acepta fechas semanales y
ordinales que Date de JavaScript no parsea. QR las rechaza con 400 controlado.

## 21. Suite completa — IMPLEMENTADO Y PROBADO

Última ejecución completa: **101 suites y 1003 pruebas aprobadas**, sin fallos;
2 suites y 9 pruebas omitidas por sus flags de integración (activities y
grade-matrix). Las integraciones GEO, QR, seeders y auditoría de migraciones sí
estuvieron habilitadas con PostgreSQL 16 temporal verificado.

Después se añadieron los dos casos ISO citados y se volvió a ejecutar toda la
suite integrada QR: **46/46 aprobadas**. No se suma esa ejecución otra vez al
total de la suite completa. Se repitieron los controles de calidad del código
final. No se afirma que los tests opcionales contra otras bases hayan sido ejecutados.

## 22. Controles de calidad — IMPLEMENTADO Y PROBADO

- `pnpm --filter aux-system-uatf-backend exec tsc --noEmit --incremental false`: aprobado.
- `pnpm --filter aux-system-uatf-backend lint`: aprobado.
- `pnpm --filter aux-system-uatf-backend build`: aprobado.
- `pnpm --filter aux-system-uatf-backend format`: aprobado.
- `git diff --check`: aprobado.

Comando de suite completa aislada utilizado:

```powershell
$env:ATTENDANCE_TEST_PG_BIN = 'C:/Program Files/PostgreSQL/16/bin'
$env:SEED_TEST_PG_BIN = $env:ATTENDANCE_TEST_PG_BIN
$env:MIGRATION_TEST_PG_BIN = $env:ATTENDANCE_TEST_PG_BIN
pnpm --filter aux-system-uatf-backend test --runInBand
```

Persisten avisos previos de resolutions en el package del frontend y una
deprecación del driver pg sobre consultas simultáneas de fixtures existentes;
no son fallos finales. No se cambian versiones ni dependencias.

## 23. Seeders — IMPLEMENTADO Y PROBADO EN BASE TEMPORAL

La suite de seeders ejecutó su flujo sobre su propia base temporal y comprobó
grants de roles desde el catálogo actualizado, repetición sin duplicados y
personalizaciones preservadas. No se cambió el runner ni su implementación.
No se ejecutaron seeds en aplicación; sincronizar grants desplegados queda pendiente.

## 24. Riesgos residuales

- QR compartido en tiempo real puede funcionar fuera del aula: no demuestra
  presencia física. No se implementa GEOLOCATION_QR ni GPS para QR independiente.
- Sin rate limiting compartido, auditoría de logs de infraestructura ni prueba
  de carga de aula, no se declara listo para producción.
- Persisten CASCADE históricos ante SQL privilegiado. Las rutas públicas revisadas
  de User/Course/Semester/Enrollment desactivan; no se cambian FK por defecto.
- Modificar directamente SQL o claves fuera del procedimiento puede invalidar las
  garantías del servicio. El estado desplegado de migraciones/grants no se inspecciona.
- Configuración y hora deben estar coordinadas entre instancias; estas pruebas no
  son una prueba de despliegue distribuido ni un ensayo con teléfonos físicos.

## 25. Configuración antes de un entorno real

1. Autorizar/verificar migraciones QR-2B con el wrapper actual
   `pnpm --filter aux-system-uatf-backend migration:run` (each y preflight).
2. Autorizar sincronización de permisos/roles revisando alcance del seeder; renovar
   login/JWT después. No ejecutar un seed demo en producción.
3. Aprovisionar claves QR aleatorias fuera de git, exclusivas por entorno;
   configurar ambos parámetros QR y verificar emisión entre procesos.
4. HTTPS para futura entrada móvil, API y login; no modificar infraestructura aquí.
   Revisar no-store, Referrer-Policy y evitar terceros en la futura página QR.
5. Relojes sincronizados, rotación coordinada y redacción de tokens en proxy/APM.
6. Rate limiting compartido, prueba de aula y de pérdida de red, conservación y
   recuperación de datos; aceptar formalmente el riesgo de reenvío en tiempo real.

## 26. QR-4

Selección QR en creación; horario y borrador; controles de lifecycle; presentación
grande/fullscreen, token a imagen localmente, cuenta regresiva y renovación con
serverNow/rotateAt/expiresAt; retiro al cerrar/vencer y manejo de desconexión.
No pedir GPS ni exponer nombres en proyección. No se modifica frontend en QR-3.
QR-5 resolverá recepción anónima, login/retorno seguro, confirmación explícita y
reconciliación mediante own-mark. QR-6 completará hardening operativo y móviles.
