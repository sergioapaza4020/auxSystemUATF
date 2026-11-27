# MAIL-1 · Correo y verificación de dirección

Para Gmail local, configura `MAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465` y `SMTP_SECURE=true`. Usa la dirección autenticada en `SMTP_USER`, una contraseña de aplicación en `SMTP_PASSWORD` y esa misma dirección en `SMTP_FROM`. Para el puerto 587 se exige STARTTLS. [SMTP de Nodemailer](https://nodemailer.com/smtp)

Para Render Free, selecciona `MAIL_PROVIDER=https` y configura `MAIL_API_KEY` y `MAIL_FROM` con un remitente verificado en Resend. Mantén desactivado el seguimiento de clics para los enlaces de verificación. Render Free bloquea los puertos SMTP 25, 465 y 587. [Render Free](https://render.com/docs/free) · [API de Resend](https://resend.com/docs/api-reference/emails/send-email)

`MAIL_VERIFICATION_ORIGIN` debe ser el origen HTTPS de Next.js, sin ruta ni parámetros. Si se omite, se usa `FRONTEND_URL`. En desarrollo se admite HTTP para loopback. Los enlaces llevan el token en un fragmento que el navegador retira tras leerlo. Si abres el enlace en otro dispositivo, inicia sesión con la misma cuenta en otra pestaña y regresa para confirmar.

## Diagnóstico

- `pnpm --filter aux-system-uatf-backend mail:verify` comprueba TLS y autenticación SMTP sin enviar.
- Define `MAIL_TEST_TO` con una bandeja de prueba que controles y ejecuta `pnpm --filter aux-system-uatf-backend mail:test` para enviar un único mensaje. La aceptación SMTP y la recepción en bandeja se comprueban por separado.
- Si el diagnóstico indica `EAUTH`, revisa la cuenta y su contraseña de aplicación. Para `ETIMEDOUT`, revisa conectividad, modo TLS y restricciones de salida.

## Operación

`PATCH /api/auth/me` guarda nombres y apellidos. `POST /api/users/me/email-change` recibe la dirección nueva y la contraseña actual. `GET /api/users/me/email-change` devuelve la dirección pendiente y su vencimiento. `POST /api/users/email-change/confirm` consume el token mediante una sesión del titular. Estas tres rutas comparan `expectedSession` con la sesión autenticada.

El enlace vence a los 15 minutos. Reenviar invalida el enlace anterior. PostgreSQL aplica un minuto entre solicitudes, cinco por usuario o destino por hora y cien por hora para el servicio. Los intentos reservados cuentan aunque falle el envío. Las solicitudes nuevas retiran por lotes registros de más de 24 horas. Confirma mientras la sesión que autorizó la solicitud siga vigente. La confirmación revoca todas las sesiones y envía un aviso a la dirección anterior. Si falla el aviso, se conserva el correo confirmado y se registra el incidente para seguimiento manual.

Revisa los correos duplicados al comparar `lower(email)` antes de migrar. La migración rechaza duplicados y los conserva para corrección administrativa. Programa la creación del índice según el tamaño de `users`. Ejecuta `pnpm --filter aux-system-uatf-backend migration:run` únicamente con el `DATABASE_URL` de un entorno verificado y autorizado. El rollback elimina las solicitudes pendientes y el índice normalizado. Los cambios de correo ya confirmados se conservan.

Las pruebas de integración crean PostgreSQL aislado con `ATTENDANCE_TEST_PG_BIN` y simulan el correo. Ejecuta `pnpm --filter aux-system-uatf-backend test --runInBand auth-rem2-postgres mail.service` y `pnpm --filter aux-system-uatf-frontend test account-settings`.

## Diseño institucional

Los mensajes de verificación, aviso y diagnóstico comparten el diseño de `src/core/mail/institutional-email.ts`. Nest copia `src/core/mail/assets/logo.png` a `dist/core/mail/assets/logo.png`. La plantilla resuelve el archivo junto a su módulo, redimensiona el PNG en memoria y referencia el adjunto inline como `cid:uatf-system-logo`. Si el recurso no está disponible, el encabezado conserva el nombre institucional.

Para revisar MAIL-2 ejecuta `pnpm --filter aux-system-uatf-backend test --runInBand institutional-email mail.service` y `pnpm --filter aux-system-uatf-backend build`. El diagnóstico local usa la misma plantilla con un botón de muestra que carece de token real.
