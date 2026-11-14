# Fase 7 — Hardening y validación de Attendance GEO

Fecha de revisión: 29/10/2026. Entorno: repositorio local Windows, PostgreSQL 16 temporal, navegador de escritorio integrado. El usuario confirmó que no existe actualmente un entorno HTTPS de pruebas.

**Veredicto: NO LISTO para uso académico real.** Las verificaciones locales son satisfactorias después de las correcciones, pero faltan el flujo completo con autenticación y base aislada de aplicación, HTTPS desde teléfonos, GPS físico y evaluación concurrente con participantes. No se modificó infraestructura ni la base de aplicación.

## 1. Estado real de las fases anteriores

Verificado en archivos; no se tomó el informe previo como prueba de implementación.

| Fase | Evidencia encontrada | Estado |
| --- | --- | --- |
| 2A/3, dominio | `src/common/utils/attendance-session-policy.ts`: estados derivados, política pura y SQL común; MANUAL computable; GEO solo CLOSED, activada y no cancelada | Implementada y probada automáticamente |
| 2B, modelo | Entidades Attendance/AttendanceSession, enums separados, migración `1792886400000-AttendanceGeolocationModel.ts`, CHECKs, evidencia nullable histórica | Implementada; up/down/up probado solo en clúster desechable |
| 3, operación | Controller y service: configure/activate/open-now/close/cancel, bloqueo de fila, freeze, permisos y protección de marcas | Implementada |
| 4, check-in | JWT/permisos, matrícula resuelta por backend, Haversine, códigos de dominio, proyección propia | Implementada |
| 5, auxiliar | `AttendanceGeolocationDialog`, mapa Leaflet, toolbar, planilla, historial, servicios y hooks | Implementada; componentes revisados visualmente con datos ficticios |
| 6, estudiante | Servicio `getMyAttendanceSessions` y `checkInAttendance`; `useStudentAttendanceCheckIn`; `StudentAttendanceCheckIn`; integración en `StudentEnrollmentView`; refresh de `StudentGradesView`; helper GPS y mapper | **Sí existe y está integrada**. Se detectó y corrigió una debilidad ante respuestas inciertas de red |

Frontend: `/dashboard/enrollments/[idEnrollment]`, sección independiente «Registro de asistencia». El componente usa matrícula propia activa y permiso, no el primer rol global. Se conserva el resumen académico separado.

Hay cambios pendientes de fases previas, algunos preparados en Git y otros sin preparar. Se conservaron; no se hicieron commits ni se revirtieron archivos ajenos.

## 2. Hallazgos de auditoría

| ID | Archivo / ámbito | Causa | Gravedad | Impacto y resolución |
| --- | --- | --- | --- | --- |
| H1 | `apps/materio-dashboard/src/hooks/attendances/useStudentAttendanceCheckIn.ts` | Un timeout/error de red del POST no disparaba consulta de estado; el intento volvía a habilitarse directamente | ALTO | Podía presentarse un fallo aunque el servidor hubiera guardado. Reproducido con tests rojos; corregido mediante reconciliación y bloqueo durante verificación |
| H2 | Mismo hook | Una consulta GET anterior al POST podía reutilizarse como refresco posterior | MEDIO | No garantizaba una lectura posterior al resultado. Se fuerza consulta nueva, se aborta la anterior y se ignoran respuestas obsoletas; prueba de GET demorado incluida |
| H3 | Mismo hook | Tras fallar la verificación, un «Actualizar» posterior podía confirmar la marca pero conservar el aviso antiguo | MEDIO | Mensajes contradictorios. Reproducido con test rojo; ahora la lectura confirmada sustituye el aviso |
| R1 | Entidades y migraciones de Enrollment/Attendance | CASCADE históricos de padres | ALTO residual | SQL físico privilegiado puede borrar evidencia por rutas padre-hijo. Las operaciones públicas habituales desactivan. No se cambiaron cascades; requiere revisión/migración independiente |
| R2 | Entorno local / `docker-compose.yml` | No hay HTTPS móvil preparado; valores de desarrollo HTTP | BLOQUEANTE de aceptación móvil real | No hay evidencia de GPS físico desde teléfono. No es una falla de Haversine ni del componente |
| R3 | Resumen propio con varios auxiliares | No existe asociación estudiante–auxiliar que resuelva el agregado | MEDIO residual | El resumen rechaza ambigüedad de forma controlada; check-in de sesión explícita sí funciona. No se inventó una asociación |
| R4 | Geolocation API | Coordenadas y accuracy proceden del cliente/dispositivo | ALTO residual | Suplantación de posición posible; no se declara presencia infalible ni se añadió QR |
| R5 | Despliegue | Migración/seed/JWT de aplicación no inspeccionados ni ejecutados | BLOQUEANTE para afirmar disponibilidad en ese entorno | Hay que verificar el despliegue autorizado antes del piloto |

No se encontró una operación pública ordinaria de borrado físico de User/Enrollment/Course/Semester que destruyera evidencia GEO. La revisión de cuenta desactivada frente a sesiones/JWT aún vigentes requiere aceptación de la política general de autenticación: `assertActiveSession` comprueba la sesión, no añade por sí misma un filtro de `User.isActive`. No se cambió esa política global en esta fase.

## 3. Correcciones implementadas

La única modificación productiva propia de Fase 7 está en `useStudentAttendanceCheckIn.ts`:

- Diferencia errores conocidos de dominio de respuestas POST inciertas (red, timeout, 500 sin código o respuesta inesperada).
- Bloquea nuevos intentos mientras consulta sesiones propias; nunca reenvía el POST automáticamente.
- Si el servidor confirma una marca, muestra información confirmada y mantiene bloqueado el check-in.
- Si la consulta no encuentra marca, muestra advertencia de incertidumbre y permite otro intento solo después de esa consulta. Una consulta vacía no demuestra que una transacción anterior nunca pudiera completarse: UNIQUE y bloqueo backend siguen resolviendo una carrera tardía.
- Si falla la verificación, conserva bloqueo y pide «Actualizar». Una consulta posterior actualiza también el mensaje.
- Fuerza una lectura nueva después de mutaciones y no deja que un GET antiguo sustituya la confirmación.
- Mantiene limpieza de posición local, cancelación de requests al desmontar y protección de callbacks tardíos.

Pruebas modificadas: `attendance-check-in-http.spec.ts`, `attendance-geolocation-postgres.spec.ts` y `useStudentAttendanceCheckIn.test.ts`. Se añadieron casos relevantes sin reescribir el módulo ni cambiar reglas académicas.

Se creó `apps/materio-dashboard/test/attendance-browser/` como fixture visual aislada, sin rutas productivas, credenciales, base de aplicación o GPS real. No se instalaron paquetes. Reutiliza Vite presente mediante Vitest y los componentes reales; reemplaza únicamente transportes y GPS en esa fixture.

No se crearon entidades, migraciones, endpoints, historial, dependencias ni cambios de theme/layout/providers globales.

## 4. Seguridad

### Permisos y ownership

- `attendance.check-in` está definido en `permissions.data.ts` y añadido al rol STUDENT en `roles.data.ts`. ASSISTANT no lo hereda accidentalmente.
- `RoleSeeder` agrega permisos faltantes a roles existentes preservando personalizaciones; no elimina permisos personalizados. Por tanto, no revoca automáticamente una concesión manual previa a otro rol.
- JWT válido pasa por `JwtStrategy` y validación de sesión activa. `PermissionsGuard` usa permisos, no `roles[0]`.
- El bypass de permisos de SUPERADMIN no evita la validación académica del service: el check-in siempre busca una matrícula STUDENT propia, activa, del curso/semestre de la sesión.
- El cuerpo contiene únicamente latitude/longitude/accuracy. DTO, whitelist y examen del body original rechazan identidad, matrícula, status, actor, método, timestamp o distancia enviados por cliente.
- El estudiante no tiene permiso de configuración, activación, apertura, cierre o cancelación. Nuevos tests HTTP verifican 403 para esas cinco acciones.
- Pruebas PostgreSQL rechazan otro curso, otro semestre, matrícula inactiva, rol académico incorrecto y usuario sin matrícula.

El test HTTP de SUPERADMIN comprueba propagación del rechazo de dominio con el service simulado; la resolución real de matrícula se prueba por separado contra PostgreSQL. No se presenta esa combinación como un E2E completo de autenticación persistida.

### Privacidad e instrumentación

- El GPS se invoca solo tras acción explícita. No se encontró `watchPosition`, captura al montar, intervalos de ubicación, almacenamiento en cookies/storage ni logging de coordenadas del estudiante.
- El helper compartido tiene una sola llamada a la API del navegador. El payload del estudiante se envía solo al endpoint backend; su vista no carga Leaflet ni conoce centro/radio.
- La respuesta de check-in y la lista propia usan proyecciones restringidas. Tests comprueban ausencia de datos ajenos, centro, radio y coordenadas.
- Accuracy/distancia se guardan como evidencia; no se almacenan coordenadas originales en Attendance. Las coordenadas del centro sí pertenecen a la sesión del auxiliar.
- En el repositorio no se encontró instrumentación de cuerpos de check-in con Sentry/Datadog/LogRocket/analytics. El interceptor Axios imprime estado HTTP, no cuerpos. El filtro backend no expone excepciones inesperadas y no imprime el body.
- La inspección no alcanza logs de proxies, APM o infraestructura externa inexistente/no proporcionada. Esa configuración debe revisarse al desplegar.

### Spoofing y accuracy

Haversine usa grados→radianes, radio terrestre medio 6.371.000 m, protección numérica y comparación antes del redondeo. Se conserva la fórmula existente.

`accuracy <= maximumAcceptedAccuracy` y `distance <= radiusMeters` son condiciones independientes; no se suma accuracy al radio. Se admiten igualdad con límites y accuracy cero conforme al contrato. **Accuracy expresa incertidumbre declarada por el dispositivo; no autentica el GPS ni garantiza presencia física.** Coordenadas manipuladas/GPS simulado pueden satisfacer ambas reglas. No se implementó una falsa detección infalible.

No hay protección de frecuencia específica de Attendance encontrada en el código. El mapper de 429 está probado/simulado; no implica que un rate limiter real esté desplegado.

## 5. Integridad académica

| Modo / estado | Cómputo académico | Ausencia sin marca |
| --- | --- | --- |
| MANUAL | Conserva regla histórica | ABSENT implícito |
| GEO DRAFT / SCHEDULED | No | No consolidar |
| GEO OPEN | No | Pendiente de presentación; no se persiste PENDING |
| GEO CLOSED por tiempo o manual | Sí | ABSENT implícito |
| GEO CANCELLED | No | No computa |

La política común y su condición SQL se usan tanto en numeradores como denominadores en AttendancesService y el resumen de EnrollmentsService. Tests comparan la política pura con SQL y comprueban PRESENT en OPEN sin aporte, consolidación al cerrar, EXCUSED y ponderación, ausencia implícita y comportamiento histórico MANUAL. No se modificaron fórmulas ni el paquete de cálculos.

Un error de GPS, área o precisión no inserta Attendance. Un fallo de red del cliente no crea un ABSENT explícito; la regla académica de ausencia implícita al cierre continúa vigente. Las excepciones técnicas se atienden con el registro manual autorizado.

Una marca GEO no puede sobrescribirse o eliminarse directamente; markAll no la destruye. Una sesión activada/cerrada/cancelada no se borra por la ruta pública de borrado GEO. Un DRAFT solo se elimina sin marcas, bajo bloqueo. Se permiten excepciones MANUAL en OPEN/CLOSED para estudiantes sin marca GEO. Corregir evidencia GEO requiere una futura capacidad con historial; no se añadió en esta fase.

### Integridad referencial

Rutas históricas existentes en entidades y migraciones:

- User/Course/Semester → Enrollment: CASCADE.
- Enrollment del auxiliar → AttendanceSession: CASCADE.
- Enrollment del estudiante → Attendance: CASCADE.
- AttendanceSession → Attendance: CASCADE.
- Attendance.markedBy → User: RESTRICT; no se cambia a CASCADE ni se inventa actor histórico.

RESTRICT del actor no es una política completa de conservación frente a todas las rutas padre-hijo. Otras FK pueden impedir algunas eliminaciones concretas; no se afirma que todo DELETE de User siempre tenga éxito. Course/Semester/Enrollment siguen siendo rutas relevantes a revisar con una migración separada, respaldos y control de permisos SQL.

En servicios públicos revisados, User/Course/Semester/Enrollment se desactivan mediante `isActive=false`. Borrar directamente desde SQL es distinto y queda fuera de esas protecciones de service.

## 6. Concurrencia

Todos estos casos se ejecutaron con PostgreSQL temporal, no solo con mocks:

| Carrera | Resultado comprobado |
| --- | --- |
| Check-in / check-in | Una marca; el perdedor devuelve ALREADY_REGISTERED, no 500 por UNIQUE esperado |
| Check-in / close | Marca anterior al cierre o rechazo SESSION_CLOSED; sin inserción posterior a sesión cerrada |
| Check-in / markAll | Se conserva el origen ganador; no se sobreescribe GEO |
| Check-in / corrección MANUAL individual | Una operación válida; se conserva PRESENT GEO o EXCUSED MANUAL |
| Configurar / activar | Configuración serializada y congelada tras activación |
| Cancelar / activar | Resultado coherente, cancelación válida antes de apertura efectiva |
| Close / close | Un cierre válido, estado final CLOSED |
| Solicitud esperando bloqueo hasta después de endsAt | Rechazo SESSION_CLOSED sin marca |

Se comparte bloqueo `pessimistic_write` de la fila AttendanceSession. `nowServer` se obtiene después de adquirirlo. El test unitario comprueba el timestamp posterior al bloqueo; el nuevo test real retiene la fila hasta cruzar endsAt.

Solicitudes de dos pestañas/dispositivos quedan cubiertas técnicamente por requests simultáneos y UNIQUE, pero **no se probaron dos dispositivos físicos**. No se midió capacidad para 30 participantes.

## 7. Frontend auxiliar

Validación en navegador de componentes reales, con transportes ficticios:

- Leaflet carga, teselas OSM visibles, marcador y círculo visibles, zoom y selección manual cambian el centro, atribución visible.
- GPS ficticio de 18 m no cambia el umbral editable de 50 m.
- Se configuró radio, se guardó y se verificaron confirmar/activar/programar, abrir ahora, freeze, cerrar y cancelar.
- Se probaron visualmente GPS denegado/no disponible/timeout/no API: el mapa permanece disponible para selección manual.
- Diálogo medido en 320/390/768/1280 px: sin desbordamiento horizontal interno observado. Hay scroll vertical necesario en móvil.
- Prueba de tema claro y oscuro en fixture MUI, sin cambios al theme real.
- Limpieza de Leaflet/ResizeObserver y contrato de selección están cubiertos por tests; build Next valida empaquetado y SSR de la aplicación.

La fixture no es el layout completo de Materio ni usa la base real. Creación MANUAL, historial, paginación, cambio de fecha, eliminación, EXCUSED y permisos se verifican en las suites; no se afirma un recorrido visual autenticado de toda la página real.

Evidencia: [escritorio](auxiliary-desktop.jpg), [móvil](auxiliary-mobile.jpg).

## 8. Frontend estudiante

- SUCCESS muestra registro y bloquea otro check-in; se preservan ownStatus y ownMarkedAt devueltos por backend, sin inventar timestamps de marcas manuales históricas.
- OUTSIDE_AREA/LOW_ACCURACY permiten reintento explícito. ALREADY_REGISTERED consulta estado y no se trata como fallo crítico.
- Se verificaron visualmente los mensajes de los nueve errores de dominio solicitados, los cuatro errores GPS, red, 401/403/429/500 simulados y recuperación de respuesta incierta confirmada.
- La simulación de 401 solo verifica el fallback visual. La renovación real de tokens sigue en el interceptor existente y sus tests; no se simuló una sesión real de producción.
- Se muestran todas las OPEN recibidas y solo la próxima SCHEDULED, identificadas por ID de sesión; no se elige silenciosamente otra sesión.
- Un timeout puntual al inicio/fin dispara consulta; no hay polling. Backend decide el estado. El botón Actualizar permite reconsultar.
- El resumen se refresca mediante la vista existente y `getMyStudentAttendance`; la prueba de integración confirma que OPEN no infla el porcentaje y que CLOSED muestra los valores nuevos del servidor.
- Las coordenadas se mantienen solo en variables locales durante la operación y se ponen en null después del POST y en finally. No se guardan en estado React o storage.
- Cambiar matrícula/desmontar aborta peticiones e ignora GPS/respuestas tardías. No se vuelve a pedir GPS sin pulsación.

Evidencia: [éxito simulado](student-success.jpg), [mensaje largo en móvil](student-mobile-denied.jpg), [resultados estructurados](browser-results.json). Todos son datos ficticios; no evidencia de ejecución física.

## 9. HTTPS y geolocalización móvil

**Comprobado:** proyecto local, sin página HTTPS según confirmación del usuario. Compose usa configuración HTTP de desarrollo; no se inspeccionó un proxy o despliegue externo.

Geolocation requiere contexto seguro y permiso. Loopback/localhost puede ser confiable en desarrollo; `http://IP-LAN:3000` desde un teléfono no debe tratarse como equivalente. Fuentes: [Geolocation API, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [Secure contexts, MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

**Propuesta pendiente de autorización:** entorno de pruebas aislado con dominio institucional y certificado TLS confiable; servir frontend y API por HTTPS, preferentemente bajo el mismo origen mediante proxy, revisar cookies/CORS/Permissions-Policy y evitar contenido mixto. Alternativa local: certificado de una CA de pruebas confiada expresamente en los dispositivos por su administrador. No se instalaron certificados ni se abrieron túneles/puertos externos. No desactivar validación TLS ni eludir avisos del navegador.

Pendientes: Android Chrome, iPhone Safari, permisos nativos, ubicación precisa/aproximada, teclado virtual, suspensión/reanudación, cambios de red y señal física. La prueba responsive de escritorio no sustituye esas pruebas.

## 10. Pruebas automatizadas

| Aplicación | Suites aprobadas | Suites omitidas | Tests aprobados | Omitidos | Fallidos finales |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend | 95 | 2 | 853 | 9 | 0 |
| Frontend | 83 | 0 | 617 | 0 | 0 |

Los 9 omitidos pertenecen a `activities.integration.spec.ts` y `grade-matrix.integration.spec.ts`, habilitados por flags de integración separados. No se activaron contra la base de aplicación. Las pruebas PostgreSQL de Attendance **no están omitidas**.

Los fallos rojos de reproducción de H1/H3 se resolvieron. El conjunto frontend incluye regresión MANUAL, historial, planilla, paginación, dirty state, permisos/auth, resumen propio y criterios académicos. El conjunto backend incluye reglas, pesos, EXCUSED, resúmenes, service/controller y autenticación/permisos.

Los 58 tests PostgreSQL están incluidos en los 853 del backend; no sumarlos otra vez. La suite HTTP específica de check-in aprobó 26 tests tras ajustar una aserción para lint estricto.

## 11. Pruebas PostgreSQL

**58 tests aprobados** en un clúster nuevo creado con initdb, usuario/puerto de prueba y directorio temporal. No usa DATABASE_URL de aplicación. El clúster se detuvo y limpió mediante su propio fixture.

Se ejecutan migraciones reales de Attendance sobre un contexto base mínimo controlado; no equivalen a validar toda la cadena de migraciones del monorepo con datos reales. Se comprueban defaults históricos MANUAL, nulls de evidencia sin inventar datos, tipos numeric/timestamptz, CHECKs, FK de actor, UNIQUE y ciclo up/down/up sin tipos enum huérfanos.

Casos adicionales: guardado individual contra check-in, geofence a 99.996 y 100.004 m (ambas evidencias redondearían a 100.00, pero solo la primera se acepta), expiración tras espera de bloqueo. Se conserva la independencia de accuracy y radio, igualdad del límite de accuracy, rechazo sin filas insertadas y ausencia de coordenadas originales.

No se ejecutaron migraciones, rollback, seeds ni limpieza en la base de aplicación. El DOWN de la migración GEO sería destructivo si se ejecuta después de generar evidencia real; no utilizarlo como procedimiento de producción sin una estrategia específica.

## 12. TypeScript, lint y build

| Comprobación por aplicación | Backend | Frontend |
| --- | --- | --- |
| TypeScript `exec tsc --noEmit --incremental false` | APROBADO | APROBADO |
| Lint | APROBADO final | APROBADO, sin advertencias ESLint |
| Build | APROBADO | APROBADO Next 14, incluidas páginas/SSR |
| Format completo | APROBADO | APROBADO |
| Tests completos | APROBADO, con omisiones explicitadas | APROBADO |
| `git diff --check` | APROBADO | APROBADO |

Comandos por filtros `aux-system-uatf-backend` y `aux-system-uatf-frontend`, conforme a AGENTS.md. No se usó check-types raíz como verificación principal.

Se corrigió una aserción nueva que accedía a un body de Supertest sin tipo aceptado por lint; sin cambios productivos por ese ajuste. Los errores de formato iniciales estaban en archivos editados y se corrigieron. No quedaron fallos preexistentes de compilación detectados. Persiste el aviso previo de PNPM sobre `resolutions` dentro de la aplicación. Los logs de errores controlados de importación pertenecen a pruebas negativas exitosas, no a fallos de Attendance.

## 13. Matriz de pruebas físicas

**Toda esta matriz está preparada, NO EJECUTADA.** Registrar dispositivo/modelo/OS/navegador, red y entorno, radio/umbral configurados, accuracy reportada, resultado/código y observaciones. No registrar coordenadas personales exactas, cuerpos de requests o identificadores personales en el informe.

| Caso | Plataforma y condiciones | Configuración propuesta (editable; no medida) | Qué comprobar | Estado |
| --- | --- | --- | --- | --- |
| P01 | Android Chrome, precisa, exterior, centro | Radio 50 m; accuracy máxima 50 m | Registro autorizado y una sola marca | NO PROBADO |
| P02 | iPhone Safari, precisa, exterior, claramente dentro | 50 / 50 m | Permiso nativo y registro | NO PROBADO |
| P03 | Ambas, cerca del borde | 50 / 50 m | Anotar incertidumbre y resultado; no asumir precisión física perfecta | NO PROBADO |
| P04 | Ambas, claramente fuera | 50 / 50 m | OUTSIDE_AREA sin marca | NO PROBADO |
| P05 | Interior/aula, señal deficiente | 50 / 50 m | LOW_ACCURACY si supera umbral; alternativa manual | NO PROBADO |
| P06 | Planta superior/inferior del mismo edificio | 50 / 50 m | Documentar limitación 2D: no distingue pisos | NO PROBADO |
| P07 | Ubicación aproximada | 50 / 50 m | Registrar accuracy real y resultado, sin ampliar radio | NO PROBADO |
| P08 | Permiso denegado y luego concedido | 50 / 50 m | Ningún POST al denegar; reintento explícito | NO PROBADO |
| P09 | Ubicación apagada/timeout | 50 / 50 m | Mensaje claro; ninguna marca técnica ABSENT | NO PROBADO |
| P10 | Wi-Fi → datos durante POST | 50 / 50 m | Reconciliación antes de repetir; ninguna confirmación falsa | NO PROBADO |
| P11 | Bloquear pantalla y reabrir | 50 / 50 m | Sin seguimiento; estado consultable al volver | NO PROBADO |
| P12 | Teclado/orientación vertical, 320–390 px reales | Auxiliar y estudiante | Acciones alcanzables, sin scroll horizontal | NO PROBADO |
| P13 | Dos pestañas y dos dispositivos de una cuenta ficticia | 50 / 50 m | Una marca y ALREADY_REGISTERED | NO PROBADO |
| P14 | Cierre mientras se obtiene GPS | 50 / 50 m | Backend rechaza después del cierre, UI retira acción | NO PROBADO |

Ejecutar P01–P14 en ambos sistemas cuando haya dispositivos. «50 / 50» es una propuesta para el ensayo, no un umbral aprobado por resultados físicos. Consultar `physical-tests.csv` para registrar cada corrida sin coordenadas.

### Evaluación concurrente con participantes

Crear únicamente cuentas/materia/semestre desechables con autorización. Usar 1, 5, 15 y 30 participantes si están disponibles; nunca sustituirlos por cifras inventadas.

| Participantes | Latencias / p95 | Fallos | Duplicados | Correspondencia de planilla y cierre | Estado |
| ---: | --- | --- | --- | --- | --- |
| 1 | Sin medir | Sin medir | Sin medir | Pendiente | NO PROBADO |
| 5 | Sin medir | Sin medir | Sin medir | Pendiente | NO PROBADO |
| 15 | Sin medir | Sin medir | Sin medir | Pendiente | NO PROBADO |
| 30 | Sin medir | Sin medir | Sin medir | Pendiente | NO PROBADO |

Registrar únicamente tiempos, códigos, conteos y alias de prueba; no cuerpos con posiciones. Comparar marcas únicas con planilla, cerrar y contrastar resumen/nota del servidor. Ver `concurrency-physical-tests.csv`.

## 14. Riesgos residuales

| Riesgo | Gravedad | Recomendación |
| --- | --- | --- |
| No hay validación móvil HTTPS/GPS real ni recorrido autenticado integral | BLOQUEANTE de aceptación | Preparar entorno aislado seguro y ejecutar matriz antes de uso académico |
| GPS/coordenadas manipulables, accuracy no auténtica | ALTO | Documentar límite; evaluar controles adicionales posteriormente; no prometer detección infalible |
| CASCADE físicos históricos | ALTO | Limitar SQL privilegiado, respaldos y diseñar migración de retención independiente |
| Sin prueba de carga con 1/5/15/30 participantes | MEDIO | Medir en piloto; el bloqueo de sesión serializa escrituras y no prueba capacidad por sí solo |
| Sin rate limiting específico verificado | MEDIO | Evaluar límites por usuario/sesión y observabilidad sin registrar coordenadas; no instalar por defecto |
| Varios auxiliares sin asociación explícita para resumen propio | MEDIO | Usar casos de piloto no ambiguos o cerrar regla de responsabilidad; no agregar arbitrariamente |
| No existe historial para corregir una marca GEO | MEDIO/capacidad pendiente | Mantener bloqueo; diseñar historial antes de permitir sobrescritura |
| Seed/migración/JWT reales no comprobados | BLOQUEANTE de despliegue | Verificar esquema y grants mediante proceso autorizado; renovar sesión/JWT |
| Logs de infraestructura no inspeccionados | MEDIO | Revisar proxy/APM y excluir cuerpos de check-in |
| Alcance de desactivación de cuenta frente a JWT vigente | Revisión general pendiente | Confirmar/revisar revocación de sesiones del sistema antes del piloto; no asumir que soft-disable revoca tokens automáticamente |

## 15. Checklist de aceptación

APROBADO se limita al alcance de evidencia indicado; no significa validación física o producción.

| Condición | Resultado | Evidencia / límite |
| --- | --- | --- |
| Fase 6 existe e integra servicio/hook/componente/resumen | APROBADO | Inspección y tests de integración frontend |
| MANUAL continúa funcionando | APROBADO | Regresión automatizada backend/frontend |
| GEO DRAFT se configura | APROBADO | PostgreSQL, tests y fixture visual |
| SCHEDULED no admite check-in | APROBADO | Tests service/estado y UI |
| OPEN admite check-in autorizado y geográficamente válido | APROBADO | Service real PostgreSQL, contratos HTTP y UI por separado |
| CLOSED consolida ausencias y OPEN no cambia nota | APROBADO | Política/SQL, summaries y prueba de refresh académico |
| CANCELLED no computa | APROBADO | Política y PostgreSQL |
| No duplicados ni 500 por UNIQUE esperado | APROBADO | PostgreSQL concurrente y manejo de conflicto |
| No sobrescritura/borrado público de GEO | APROBADO | Guards de service, HTTP y pruebas de concurrencia |
| No se guardan coordenadas estudiantiles ni se muestran datos ajenos | APROBADO | Modelo, DTO, respuestas, código y tests; infraestructura externa no inspeccionada |
| Mapa visible, círculo/selección/zoom/atribución | APROBADO | Navegador con componentes reales y datos ficticios |
| Errores comprensibles y recuperación de red | APROBADO | Tests y matriz visual simulada |
| Responsive sin desbordamiento a 320/390/768/1280 | APROBADO | Mediciones DOM y screenshots aislados |
| Experiencia de móvil físico y teclado virtual real usable | NO PROBADO | Sin dispositivos ni HTTPS de pruebas |
| Resumen coincide con backend en escenarios automatizados | APROBADO | Policy/SQL/PostgreSQL y refresh frontend |
| Flujo completo Next + Nest + JWT persistido + PostgreSQL + GPS real | NO PROBADO | Ningún recorrido autenticado real ejecutado |
| Entorno HTTPS móvil disponible actualmente | FALLIDO | Usuario confirma que solo existe entorno local |
| Esquema/seed/permisos/JWT desplegados en aplicación | NO PROBADO | No se tocó ni inspeccionó esa base |
| Carga real 1/5/15/30 y dos teléfonos | NO PROBADO | Matrices preparadas, sin métricas |
| Conservación ante DELETE SQL privilegiado | FALLIDO como garantía global | Persisten rutas CASCADE históricas; servicios públicos sí protegidos |

## 16. Veredicto final

**NO LISTO para permitir uso académico real.** No quedan fallos automáticos de las comprobaciones ejecutadas, pero eso no cubre GPS físico, HTTPS móvil, despliegue efectivo ni una sesión integral con participantes. La fase de hardening local y preparación de evidencias está completada; la aceptación física y de despliegue está pendiente.

Antes de pasar a piloto controlado:

1. Preparar entorno aislado HTTPS, con frontend/API seguros y sin datos reales; revisar logs, permisos SQL y respaldos.
2. Verificar y aplicar únicamente bajo autorización el esquema y la sincronización de permisos. El seed general ejecuta además otros seeders: revisar su alcance antes de usarlo; no se ejecutó aquí.
3. Renovar login/JWT y comprobar `attendance.check-in` con STUDENT, ausencia de grants accidentales en ASSISTANT y ownership real.
4. Completar una sesión auxiliar→estudiante→cierre→resumen con backend/base reales de prueba y Android Chrome; Safari en iPhone si se usará esa plataforma.
5. Ejecutar matriz de GPS, borde, precisión y red; registrar resultados sin coordenadas personales. Mantener alternativa manual autorizada.
6. Medir 1/5/15/30 participantes disponibles y comprobar planilla, duplicados y resumen posterior; no extrapolar la prueba concurrente de dos requests a capacidad de aula.
7. Definir las limitaciones aceptadas de spoofing, varios auxiliares, correcciones y retención; resolver los riesgos incompatibles con la política académica antes de evaluar para producción.

No se añadieron QR, reconocimiento facial, tracking, PostGIS ni promesas de invulnerabilidad.
