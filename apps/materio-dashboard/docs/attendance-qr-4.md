# QR-4 — Interfaz del auxiliar

Estado: implementado; validación automática completada. Pendiente validación manual en navegador real y dispositivos. El registro QR de extremo a extremo no está listo: la recepción del estudiante corresponde a QR-5.

## 1. Auditoría inicial

Rama `dev`, árbol con cambios previos de Attendance, GEO, QR-2B/QR-3 y seeders. Se conservaron esos cambios. Se leyó AGENTS.md y `apps/backend-nest/docs/attendance-qr-3.md`, contrastando controller, service y DTOs reales. Se reutilizan Axios, permisos, snackbar, hooks de asistencia, planilla, historial, lifecycle y conversión horaria institucional. La matrícula del auxiliar procede de la ruta y de `useEnrollment`. Los estados y la computabilidad vienen del servidor. No se modificaron backend, autenticación, middleware, esquema ni base de datos.

## 2. Archivos creados y modificados por QR-4

Rutas desde `apps/materio-dashboard`:

Creados:

- `src/configs/attendanceQr.ts`
- `src/configs/attendanceQr.test.ts`
- `src/hooks/attendances/useAttendanceQr.ts`
- `src/hooks/attendances/useAttendanceQr.test.ts`
- `src/hooks/attendances/useQrFullscreen.ts`
- `src/hooks/attendances/useQrFullscreen.test.ts`
- `src/utils/attendance-qr.ts`
- `src/utils/attendance-qr.test.ts`
- `src/views/attendance/AttendanceQrConfigDialog.tsx`
- `src/views/attendance/AttendanceQrConfigDialog.test.tsx`
- `src/views/attendance/AttendanceQrPresentationDialog.tsx`
- `src/views/attendance/AttendanceQrPresentationDialog.test.tsx`
- `docs/attendance-qr-4.md`

Modificados (algunos ya tenían cambios previos):

- `.env.example`
- `package.json`
- `src/api/attendances.service.ts`
- `src/api/attendances.service.test.ts`
- `src/app/dashboard/enrollments/[idEnrollment]/attendance/page.tsx`
- `src/hooks/attendances/useAttendances.ts`
- `src/hooks/attendances/useAttendanceRoster.ts`
- `src/interfaces/attendances/attendance.interface.ts`
- `src/utils/attendance-geolocation.ts`
- `src/views/attendance/AttendanceCreateDialog.tsx`
- `src/views/attendance/AttendanceCreateDialog.test.tsx`
- `src/views/attendance/AttendanceSessionBadge.tsx`
- `src/views/attendance/AttendanceSessionToolbar.tsx`
- `src/views/attendance/AttendanceHistory.tsx`
- `src/views/attendance/AttendanceSidebar.tsx`
- `src/views/attendance/AttendanceSheet.tsx`
- `src/views/attendance/AttendancePage.test.tsx`

También se actualizó `pnpm-lock.yaml` en la raíz. Archivos preexistentes que eran untracked siguen siendo preexistentes; esta lista describe la intervención QR-4, no todo `git status`.

## 3. Librería QR

`qrcode.react` **4.2.0**, versión exacta, compatible con React 18. No existía un renderer QR utilizable en la aplicación. SVG generado localmente, sin solicitudes a generadores externos, sin escáner ni dependencias de cámara. No se actualizaron React, Next ni MUI. Instalación PNPM con scripts deshabilitados. Fuente oficial: https://github.com/zpao/qrcode.react.

## 4. Contrato API integrado

Todas las rutas usan la instancia Axios existente, con prefijo `/api` ya configurado:

| Operación | Método y ruta | Datos |
| --- | --- | --- |
| Crear borrador | POST `/attendances/sessions` | enrollmentId, date, mode=QR |
| Configurar QR | PATCH `/attendances/sessions/:id/qr` | startsAt, endsAt, ambos obligatorios |
| Emitir código | GET `/attendances/sessions/:id/qr` | sin body; admite AbortSignal |
| Lifecycle | PATCH `/attendances/sessions/:id/activate`, `/open-now`, `/close`, `/cancel` | métodos existentes |
| Eliminar borrador | DELETE `/attendances/sessions/:id` | método existente |

Configuración y emisión desenvuelven `response.data.data`. La emisión utiliza exclusivamente idAttendanceSession, token, serverNow, rotateAt y expiresAt. Se valida identidad, formato básico y coherencia temporal de la respuesta antes de presentarla. No hay check-in frontend.

## 5. Creación

Selector Manual / Geolocalización / Código QR con explicación del modo elegido. QR crea DRAFT y abre configuración, sin activación automática ni coordenadas. Un bloqueo inmediato evita doble mutación incluso antes del siguiente render. Si el borrador se creó pero falla cargar el detalle o actualizar el historial, se informa que debe retomarse desde historial, sin repetir automáticamente el POST.

## 6. Configuración temporal

Diálogo dedicado sin mapa, GPS ni campos GEO. Inicio y fin obligatorios y válidos; fin posterior a inicio. Se reutilizan utilidades `America/La_Paz` y conversión con offset de Bolivia, independientes del huso del dispositivo. Guardar actualiza respuesta, detalle e historial; no activa. Confirmación antes de descartar cambios y protección beforeunload. Backend mantiene autoridad académica.

## 7. Activación

Solo DRAFT con configuración guardada. Confirmación con horario y advertencia de congelación. El estado devuelto por backend determina SCHEDULED u OPEN. Los campos quedan de solo lectura al activarse.

## 8. Apertura inmediata

Solo DRAFT con fin guardado, sin cambios pendientes. Confirmación informa que el servidor establecerá el inicio actual. El cliente no fabrica timestamps de apertura ni simula éxito ante fin vencido.

## 9. Cierre y cancelación

OPEN permite cierre con confirmación. DRAFT/SCHEDULED permiten cancelación con autoridad final del backend. CLOSED/CANCELLED son inmutables respecto de configuración y emisión. Borrador limpio puede eliminarse con permiso y confirmación. Lifecycle refrescado en límites horarios y al recuperar foco; la UI nunca deriva OPEN para habilitar emisión por su cuenta.

## 10. Presentación

Diálogo amplio con materia/grupo, atribución UATF, estado, QR SVG, contador y actualización. Fondo blanco, código negro, margen de cuatro módulos, proporción cuadrada, sin logos ni texto superpuesto. El tamaño se adapta a móvil/escritorio y fullscreen. MUI usa el tema existente; el área de escaneo conserva blanco/negro también en tema oscuro.

## 11. URL y origen público

Única fuente: `NEXT_PUBLIC_ATTENDANCE_QR_ORIGIN`, documentada en `.env.example`. Configurar antes de construir el frontend, por ejemplo un dominio institucional HTTPS real y accesible desde los teléfonos. No se asignó un dominio ficticio de producción. Requiere origen raíz HTTPS sin credenciales, path, query ni fragmento; rechaza localhost, IP literales y nombres local/internal. No utiliza window.location.origin ni valores introducidos por usuarios.

Resultado: `ORIGEN/attendance/qr#t=TOKEN`. El fragmento evita que el token viaje en la petición HTTP de navegación; no impide capturas, historial o compartición. La validación sintáctica del origen no demuestra accesibilidad DNS/TLS/red: verificarla manualmente. Sin configuración válida se muestra aviso y no se pide token.

## 12. Fullscreen

Acción explícita mediante Fullscreen API sobre el contenedor. Se sincroniza con fullscreenchange, incluida salida con Escape. Incompatibilidad o rechazo muestran aviso y mantienen el diálogo. Al desmontar se sale de fullscreen propio, incluso si una petición de fullscreen termina tarde.

## 13. Rotación

Solo se pide QR para sesión QR OPEN con permiso. Cada rotateAt provoca una nueva petición al backend, sin HMAC en frontend ni polling HTTP por segundo. Se conserva el SVG anterior mientras llega el siguiente y solo dentro de su validez. Single-flight y generaciones evitan duplicados y respuestas obsoletas. La renovación normal es silenciosa.

## 14. Countdown

Se usa serverNow como referencia y tiempo transcurrido con performance.now y reloj de pared; el mayor avance impide extender vigencia por un retroceso del reloj. La duración de ida y vuelta se incorpora conservadoramente para retirar antes el código, nunca extender expiración. El contador visual es orientativo y se actualiza localmente; el servidor decide la validez.

## 15. Expiración

expiresAt es el límite efectivo, incluida la gracia y cualquier recorte por fin de sesión. Se retira el código al alcanzar el límite conservador. No se almacena ni presenta indefinidamente un código vencido. Al volver a foco/visibilidad se descarta la referencia anterior y se solicita código vigente, cubriendo suspensión y cambios de hora.

## 16. Desconexiones

Un fallo muestra “No se pudo actualizar el código QR”. Código anterior solo durante validez; luego se oculta. Reintento manual con bloqueo de petición simultánea; no hay bucles agresivos tras errores. Recuperar conexión/foco puede pedir uno nuevo. Respuestas terminales retiran código, detienen renovación y refrescan la sesión.

## 17. Limpieza

Al cerrar/cambiar sesión se abortan GET pendientes, invalidan generaciones y limpian timers/listeners. Tokens y URL viven únicamente en memoria local del diálogo/hook; no en estado global, localStorage, sessionStorage ni cookies. Al reabrir se obtiene un código nuevo. Las mutaciones ya enviadas no se repiten automáticamente al cerrar.

## 18. Errores

Mapper seguro con allowlist para errores QR/lifecycle reales, permisos y rate limiting. Fallback genérico que no muestra mensajes criptográficos, tokens ni cuerpos del backend. El interceptor Axios existente registra únicamente status genérico; no se añadieron logs de token, URL o respuesta. Respuestas de otra sesión no se muestran. CLOSED, CANCELLED, NOT_STARTED, NOT_FOUND, CONTEXT_INVALID, QR_NOT_AVAILABLE y errores de autorización detienen presentación.

## 19. Permisos

Se usa hasPermission: attendance.session.create, attendance.session.update, attendance.session.delete, attendance.qr.get y attendance.save. No se añadieron roles/permisos ni se decide por rol global en los componentes nuevos. Ownership y autorizaciones siguen siendo comprobados por backend.

## 20. Protección de evidencia

Se extiende la detección protegida a registrationMethod GEOLOCATION o QR. Planilla bloquea edición de esa fila; hook impide cambios y excluye evidencia del payload manual. Si aparece evidencia durante una actualización se descarta el borrador conflictivo. markAll queda bloqueado al conocer evidencia protegida; backend sigue protegiendo marcas fuera de la página visible y concurrencia. AttendanceStudentRow reutiliza su propiedad disabled existente; no necesita una segunda implementación.

## 21. Planilla

QR DRAFT/SCHEDULED/CANCELLED no permite edición; OPEN/CLOSED permite excepciones MANUAL con permiso. No se altera PRESENT/ABSENT/EXCUSED ni se persiste PENDING. OPEN permanece sin consolidar; CLOSED consume resultados consolidados del backend. No se cambió fórmula académica.

## 22. Historial

Badge Código QR más estado, sin token, MAC, firma o URL. Edición de fecha reservada a MANUAL; eliminación QR solo DRAFT limpio. La selección recupera el diálogo QR correspondiente; estados no computables muestran pendientes/sin consolidar siguiendo el patrón GEO.

## 23. Compatibilidad MANUAL

Se conserva el contrato de creación histórico, edición de fecha, guardado, observaciones, EXCUSED, markAll sin evidencia protegida, eliminación y resúmenes. Pruebas existentes de estos flujos pasan.

## 24. Compatibilidad GEO

Se conservan mapa, GPS, configuración, lifecycle, permisos, check-in existente y protección de evidencia. Utilidades compartidas solo generalizan las reglas aplicables a autorregistro. Pruebas GEO existentes pasan. No se implementa GEOLOCATION_QR.

## 25. Tests nuevos

Seis archivos nuevos de pruebas: origen/URL, hook de emisión, fullscreen, configuración/lifecycle, presentación y errores seguros. También se ampliaron pruebas de servicio, selector y página integrada. Cobertura: hora Bolivia, validación, confirmaciones, doble clic, cinco estados QR/GEO, evidencia, envelope, emisión solo OPEN, countdown y rotación con fake timers, gracia/expiración, red/reintento, cancelación/obsolescencia, foco, privacidad y fullscreen. Pruebas con contratos mockeados y harness React existente; no equivalen a un navegador real ni a integración contra una BD desplegada.

## 26. Suite frontend completa

`pnpm --filter aux-system-uatf-frontend test`: **89 suites, 678 tests aprobados**. La primera ejecución de las pruebas existentes pasó con 83 suites/617 tests. No se ejecutaron migraciones, seeds ni escrituras en BD.

## 27. TypeScript, lint y build

- `pnpm --filter aux-system-uatf-frontend exec tsc --noEmit --incremental false`: aprobado.
- `pnpm --filter aux-system-uatf-frontend lint`: aprobado, sin warnings/errors ESLint.
- `pnpm --filter aux-system-uatf-frontend build`: producción aprobada.
- `pnpm --filter aux-system-uatf-frontend format`: aprobado.
- `git diff --check`: aprobado.

## 28. Incidencias del entorno y advertencias previas

Las primeras ejecuciones restringidas fallaron por permisos EPERM en temporales de Vitest y salida .next. Se repitieron con acceso permitido y pasaron. PNPM advierte de resolutions definido en el package de frontend; instalación también señaló peers existentes de cobertura Vitest y ApexCharts. No se cambiaron dependencias ajenas para resolver esos avisos. No se detectaron fallos funcionales preexistentes en la suite ejecutada. El árbol previo contiene numerosos cambios pendientes y debe revisarse aparte al preparar un commit.

## 29. Validación manual pendiente

Navegador real, login del auxiliar contra backend QR-3 y ownership real, dominio público DNS/TLS accesible desde Wi-Fi/datos, Chrome/Firefox/Safari, fullscreen móvil/Escape, contraste claro/oscuro, suspensión real del portátil, pérdida de conexión y cierre desde otra pestaña. Proyectar desde un aula y escanear con cámara física para verificar distancia/tamaño. Comprobar que proxy/CDN conserva Cache-Control: no-store; Axios no añade caché persistente. El renderer es local, pero no se certifica aquí infraestructura externa ni legibilidad física. No se modificó la configuración real de producción.

## 30. Pendientes exactos QR-5

Implementar recepción `/attendance/qr`, captura segura del fragmento y retirada de URL visible, conservación temporal segura durante login, regreso sin open redirects, contexto mínimo de sesión y confirmación explícita mediante POST existente. Resultado y errores del estudiante, incluidos vencimiento durante login y repetición. Política no-store/no-referrer en recepción. No marcar mediante GET ni vista previa. No crear autenticación paralela, GPS ni seguimiento para QR independiente. El enlace de QR-4 apunta a esa ruta futura; la presentación lo advierte expresamente y no se creó una página vacía que simule éxito. Compartición del QR en tiempo real sigue siendo riesgo residual.
