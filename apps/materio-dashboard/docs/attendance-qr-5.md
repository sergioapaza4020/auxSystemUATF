# QR-5 — Registro QR del estudiante

Implementación funcional terminada. No se declara lista para producción: QR-6 debe validar despliegue, infraestructura, seguridad operativa y dispositivos físicos.

Clasificación de evidencias:

- **IMPLEMENTADO Y PROBADO:** pruebas automáticas descritas y comprobación HTTP local de producción.
- **IMPLEMENTADO PERO NO VALIDADO EN NAVEGADOR REAL:** navegación interactiva completa, login contra un entorno desplegado y comportamiento móvil físico.
- **PENDIENTE:** configuración y validación integral QR-6, sin ejecutar seeds/migraciones sobre la aplicación.

## 1. Auditoría inicial

Se leyó AGENTS.md, revisó rama `dev` y preservó el árbol con numerosos cambios previos. Se contrastaron documentación QR-3/QR-4, controller/service/DTO reales, AuthProvider, Login, middleware, Axios, cookies, permisos, páginas públicas y asistencia GEO. No se encontró un informe QR-2A independiente utilizable; se respetaron sus contratos documentados en QR-3/QR-4 y el código real.

El login existente guardaba JWT mediante sus utilidades y siempre regresaba a `/dashboard`. AuthProvider omite carga automática en rutas públicas; `refreshUser` verifica `/auth/me` mediante el cliente común y su refresh existente. Axios coordina refresh y emite SESSION_EXPIRED_EVENT antes de redirigir a `/login` si falla. Los endpoints QR ya tenían permisos, matrícula propia, firma, expiración, locks y evidencia. No fue necesario modificar backend, entidades, migraciones, roles ni dependencias.

## 2. Archivos nuevos

Rutas relativas a `apps/materio-dashboard`:

- `src/app/attendance/qr/page.tsx`
- `src/app/attendance/qr/layout.tsx`
- `src/hooks/attendances/useStudentQrAttendance.ts`
- `src/hooks/attendances/useStudentQrAttendance.test.ts`
- `src/interfaces/attendances/student-qr.interface.ts`
- `src/utils/student-qr-flow.ts`
- `src/utils/student-qr-flow.test.ts`
- `src/utils/student-qr-errors.ts`
- `src/utils/student-qr-errors.test.ts`
- `src/views/attendance/StudentQrAttendance.tsx`
- `src/views/attendance/StudentQrAttendance.test.tsx`
- `src/test-utils/qr-fixtures.ts`
- `docs/attendance-qr-5.md`

## 3. Archivos modificados

- `.env.example`: descripción de la recepción ya implementada; sin configurar secretos ni dominio real.
- `src/api/attendances.service.ts` y `.test.ts`: contratos estudiantiles QR y pruebas.
- `src/api/config/config.test.ts`: prueba del interceptor real ante refresh fallido. No cambia el interceptor de producción.
- `src/configs/publicRoutes.ts`: helper compartido con excepción QR exacta.
- `src/middleware.ts` y `.test.ts`: entrada pública y cabeceras específicas.
- `src/providers/AuthProvider.tsx` y `.test.tsx`: reutilización del helper público y limpieza QR al logout.
- `src/views/Login.tsx` y `.test.tsx`: destino fijo después de autenticar.
- `src/views/attendance/AttendanceQrPresentationDialog.tsx`: reemplaza aviso histórico de QR-5 pendiente por instrucciones de confirmación expresa.

El resto de cambios visibles en git status pertenece a trabajos anteriores y se conserva. No se instalaron paquetes, no se alteró el theme global ni se modificó la fórmula académica.

## 4. Ruta pública QR

`/attendance/qr`, App Router, con Providers y BlankLayout existentes. Render dinámico y sin indexación. La excepción pública QR usa igualdad exacta; no abre `/attendance`, subrutas o prefijos similares. Se mantiene el comportamiento previo de las demás rutas públicas y protegidas. Publicar la página no vuelve anónimos los endpoints académicos.

## 5. Captura de fragmento

Captura cliente después de montar. Un solo parámetro `t`, sin claves adicionales, formato ASCII q1 acotado, máximo 128 caracteres y referencia decimal canónica de sesión positiva hasta 2147483647. El ID únicamente construye la ruta; no autentica ni autoriza. La firma y vigencia se comprueban exclusivamente en backend. Entrada ausente/ambigua/inválida muestra el mensaje de reescaneo, sin consultar perfil ni contexto académico.

## 6. Limpieza de URL

Se usa history.replaceState conservando history.state de Next y pathname/search. Se retira el fragmento sin recargar, también si es inválido. No se incorpora token a query, login, Snackbar o logs. El hash no viaja en la solicitud HTTP inicial; retirarlo no garantiza borrado de capturas, sincronización o historial previo del navegador.

## 7. Autenticación

Sin credenciales disponibles se conserva la transferencia y se navega al login habitual. Con credenciales, `refreshUser` verifica el perfil usando JWT/refresh existentes antes del contexto. No se considera una cookie prueba de autorización. El hook espera esa verificación y usa usuario/permisos del AuthProvider. No implementa login ni criptografía alternativos. Sin permiso attendance.qr.check-in no consulta contexto ni escribe asistencia.

## 8. Retorno seguro

Login solo elige entre `/dashboard` y `/attendance/qr`. La señal temporal es fija y se consume una vez; nunca acepta returnTo ni URL desde fragmento, parámetros o almacenamiento. Login normal conserva el panel y los errores de credenciales existentes. Una entrada restaurada sin autenticación no redirige automáticamente una y otra vez: ofrece iniciar sesión.

SESSION_EXPIRED_EVENT conserva la transferencia sincrónicamente antes de que el interceptor existente navegue al login. Si el token ya se eliminó y solo se está reconciliando un resultado, se conserva exclusivamente el ID de sesión como referencia de lectura propia, sin token ni estado académico; al volver se ejecuta solo GET own-mark, nunca un POST de asistencia.

## 9. Almacenamiento y limpieza

Token en un ref local mientras se usa. sessionStorage se emplea únicamente al cruzar login, clave `uatf.attendance.qr.login.v1`, limitada a la pestaña/origen. No localStorage, cookies ni store global. La transferencia tiene retención máxima de diez minutos, límite de transporte que no modifica los 30+5 segundos de validez criptográfica. Se consume y elimina al retornar.

Se limpia al confirmar/encontrar marca, detectar rechazo definitivo, reemplazar QR, abandonar, logout y desmontaje ordinario. Un desmontaje hacia login conserva solo la transferencia necesaria. Si el navegador bloquea storage, se informa y se ofrece ir al panel/iniciar sesión y reescanear. Un límite local de 35 segundos desde la recepción acota la permanencia del token en una página activa; no genera códigos ni extiende validez. La suspensión del navegador y eliminación física de memoria requieren validación de QR-6. sessionStorage sigue siendo accesible ante XSS.

## 10. Servicios API

Cliente Axios existente, prefijo `/api`, envelope `response.data.data`:

| Método | Ruta | Payload/respuesta |
| --- | --- | --- |
| POST | `/attendances/sessions/:id/qr-context` | `{ token }`; contexto mínimo y ownMark, sin inserción |
| POST | `/attendances/sessions/:id/qr-check-in` | exclusivamente `{ token }`; SUCCESS, idAttendance, PRESENT, QR, markedAt |
| GET | `/attendances/sessions/:id/qr-own-mark` | sin token; `{ ownMark }` o null |

Todos admiten AbortSignal. Ninguno envía identidad, matrícula, status, método, hora, actor, curso o GPS desde el estudiante. ownMark conserva status, registrationMethod y markedAt nullable histórico. No se usa el detalle administrativo de sesión.

## 11. Hook

useStudentQrAttendance coordina recepción, verificación de auth, contexto, confirmación, reconciliación, feedback y limpieza. Usa refs de bloqueo inmediato, AbortController, secuencias de recepción y comprobación de identidad vigente. Respuestas de un QR anterior o de otro usuario no sustituyen la pantalla actual. Cambio de identidad limpia contexto/marca antes de cargar los nuevos. No importa el hook GEO ni solicita ubicación.

## 12. Estados

INITIALIZING, AUTH_REQUIRED, LOADING_CONTEXT, READY, SUBMITTING, SUCCESS, ALREADY_REGISTERED, EXPIRED, ERROR y UNCERTAIN. Lectura propia y Retry-After tienen estado separado. No hay máquina de estados externa ni estado académico persistido en frontend. La vigencia real pertenece al backend; al faltar serverNow en contexto no se inventa un contador exacto desde el reloj del teléfono.

## 13. UI

Pantalla MUI con materia/grupo, fecha, inicio/fin en Bolivia, estado consultado, confirmación y resultado propio. No muestra otros alumnos, notas, coordenadas, permisos, actores, token o firma. PRESENT, EXCUSED y ABSENT se muestran con su método real. Después del resultado permite consultar registro e ir al panel existente.

## 14. Confirmación explícita

Solo el botón Confirmar asistencia llama check-in. Montaje, login, fragmento, contexto, refresco o vista previa no insertan Attendance. Bloqueo inmediato de doble clic y controles deshabilitados durante envío. El resultado SUCCESS debe indicar PRESENT y QR antes de presentarse como éxito.

## 15. Caducidad

QR_TOKEN_EXPIRED retira el secreto y solicita reescaneo; no reintenta el token ni solicita ampliación. Lo mismo ocurre ante token inválido y rechazos terminales. Un código vencido durante login se rechaza al consultar backend. No hay reserva de validez por escanear o autenticar antes.

## 16. Duplicados

ownMark existente impide check-in. ALREADY_REGISTERED consulta lectura propia; QR, MANUAL y EXCUSED se identifican correctamente. No atribuye una marca manual al escaneo actual. Backend mantiene UNIQUE y locks como defensa final.

## 17. Resultados inciertos

Red/timeout/5xx después del POST puede significar respuesta perdida: no se repite la escritura. Se consulta own-mark. Marca existente confirma su origen real; null conserva UNCERTAIN y advierte que el POST todavía podría completarse. Solo se ofrece otra lectura. Si se necesita intentar de nuevo, se requiere reescaneo y nuevo contexto autorizado, sin retry ciego. También se preserva una referencia de solo lectura si expira auth durante reconciliación. Una lectura posterior vacía retira la marca previamente mostrada y no afirma un fallo definitivo del envío.

## 18. Seguridad y privacidad

Ruta QR responde Cache-Control: no-store y Referrer-Policy: no-referrer mediante middleware específico; metadata también restringe Referer. HTTP local contra el build de producción confirmó **200, no-store, no-referrer, sin redirección**. Ruta similar `/attendance/qr-other` respondió **307 a login**. No se verificaron CDN/proxy reales.

No se añadieron scripts, mapas, generadores externos ni analítica. Se revisaron root/layout/Providers y configuración de Axios: no se registran cuerpos QR ni URL completa. Los logs existentes de Axios usan status genérico. No HMAC/JWT de usuario en el QR. No se consultó ni modificó la base de aplicación. Id de recibo solo orienta una lectura cuyo permiso/matrícula valida el backend.

## 19. Responsive

Container sm, espaciados para xs/sm, ancho adaptable, botones grandes y confirmación de altura mínima 52. Se reutilizan colores del theme claro/oscuro. Implementado y comprobado por render automático; sin validación visual en navegador o móvil físico en esta fase.

## 20. Accesibilidad

Encabezado h1, nombres claros, estados de carga con role/status y aria-label, región aria-live y Alerts. Resultado no depende únicamente del color. Foco y navegación usan componentes MUI existentes. Pendiente teclado y lector de pantalla reales.

## 21. Tests QR

Cuatro suites nuevas: parser/transferencia, errores, hook y UI. Fixtures sintéticas sin claves reales. Casos de fragmento ausente/ambiguo/largo, limpieza conservando Next state, contexto y ausencia de POST automático, doble clic, caducidad, marcas previas, red y lectura incierta, cancelación, respuesta tardía, nuevo QR, cambio de usuario, limpieza, GPS no llamado y ausencia de logs/persistencia prolongada. El harness React y renderToStaticMarkup no equivalen a un navegador interactivo.

## 22. Tests Auth

Se ampliaron Login, AuthProvider, middleware e interceptor Axios. Cubren panel normal, retorno QR fijo, rutas exactas, refresh fallido, almacenamiento consumido, logout y protección de rutas. Se prueba recuperación mediante referencia de lectura cuando ya no hay token. Se reutilizan pruebas existentes de login/refresh/registro de cuenta y permisos; no se crea autenticación paralela ni se afirma un E2E con credenciales reales.

## 23. Regresión MANUAL/GEO

Suite existente de StudentAttendanceCheckIn, servicios, resumen académico, vistas de matrícula, planilla, historial, GEO y auxiliar QR aprobada. Sin cambios en fórmulas, notas, evidencia backend o políticas de matrícula. En QR-4 solo cambia el aviso que antes anunciaba QR-5 pendiente.

## 24. Suite completa

Ejecución final: **93 suites y 759 pruebas aprobadas**. La base reportada de QR-4 era 89 suites/678 pruebas. Se ejecutaron pruebas frontend con APIs mockeadas; no seeds, migraciones o integración con la base de aplicación.

## 25. Controles del proyecto

- `pnpm --filter aux-system-uatf-frontend test`: aprobado.
- `pnpm --filter aux-system-uatf-frontend exec tsc --noEmit --incremental false`: aprobado.
- `pnpm --filter aux-system-uatf-frontend lint`: aprobado.
- `pnpm --filter aux-system-uatf-frontend build`: aprobado, ruta `/attendance/qr` dinámica.
- `pnpm --filter aux-system-uatf-frontend format`: aprobado.
- `git diff --check`: aprobado.

Servidor Next temporal utilizado solo para GET de entrada pública y redirección de ruta vecina; detenido después. No hubo inserciones académicas reales.

## 26. Incidencias previas/del entorno

PNPM sigue avisando del campo resolutions definido en el package frontend. No se cambian versiones para resolverlo. No se observaron fallos funcionales preexistentes en la suite. El primer intento HTTP local falló por restricciones de sockets; repetido con permiso adecuado, pasó. Se normalizaron finales de línea de los archivos intervenidos; sin reformateo masivo del repositorio. Se preserva el trabajo previo sin stage/commit.

## 27. Configuración pendiente

Verificar en entorno autorizado migraciones QR-2B, catálogo/grants attendance.qr.check-in para estudiantes y attendance.qr.get para auxiliares; renovar JWT según mecanismo actual. Configurar claves HMAC backend fuera de git, NEXT_PUBLIC_ATTENDANCE_QR_ORIGIN público HTTPS, API/login HTTPS accesibles desde móvil y relojes coordinados. No se ejecutó ninguna de estas operaciones en la base desplegada.

## 28. Móvil/navegador real

Pendiente cámara nativa Android/iPhone, paso cámara→navegador, cookies/login reales, retorno tras login lento, viewport pequeño, tema oscuro, lector de pantalla, background/suspensión, storage deshabilitado, conectividad del aula y flujo auxiliar-estudiante contra backend desplegado. La comprobación HTTP local no prueba esos comportamientos ni constituye validación visual.

## 29. Riesgos residuales

Compartir QR en tiempo real sigue siendo posible: no prueba presencia física infalible. XSS puede leer storage y tokens en memoria; el fragmento puede ser capturado antes de limpiarse. Gateway/APM/proxy y extensiones del navegador requieren revisión. Rate limiting compartido, Retry-After de infraestructura, carga de aula, relojes distribuidos y cascades históricos siguen pendientes de QR-6. Deshabilitar un botón no sustituye autorización, UNIQUE, transacciones o expiración del servidor.

## 30. Preparación QR-6

Validar E2E con datos controlados y autorización de entorno, permisos/matrículas/multirrol reales, dos usuarios y sesiones simultáneas, pérdida de respuesta y cierre concurrente, emisión entre instancias, expiración/gracia, protección de evidencia y computabilidad con sesiones consolidadas. Revisar TLS/orígenes, headers en proxy/CDN, redacción de logs/APM, CSP/terceros, rate limiting por identidad sin bloquear Wi-Fi compartida y retención/recuperación. Completar pruebas físicas móviles/proyector y aceptación del riesgo de reenvío antes de producción.
