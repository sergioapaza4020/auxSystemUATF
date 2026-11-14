# Control de frecuencia — PENDIENTE antes del piloto

Se encontró Redis en compose y BullMQ para importaciones; no existe guard/throttler QR ni evidencia de gateway con límites desplegados. La mera presencia de Redis no demuestra disponibilidad, aislamiento, ACL, TLS o atomicidad del límite. La disponibilidad del Redis local configurado no pudo confirmarse en una comprobación PING/handshake de solo lectura contra loopback; no se crearon colas o claves. No se inició ni cambió un servicio compartido. No se añade un contador en memoria ni se certifica protección multinodo inexistente.

## Contrato de la implementación pendiente

Usar Redis compartido con operación atómica (script Lua/token bucket o proveedor equivalente) o gateway que valide la firma JWT antes de extraer idUser. La clave debe incluir entorno + propósito + identidad autenticada + operación; no token QR, MAC, IP como identidad principal ni headers de identidad enviados por el cliente. No registrar bodies. Limitar antes de la verificación HMAC/transacción académica, después de JWT y permisos. Revalidar permisos/matrícula en dominio como ahora.

Valores iniciales para ENSAYAR, no configuración de producción aprobada:

| Operación | Límite candidato por identidad | Uso esperado |
| --- | --- | --- |
| Emisión | 12/min por auxiliar/sesión; techo 60/min por auxiliar | Normalmente 2/min; margen para foco/reconexión |
| Contexto | 30/min por estudiante | Reescaneo y retorno de login |
| Check-in | 10/min por estudiante | Confirmación, duplicados y errores; no retry automático |
| Lectura propia | 30/min por estudiante | Reconciliación y comprobación manual |

No limitar el token compartido como si cada alumno lo consumiera. No aplicar un límite pequeño por IP que sume a los 50 estudiantes de una Wi-Fi. Defensa anónima de autenticación/WAF debe medirse aparte. Un tope adicional por sesión solo tras pruebas de aula y con capacidad suficiente para toda la clase.

Responder 429 con Retry-After en segundos coherente con el contador y Cache-Control:no-store. CORS ahora expone Retry-After al frontend; el mapper ya respeta segundos/fecha. Indisponibilidad del store: política explícita cerrada para QR (503 seguro), sin desactivar MANUAL/GEO ni utilizar un fallback local que dé falsa cobertura. Claves con TTL acotado; métrica agregada sin tokens. Recuperación compartida tras reinicio y entre dos instancias.

## Validación que falta

1. Dos backends y mismo store: agotar cuota en A y recibir 429 en B.
2. 50 identidades desde una IP siguen funcionando con el mismo QR.
3. Un usuario abusivo no agota las cuotas de los demás ni bloquea el curso.
4. Ventana/TTL/Retry-After, caída y reinicio Redis, fail-closed QR, métricas sin cuerpos.
5. Ejecutar carga con ese control activo, midiendo p95 y errores. Los resultados HTTP locales adjuntos NO incluyen un limiter compartido.

Requiere implementación/configuración revisada y autorización sobre un entorno destinado al piloto. Mientras no se ejecute esta validación, el punto de aceptación permanece BLOQUEADO. No se ha instalado dependencia ni infraestructura nueva para simularla.
