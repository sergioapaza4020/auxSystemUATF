# Recuperación de contraseña de SIGAD UATF

## Configuración

- Nest requiere `PASSWORD_RECOVERY_HMAC_KEY`, una clave privada de 32 bytes aleatorios codificada en 64 caracteres hexadecimales. Debe ser igual en todas las instancias de Nest y distinta de las claves JWT y del transporte. Rotarla invalida los códigos pendientes y reinicia los buckets seudonimizados.
- Next y Nest reutilizan `AUTH_TRANSPORT_KEY`, `AUTH_PUBLIC_ORIGIN` y `AUTH_API_ORIGIN` según su configuración actual. En producción se requieren orígenes HTTPS.
- Para limitar por IP de visitante, el proxy de ingreso debe eliminar cualquier valor entrante de la cabecera elegida y sobrescribirla con una única IP validada. Configurar su nombre en `PASSWORD_RECOVERY_CLIENT_IP_HEADER` en Next y activar `PASSWORD_RECOVERY_TRUST_CLIENT_IP=true` en Nest. Sin esa configuración, Nest agrupa por la IP de conexión y los visitantes de un mismo proxy comparten su cuota.
- Para desarrollo local se puede usar `MAIL_PROVIDER=smtp` con la configuración Gmail existente. Para Render Free se puede usar el adaptador existente `MAIL_PROVIDER=https` con credenciales válidas. La plantilla institucional reutiliza el logo CID.
- La migración aditiva y reversible `PasswordRecovery1795795200000` crea las tablas de solicitudes y límites. Aplicarla en el entorno autorizado antes de habilitar la función.
- Las direcciones elegibles corresponden a cuentas activas cuyo correo coincide con la última confirmación registrada en `email_change_requests`. El esquema actual carece de confirmación general de correos históricos. Esas cuentas requieren un proceso autorizado de confirmación antes de poder recuperar acceso.

## Rutas y comportamiento

| Pantalla | Transporte Next | Nest |
| --- | --- | --- |
| `/forgot-password` | POST `/api/auth/password-recovery/request` | POST `/api/auth/password-recovery/request` |
| `/forgot-password/verify` | POST `/api/auth/password-recovery/verify` | POST `/api/auth/password-recovery/verify` |
| Reenviar código | POST `/api/auth/password-recovery/resend` | Reutiliza `request` |
| `/forgot-password/reset` | POST `/forgot-password/reset/submit` | POST `/api/auth/password-recovery/reset` |

Next valida origen, host, CSRF y JSON de hasta 2 KiB. Nest autentica el servidor Next mediante el guard de transporte. La respuesta 202 es genérica y usa un identificador opaco incluso para direcciones no elegibles. La búsqueda de cuenta y el envío se procesan después de confirmar la solicitud. La aceptación de SMTP significa que el proveedor aceptó el mensaje. Una configuración de correo incompleta devuelve indisponibilidad de forma uniforme. Los fallos de entrega posteriores se registran sin datos personales, invalidan la solicitud y permiten reintentar dentro de los límites.

El código se genera con `randomInt`, admite ceros iniciales, dura diez minutos y se guarda como HMAC-SHA-256 ligado al identificador. Un bloqueo de fila serializa las verificaciones y limita a cinco errores. El reenvío exige 60 segundos y permite hasta tres solicitudes por hora por cuenta y dirección, además de 15 por hora por IP y 120 globales. Verificar y restablecer admiten respectivamente 60 y 30 operaciones por hora por IP. Los límites se comparten en PostgreSQL.

La transición es pendiente → enviada → verificada → consumida. El reenvío invalida la solicitud anterior y el quinto fallo bloquea el código. El vencimiento se evalúa en el servidor en cada uso. Al verificar, Nest crea un comprobante opaco de 256 bits y persiste su digest. Next lo guarda en una cookie firmada, HttpOnly, SameSite Strict, Secure en HTTPS y limitada a la ruta de restablecimiento. Su vigencia está acotada por el vencimiento original del código.

El restablecimiento bloquea primero la cuenta y luego la solicitud. Actualiza bcrypt con la política SEC-1, consume la autorización, invalida otras solicitudes y revoca las sesiones, incluidas las recordadas, en una sola transacción. La validación de acceso y refresh de REM-3 consulta las sesiones revocadas. La notificación posterior es independiente de la transacción.

## Operación y pruebas

- El endpoint autenticado `POST /api/users/:idUser/password-reset` usa `user.reset-password` mediante el acceso implícito de `SUPERADMIN`. El servicio exige ese rol activo y restringe el objetivo a otra cuenta activa, sin roles o con roles STUDENT/ASSISTANT, con correo confirmado. La auditoría del servidor registra actor, objetivo y resultado. El correo contiene un enlace con referencia opaca y el código. El enlace solo selecciona la solicitud y requiere el código para verificarla.

- Si la primera solicitud devuelve 503 con la configuración SMTP válida, comprobar la presencia y el formato de `PASSWORD_RECOVERY_HMAC_KEY` en el entorno efectivo de Nest. La aplicación requiere una clave exclusiva y falla antes de acceder a PostgreSQL si falta. Después de provisionarla, reiniciar el proceso de Nest para cargarla. El navegador recibe un mensaje genérico.

- El envío se ejecuta en segundo plano dentro del proceso. Un reinicio puede interrumpirlo. El usuario puede volver a pedir un código después del cooldown. Los avisos posteriores se intentan una vez.
- Definir con operación una retención para los registros vencidos. Los índices de vencimiento permiten purgar por lotes. Conservar al menos la última hora de solicitudes para los límites por cuenta.
- La prueba `auth-rem2-postgres.spec.ts` reutiliza el clúster efímero del repositorio con datos sintéticos y un transporte de correo en memoria. Para habilitarla, apuntar `ATTENDANCE_TEST_PG_BIN` al directorio de binarios PostgreSQL local y ejecutar `pnpm --filter aux-system-uatf-backend test --runInBand src/services/auth/auth-rem2-postgres.spec.ts`.
- La prueba `password-recovery.test.ts` comprueba el transporte de Next con un backend simulado. Ejecutar `pnpm --filter aux-system-uatf-frontend test src/server/password-recovery.test.ts src/middleware.test.ts`.
- El envío real de diagnóstico conserva los comandos `mail:verify` y `mail:test` del backend. Ejecutar un envío real solo con autorización explícita y un destinatario de prueba configurado.

## Archivos de la implementación

| Aplicación | Archivos nuevos | Archivos existentes actualizados |
| --- | --- | --- |
| Nest | `src/controllers/auth/password-recovery.controller.ts`, `src/dtos/auth/password-recovery.dto.ts`, `src/services/auth/password-recovery.service.ts`, `src/entities/password-recovery-requests/password-recovery-request.entity.ts`, `src/database/migrations/1795795200000-PasswordRecovery.ts`, `AUTH-REC-1.md` | `src/modules/auth/auth.module.ts`, `src/core/mail/institutional-email.ts`, `src/services/auth/auth-rem2-postgres.spec.ts`, `.env.example` |
| Next | `src/api/password-recovery.service.ts`, `src/server/password-recovery.ts`, `src/server/password-recovery.test.ts`, `src/components/auth/PasswordRequirements.tsx`, los tres handlers de `src/app/api/auth/password-recovery/` y las rutas `verify/page.tsx`, `reset/page.tsx` y `reset/submit/route.ts` bajo `src/app/(blank-layout-pages)/forgot-password/` | `src/views/ForgotPassword.tsx`, `src/views/account-settings/PasswordSettings.tsx`, `src/api/config/config.ts`, `src/server/auth-handler.ts`, `src/configs/publicRoutes.ts`, `src/middleware.test.ts`, `.env.example` |
