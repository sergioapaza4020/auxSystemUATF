# QR-6 — Auditoría, correcciones y preparación del piloto

Fecha: **12/11/2026, America/La_Paz**. Rama: `dev`. Se preservaron cambios previos, sin commit ni modificación de datos reales.

## 1. Resumen ejecutivo

**Veredicto: NO LISTO para iniciar un piloto académico real en el entorno actualmente verificado.** El código QR funciona en las verificaciones locales y se corrigieron defectos demostrados, pero faltan configuración QR local, origen HTTPS móvil validado, límite compartido y aceptación móvil/aula. No se infiere el estado de producción a partir del repositorio.

Se ejecutó API con login real, sesiones persistidas, JWT/guards y PostgreSQL temporal; carga local de hasta 50 estudiantes; pérdida real de respuesta; regresiones MANUAL/GEO/QR; y revisión visual en navegador con APIs/auth simuladas. Esto aporta evidencia más allá de mocks de controller, pero **no es un E2E completo de navegador + login + backend desplegado**.

## 2. Estado real QR-1 a QR-5

| Fase | Verificación actual | Alcance real |
| --- | --- | --- |
| QR-1/2A | Contratos de modo/método separados y reglas contrastadas con código | Diseño conservado; no se rehace |
| QR-2B | Enums/CHECK, rollback y wrapper each | Ejecutados en PostgreSQL desechable; despliegue desconocido |
| QR-3 | Lifecycle, HMAC, permisos, contexto, check-in y own-mark | API/servicios/DB reales probados |
| QR-4 | Creación, horario, controles, SVG/fullscreen, historial y planilla | Tests y revisión visual parcial simulada; se corrige presentación |
| QR-5 | Recepción/login/confirmación/reconciliación | Tests y navegador simulado; se corrige respuesta tardía |

Se leyeron los cuatro informes anteriores; sus resultados históricos no se tomaron como ejecución QR-6. No se agregaron tablas, migraciones, roles, dependencias ni modalidad combinada.

## 3. Auditoría backend

Controller `attendances.controller.ts`: POST sessions; PATCH qr/activate/open-now/close/cancel; GET qr; POST qr-context/qr-check-in; GET qr-own-mark; DELETE borrador limpio. Service resuelve ownership y matrícula académica, congela activación y comparte lock pesimista de AttendanceSession. Pruebas de creación, configuración completa/parcial inválida, activación, programación/cancelación, apertura inmediata y cierre aprobadas. La emisión sin claves falla cerrada solo para QR.

## 4. Auditoría frontend

Se revisaron middleware/publicRoutes/Login/AuthProvider/Axios/cookies y componentes/hooks de auxiliar/estudiante, con MUI v5/React 18/Next 14 conservados. Entrada exacta QR pública; el resto de `/attendance` no se abre. AuthProvider verifica perfil mediante refresh existente cuando hay credenciales; no basta la cookie. No GPS ni cámara propia para QR. Hallazgos F1–F4 abajo.

## 5. Contratos API

Se contrastaron métodos, paths, DTO estricto y envelope `data` con servicios frontend y HTTP real. `qr-context` es POST de lectura 200; check-in es POST 201; own-mark es GET 200 sin token. Contexto y registro reciben solo `{token}`. El cliente extrae sid acotado para la ruta; el servidor valida vinculación firmada. Emisión devuelve exactamente idAttendanceSession/token/serverNow/rotateAt/expiresAt. Contexto proyecta course/name/group/date/startsAt/endsAt/state/expiresAt/ownMark. Marcas propias no contienen actor, matrícula ajena, coordenadas ni claves. Códigos de dominio y estados se mantienen.

## 6. Seguridad HMAC

AttendanceQrTokenService usa SHA-256, firma completa de 32 bytes, Base64URL canónico y timingSafeEqual. Mensaje de propósito q1 con kid/sid/slot; no JWT de usuario. Longitud máxima 128, sid decimal canónico hasta int32 positivo, slot acotado, clave conocida y firma vinculada a ruta. Configuración de 1–8 claves Base64 canónicas de 32–128 bytes. Rechaza reutilizar claves JWT por valor codificado/bytes. Se añadieron pruebas de reutilización de ambas claves JWT, no se generaron claves reales.

## 7. Expiración, rotación y procesos

Periodos 30s, gracia hasta 5s solo del anterior, límite exclusivo, ningún periodo futuro, sin ampliación por login/latencia. Vigencia recortada por endsAt y estado OPEN revalidado después de esperar lock. Tests exactos 29999/30000/34999/35000 ms, fin/cierre/cancelación, periodo previo a activación y reloj verificador atrasado. Dos procesos Node emiten igual; se añadió verificación en otro proceso del token emitido por el padre. No es una prueba multinodo desplegada ni de NTP real.

## 8. Permisos y ownership

attendance.qr.get para auxiliar; attendance.qr.check-in para estudiante. Guards globales más dominio: SUPERADMIN no sustituye matrícula; propietario debe ser ASSISTANT activo. Se prueban multirrol, alumno ajeno/inactivo, distinto curso/semestre, otro auxiliar y falta de permiso. El check-in no permite selección de usuario o matrícula desde cliente.

## 9. Autenticación

La suite nueva usa AuthController/AuthService/UsersService/SessionsService/JWT/guards y repositorios reales: bcrypt, login, refresh, /auth/me, persistencia y revocación de sesión. Solo dependencias administrativas/importación NO utilizadas por autenticación se sustituyen; controller y lógica de auth/asistencia no son mocks. UI login/retorno fijo y verificación de cuenta se prueban en la suite frontend. E2E interactivo con credenciales sobre un entorno HTTPS sigue NO PROBADO.

## 10. Privacidad

Fragmento capturado y retirado con history.state conservado; nunca pasa a query de API/login. Token en memoria local y sessionStorage solo para login, con retención acotada y consumo/limpieza; recibo sin token permite reautenticar una lectura incierta. No localStorage, cookies QR, claves frontend ni generador externo. Logs propios revisados: no cuerpos/token/URL completos; filtro elimina query de errores QR y aplica no-store. Proxy/APM/CDN/extensiones y XSS no certificados. Ruta Next tiene no-store/no-referrer; comprobación HTTP final registrada en validaciones. Fotos adjuntas contienen únicamente simulaciones, no códigos HMAC operativos.

## 11. Concurrencia

PostgreSQL real: doble check-in, distintos alumnos mismo QR, close/markAll, guardado manual (caso añadido), cancel/open-now, emisión/close (caso añadido), reasignación y expiración tras espera del lock. UNIQUE sesión/matrícula es defensa final; no upsert. El token nunca se consume globalmente. Pruebas de dispositivos/pestañas reales siguen pendientes; las peticiones concurrentes HTTP sí se ejecutaron.

## 12. Integridad Attendance

PRESENT, QR, sesión/matrícula, markedBy JWT y markedAt servidor; accuracy/distance nulos. Sin token, foto, GPS o tabla de desafíos. CHECK QR no debilita GEO/MANUAL; actor FK RESTRICT y UNIQUE existentes conservados. Previas MANUAL PRESENT/EXCUSED/ABSENT y evidencia GEO/QR no se reemplazan silenciosamente.

## 13. Computabilidad académica

MANUAL histórico; GEO y QR activadas/CLOSED no canceladas y válidas. QR DRAFT/SCHEDULED/OPEN/CANCELLED no computa. `academicAttendanceCounts` materializa una sola relación de sesiones y calcula ambos lados en una sentencia/snapshot y now común. Pruebas con cierre concurrente, lectura individual y resumen ponderado. OPEN sin marca pendiente; CLOSED sin marca ABSENT implícito, sin persistir PENDING ni insertar ausencias masivas. Ambigüedad con varios auxiliares se rechaza, no se elige uno arbitrario.

## 14. Protección MANUAL/GEO/QR y cascades

Save/delete/markAll protegen evidencia QR/GEO; excepciones manuales según estado siguen permitidas. Endpoints ordinarios de User/Course/Semester/Enrollment desactivan; no se encontró un borrado ordinario nuevo que exigiera cambio de FK. SQL privilegiado sobre Course/Semester/Enrollment/Session conserva cascades históricos que pueden destruir evidencia; User tiene además restricciones de actor para marcas atribuidas. No se cambian cascades masivamente. Requiere respaldo/PITR, retención y acceso SQL restringido, sin usar rollback destructivo para borrar QR.

## 15. Presentación del QR

SVG local negro/blanco, quiet zone cuatro módulos y origen configurado. Revisión visual en IAB: DRAFT → activar/confirmar → OPEN, campos bloqueados → Mostrar QR; fullscreen y Escape. Se encontraron QR recortado en ventana baja y aviso obsoleto; corregidos con tamaño limitado por altura y reset de scroll al entrar fullscreen. Se guardaron capturas posteriores. No se probó cámara física ni lectura desde fondo de aula. Countdown observado; renovación/error/expiración/suspensión/cambio de sesión probados con fake timers, no red móvil real.

## 16. Flujo estudiante

En navegador de escritorio con componentes reales y API/auth simuladas: entrada sin token rechazada, contexto, un POST solo al confirmar, SUCCESS, lectura y pantalla de incertidumbre sin segundo POST. Revisados tema oscuro y contenedor 360px; esto NO equivale a viewport de teléfono ni Android/iOS físicos. API real por separado: auxiliar crea/configura/activa/emite; estudiante hace contexto/confirmación; auxiliar ve roster/cierra; resumen individual pasa de cero a una sesión/presente. No se sustituyó ese HTTP por mocks.

## 17. Errores y resultados inciertos

Mapper seguro, 401/refresh/login, 403 distinto de expiración y 429 con Retry-After. No retry ciego tras POST ambiguo. Se añadió pérdida de respuesta real: middleware exclusivamente de test destruye socket al emitir JSON después de que el handler real guardó; se verifica una fila y own-mark QR. Null sigue incierto, no ausencia académica definitiva. F1 impide que una lectura tardía vuelva a habilitar un token ya descartado.

## 18. Migraciones y seeders

Migraciones incrementales de los tipos `attendance_sessions_mode_enum` y `attendances_registration_method_enum`, y CHECK `CHK_attendance_session_qr_fields`, `CHK_attendance_session_qr_window` y `CHK_attendance_qr_evidence`, defaults MANUAL, datos GEO históricos, down bloqueado con evidencia, dependencias desconocidas y up/down/up ejecutados en clúster temporal. Wrapper real usa `runMigrations({transaction:'each'})`, con preflight; dos archivos solos no sustituyen commit. Sin synchronize. Suite seeders prueba grants QR, idempotencia y personalizaciones. No se ejecutó nada contra base de aplicación ni se infiere estado desplegado.

## 19. Claves y configuración

Nombres documentados en .env.example. Revisión local solo de presencia/formato, sin imprimir valores: **faltan ATTENDANCE_QR_ACTIVE_KID, ATTENDANCE_QR_KEYS_JSON y NEXT_PUBLIC_ATTENDANCE_QR_ORIGIN en archivos locales examinados**. Ver environment-status.json. No representa variables inyectadas de otro entorno ni prueba ausencia en producción. Aprovisionar claves QR exclusivas por entorno fuera de git; distribuir verificadora nueva a todos, cambiar emisora después, esperar vencimiento total y retirar anterior. Compromiso: retirar inmediatamente en todos los procesos, sin gracia; reinicio/despliegue coordinado. No se rotó ninguna clave real.

## 20. HTTPS, cookies y dominio

Origen frontend debe ser público HTTPS root y accesible desde móviles; helper rechaza loopback/IP/origen arbitrario. No se cambió DNS, certificado ni proxy. Backend CORS conserva FRONTEND_URL exacto y credentials. Cookies JWT existentes usan Secure en producción y SameSite strict; son accesibles a JS, riesgo XSS preexistente. Móvil/cámara→navegador, sesión, CORS y dominio real requieren prueba. El hallazgo F2 añade exclusivamente exposición de Retry-After, no abre nuevos orígenes.

## 21. Rate limiting

**BLOQUEADO antes del piloto.** Hay Redis/BullMQ en compose/importaciones, pero no control QR compartido implementado ni gateway inspeccionado. Redis está configurado localmente; una comprobación de disponibilidad limitada a loopback no pudo completarse, sin crear colas o claves de aplicación. No se configura infraestructura compartida automáticamente. RATE-LIMITING.md define identidad JWT verificada, cuotas separadas, atomicidad/TTL, fail-closed QR, 429/Retry-After y pruebas con dos nodos/50 usuarios por IP. No se añade una solución local falsamente multinodo. Requiere implementación/configuración y validación en un entorno autorizado; las cargas adjuntas no prueban un limiter activo.

## 22. PostgreSQL

PostgreSQL 16 temporal con helpers que crean directorio y puerto propios, verifican identidad antes de migrar y limpian al terminar; no usan DATABASE_URL para elegir destino. Se ejecutaron regresiones GEO/QR, migraciones, seeders, autenticación/sesiones y nueva carga. No se usaron datos reales. La suite inicial previa a extensiones dio 101 suites/1005 pruebas. La suite completa posterior se detalla en §29.

## 23. Frontend

**93 suites/760 pruebas aprobadas**, incluida regresión de login/cookies/interceptor, permisos, matrículas, notas, MANUAL/GEO, auxiliar QR y estudiante. El nuevo test F1 se reprodujo primero en rojo (READY frente a EXPIRED) y pasó después. No confundir estos harness/render tests con móviles reales. Fixture visual reproducible en test/attendance-qr-browser; no cambia rutas productivas.

## 24. E2E

**APROBADO local API real con login y BD:** flujo académico completo mediante HTTP, refresh y revocación incluidos. **NO PROBADO navegador + frontend + API/HTTPS real unido:** se entregan protocolo y matriz, no una afirmación de éxito. Evidencia visual es simulada; evidencia API sí tiene persistencia/transacciones reales. No hay servidor de prueba dejado ejecutándose.

## 25. Carga

Mediciones ejecutadas en loopback sobre la misma máquina, usuarios sintéticos distintos y un token compartido por tanda; login previo no incluido en latencias. Son muestras pequeñas de una ejecución, no capacidad ni SLO del despliegue. Ver load-results.json, 12/11/2026 14:01 Bolivia:

| Alumnos | Éxitos | Errores/duplicados | p50 ms | p95 ms | Total ms |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 0 / 0 | 42.42 | 42.42 | 43.69 |
| 5 | 5 | 0 / 0 | 115.52 | 184.92 | 186.22 |
| 15 | 15 | 0 / 0 | 216.64 | 392.87 | 394.19 |
| 30 | 30 | 0 / 0 | 292.86 | 486.70 | 500.12 |
| 50 | 50 | 0 / 0 | 444.58 | 724.56 | 748.44 |

Incluye queries, lock serial de sesión y persistencia. El helper temporal arranca PostgreSQL con `-F` (fsync desactivado): la configuración de durabilidad tampoco representa producción. Otras tandas de regresión no se mezclan con estas métricas. No se midieron contención distribuida, Wi-Fi/datos, TLS/proxy ni cámara física. La pérdida de respuesta se probó con socket real; latencia/errores/suspensión frontend con simulaciones controladas.

## 26. Matriz móvil/aula

mobile-classroom-matrix.csv contiene 28 casos para Chrome Android y Safari iOS con campos fecha/dispositivo/navegador/esperado/observado/evidencia/estado. Todos los casos físicos están **NO PROBADO**, sin fechas o resultados ficticios. PILOT-PROTOCOL.md detalla primera/centro/última fila, matrícula, cierre/resumen, varios dispositivos, mala red y compartición fuera del aula.

Capturas de la simulación: student-simulated.png, student-uncertain-simulated.png, student-narrow-dark-simulated.png, auxiliary-dialog-simulated.png y auxiliary-fullscreen-simulated.png. SVG usa material sintético no aceptable por backend. No constituyen prueba de escaneo óptico ni login real en navegador.

## 27. Archivos intervenidos QR-6

Backend:

- `apps/backend-nest/src/main.ts` (CORS reutilizado)
- `apps/backend-nest/src/core/config/http-cors.config.ts` y `.spec.ts` (nuevos)
- `apps/backend-nest/src/services/attendances/attendance-qr-pilot-postgres.spec.ts` (nuevo)
- `apps/backend-nest/src/services/attendances/attendance-qr-backend-postgres.spec.ts`
- `apps/backend-nest/src/services/attendances/attendance-qr-token.service.spec.ts`

Frontend:

- `apps/materio-dashboard/src/hooks/attendances/useStudentQrAttendance.ts` y `.test.ts`
- `apps/materio-dashboard/src/hooks/attendances/useQrFullscreen.ts` y `.test.ts`
- `apps/materio-dashboard/src/views/attendance/AttendanceQrPresentationDialog.tsx` y `.test.tsx`
- `apps/materio-dashboard/test/attendance-qr-browser/{fixtures.ts,main.tsx,vite.config.mts,index.html}` (nuevos)

Documentación/evidencia nueva: este directorio, REPORT.md, RATE-LIMITING.md, PILOT-PROTOCOL.md, mobile-classroom-matrix.csv, environment-status.json, load-results.json y cinco PNG, http-results.json y validation-results.json. El resto de archivos dirty es previo y se conserva. No hay dependencias, entidades o migraciones nuevas.

## 28. Correcciones aplicadas

| ID | Gravedad | Causa y archivo | Solución | Regresión/evidencia |
| --- | --- | --- | --- | --- |
| F1 | MEDIO | useStudentQrAttendance: contexto tardío sobreescribía EXPIRED con READY, aunque token ya era null | No revivir READY sin token; una ownMark confirmada sigue mostrándose | Repro roja y luego 34/34 del hook; integrada 760/760 |
| F2 | MEDIO | main.ts no exponía Retry-After por CORS | Extraer opciones conservando origen/headers y exponer esa respuesta | HTTP 429 controlado con cabecera legible; 2 tests CORS |
| F3 | MEDIO | PresentationDialog solo limitaba ancho; fullscreen conservaba scroll | Limitar por altura viewport y volver arriba al entrar fullscreen | Tests de estilo/scroll y navegador: QR completo en diálogo/fullscreen, Escape |
| F4 | BAJO | Aviso QR-5 pendiente seguía visible por texto dividido entre líneas | Instrucciones de login y confirmación ya disponible | Test del mensaje y captura real de simulación |

No se encontró pérdida de datos o acceso indebido reproducible en los flujos revisados. Eso no certifica inexistencia universal de vulnerabilidades ni infraestructura externa.

## 29. Tests completos

- Backend completo con flags temporales: **103 suites/1019 pruebas aprobadas; 2 suites/9 pruebas optativas omitidas** (activities/grade-matrix). No se presentan esas integraciones omitidas como ejecutadas.
- Después se agregó pérdida de respuesta HTTP: suite piloto ampliada **7/7 aprobada**. No se suma esa ejecución otra vez al total completo ni se afirma una nueva ejecución global posterior.
- Contratos/concurrencia finales QR + CORS reejecutados después de reforzar la aserción emisión/close; **50/50 aprobados en 2 suites**; no se suman otra vez al total global.
- Frontend completo: **93 suites/760 pruebas aprobadas**.
- Procesos independientes, matrices temporales, migraciones/up/down y seeders se incluyeron en la regresión backend.

Avisos previos: resolutions en package frontend y deprecación pg por queries simultáneas de fixtures. Los logs de pruebas de importación contienen fallos deliberadamente simulados y no equivalen a suites fallidas. Se corrigieron los errores de estilo/tipos de los nuevos tests antes de cerrar la validación; no se atribuyen a fallos preexistentes.

## 30. TypeScript, lint, builds y formato

Comandos por aplicación: exec tsc --noEmit --incremental false, lint, build, format; más git diff --check. Se ejecutaron ambos builds sin actualizar versiones, omitir lint ni desactivar TypeScript. Resultados finales en validation-results.json. La primera compilación frontend falló por espacios en los tests nuevos; se corrigieron y reejecutó. Sin errores preexistentes de compilación demostrados en este trabajo.

## 31. Riesgos pendientes

| ID | Gravedad | Riesgo y situación |
| --- | --- | --- |
| R1 | ALTO | Ausencia de control de frecuencia compartido validado; bloqueo de aceptación |
| R2 | ALTO operativo | Sin claves/origen QR en archivos locales; estado desplegado/migraciones/grants no inspeccionado |
| R3 | ALTO operativo | HTTPS/certificados/red móvil y E2E completo no validados |
| R4 | ALTO residual | SQL privilegiado y cascades históricos; respaldo/retención/acceso SQL requieren control |
| R5 | MEDIO | Reenvío en tiempo real puede registrar alumno elegible fuera del aula; límite del modo QR |
| R6 | MEDIO | NTP/distribución de claves, proxy/APM y carga multinodo sin evidencia operativa |
| R7 | MEDIO | Móviles físicos, lector de pantalla, proyector y suspensión real pendientes |

No se han aceptado formalmente estos riesgos en nombre de la institución.

## 32. Checklist de aceptación

APROBADO se limita al alcance ejecutado indicado; revisión estática sola no aprueba una prueba física u operativa.

| Elemento | Estado | Evidencia/alcance |
| --- | --- | --- |
| Generación HMAC válida | APROBADO | API y tests criptográficos locales |
| Firma, canonicalidad, manipulación | APROBADO | Tests de servicio |
| Rotación/caducidad/límites | APROBADO | Tiempo exacto y espera lock PostgreSQL |
| Validación entre procesos | APROBADO | Dos procesos; no multinodo desplegado |
| Permisos/ownership/matrícula | APROBADO | HTTP/PG y login/sesión real local |
| Sin duplicados ni sobrescritura | APROBADO | UNIQUE, concurrencia y evidencia PG |
| Contexto seguro/DTO estricto | APROBADO | Contratos HTTP y proyecciones |
| Confirmación explícita | APROBADO | Tests y navegador con API simulada |
| Login y retorno frontend | APROBADO | Pruebas automáticas; no E2E visual real |
| Resultado incierto reconciliado | APROBADO | Socket cortado tras commit + own-mark y tests UI |
| Planilla/cierre/resumen | APROBADO | HTTP real local y policy/snapshot PG |
| MANUAL/GEO intactos | APROBADO | Regresiones ejecutadas |
| Migraciones aplicables/rollback | APROBADO | Solo PostgreSQL temporal |
| Grants/seeders idempotentes | APROBADO | Solo PostgreSQL temporal |
| no-store/no-referrer en entrada | APROBADO | Middleware/tests y comprobación HTTP local |
| Logs propios sin cuerpos QR | APROBADO | Auditoría + pruebas de errores/redacción; no proxy |
| Claves y origen local necesarios | BLOQUEADO | Ausentes en archivos inspeccionados |
| Migraciones/permisos desplegados | NO PROBADO | No se consultó la base real |
| HTTPS/dominio/cookies móviles | NO PROBADO | Sin entorno público autorizado validado |
| E2E navegador+backend unido | NO PROBADO | Procedimiento preparado, no ejecutado |
| Control de frecuencia compartido | BLOQUEADO | Diseño entregado, runtime pendiente |
| Pruebas móviles/aula/proyector | NO PROBADO | Matriz sin resultados inventados |
| NTP/rotación claves multinodo | NO PROBADO | Procedimiento, sin despliegue real |
| Carga 50 alumnos loopback | APROBADO | JSON con métricas; no SLO de aula |
| Carga y cambios de red del piloto | NO PROBADO | Requiere infraestructura/dispositivos |
| Proxy/APM/TLS externo | NO PROBADO | Fuera del entorno inspeccionado |

## 33. Procedimiento de despliegue autorizado

1. Crear entorno separado, respaldo y restauración ensayada; confirmar destino y aprobación del responsable. No ejecutar comandos contra una URL inferida.
2. Revisar historial y aplicar wrapper `pnpm --filter aux-system-uatf-backend migration:run` (each/preflight) solo con autorización del entorno. No cambiar migraciones históricas ni synchronize.
3. Sincronizar catálogos usando runner revisado sin datos demo (`SEED_DEMO_DATA` ausente/false); comprobar idempotencia y personalizaciones antes de autorizar `seed`. No se ejecutó aquí. Renovar access JWT por refresh/login: permisos están incluidos en el token; refresh/getSession consulta roles actuales. JWT viejo no cambia por editar seeds.
4. Aprovisionar claves exclusivas fuera de git, distribuirlas y monitorizar emisora/verificadoras. Configurar frontend público y API HTTPS, FRONTEND_URL y origen QR; reconstruir frontend porque NEXT_PUBLIC se incorpora en build.
5. Implementar y probar rate limiting compartido; validar CORS Retry-After, no-store/no-referrer a través del proxy, redacción de logs y relojes NTP.
6. Ejecutar E2E unido, matrices físicas y carga en ese entorno; revisar evidencia sin credenciales ni códigos completos. Solo después autorizar un piloto limitado.
7. Ante incidente deshabilitar emisión/check-in QR conservando MANUAL/GEO y evidencia. No revertir enums con QR existente; los down abortan. Preferir corrección hacia adelante y restauración bajo procedimiento revisado.

## 34. Requisitos para piloto

Cumplir los bloqueos de claves/origen/HTTPS, rate limiter y E2E unido, validar dispositivos/proyección y restauración. Piloto acotado a una materia, auxiliar responsable, matrículas controladas, horario y participantes definidos; monitoreo agregado y responsable para detenerlo. Aceptación docente explícita de que QR compartido puede funcionar fuera del aula. Matriz física y protocolo adjuntos deben registrar resultados reales antes de levantar la restricción.

## 35. Veredicto final

**NO LISTO.** No quedan defectos críticos/altos reproducidos sin corregir en las rutas académicas ensayadas, pero no se ha acreditado un entorno configurado que emita y abra QR desde teléfonos, y falta un control operativo indispensable. HTTPS, infraestructura desplegada y aceptación física no están demostrados. Declarar LISTO PARA PILOTO CONTROLADO o PRODUCCIÓN con solo tests locales sería incorrecto. El código y la evidencia están preparados para completar esas puertas sin modificar datos reales ni inventar cobertura.
