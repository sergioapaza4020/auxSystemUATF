# Protocolo reproducible de piloto — NO EJECUTADO en aula

## Puertas de entrada

Responsable técnico y responsable académico deben aprobar un entorno de ensayo HTTPS separado, restauración verificada, migraciones/permisos/roles auditados, claves QR exclusivas, NTP monitorizado y límite compartido probado. No abrir el piloto hasta completar los bloqueos de REPORT.md. No usar datos reales para depuración ni credenciales/tokens como evidencia.

## Secuencia del aula

1. Crear cuentas/matrículas de prueba autorizadas y una materia/semestre controlados. Identificarlas por alias de ensayo, sin capturar nombres, CI, contraseñas ni JWT.
2. Auxiliar inicia sesión y crea QR DRAFT. Comprueba America/La_Paz, inicio/fin, semestre y ownership. Guardar y activar; verificar SCHEDULED/OPEN desde backend.
3. Proyectar QR completo. Probar cámara nativa desde primera fila, centro y última fila; anotar distancia aproximada, tamaño de proyección y luz, sin fotografiar tokens vigentes reales para el informe.
4. Un estudiante ya autenticado y otro sin sesión abren el enlace. Verificar limpieza de fragmento, login fijo y caducidad durante login lento. No hay registro hasta pulsar Confirmar.
5. Verificar PRESENT/QR, hora/actor del servidor, lectura propia y planilla. Repetir clic, pestaña y dispositivo: una sola marca.
6. Repetir con 5, 15, 30 y, si está autorizado, 50 estudiantes. Medir desde el entorno de piloto: éxito, p50/p95, errores y duración; no extrapolar el JSON de loopback.
7. Desconectar auxiliar; esconder QR al expirar. Probar estudiante con latencia/timeout, pérdida de respuesta y reconexión. No debe reenviar automáticamente ni interpretar fallo de red como ausencia académica.
8. Cerrar la sesión. Comprobar computabilidad y ausencia implícita, EXCUSED manual autorizado, igualdad de sesiones de numerador/denominador y evidencia QR/GEO protegida.
9. Prueba controlada de reenvío: alumno elegible fuera del aula recibe código vigente. Puede ser aceptado; registrar como limitación de QR independiente, no fallo criptográfico. Acordar política docente o futuro QR+GEO sin implementarlo aquí.
10. Completar mobile-classroom-matrix.csv con fecha/dispositivo/navegador/observado/evidencia y APROBADO/FALLIDO/NO PROBADO. No marcar APROBADO por mocks o por un comando de tests.

## Criterios de detener el piloto

Duplicado, sobrescritura de evidencia, identidad/matrícula ajena, cálculo inconsistente o secreto en logs: detener autorregistro QR, conservar evidencia, escalar incidente. No convertir QR a MANUAL ni borrar marcas. Corrección hacia adelante preferible al rollback de enums con datos QR.

## Reproducción local autorizada

Desde raíz, PowerShell, PostgreSQL 16 instalado:

```powershell
$env:ATTENDANCE_TEST_PG_BIN = 'C:/Program Files/PostgreSQL/16/bin'
$env:SEED_TEST_PG_BIN = $env:ATTENDANCE_TEST_PG_BIN
$env:MIGRATION_TEST_PG_BIN = $env:ATTENDANCE_TEST_PG_BIN
pnpm --filter aux-system-uatf-backend test --runInBand
pnpm --filter aux-system-uatf-frontend test
```

Los helpers crean clústeres propios, verifican data_directory/puerto y nunca usan DATABASE_URL para elegir su destino. No sustituirlos por la base de aplicación. Tests optativos activities/grade-matrix conservan sus flags; no activarlos contra una base desconocida.

Para repetir solo login real, sesión persistida, API QR, carga y respuesta perdida:

```powershell
$env:ATTENDANCE_TEST_PG_BIN = 'C:/Program Files/PostgreSQL/16/bin'
# Opcional: escribir NUEVAS mediciones reales sobre el artefacto de carga local.
$env:QR6_WRITE_EVIDENCE = '1'
pnpm --filter aux-system-uatf-backend test --runInBand attendance-qr-pilot-postgres
```

La suite usa AuthService, UsersService, SessionsService, JWT/guards, controller/service y PostgreSQL reales; solo las dependencias administrativas de roles/importación no usadas por login están sustituidas. No renderiza las pantallas del frontend: E2E navegador+backend completo sigue NO PROBADO.

Simulación visual sin BD:

```powershell
pnpm --filter aux-system-uatf-frontend exec vite --config test/attendance-qr-browser/vite.config.mts
```

Abrir http://127.0.0.1:4318/. El banner identifica APIs/auth simuladas y datos ficticios. Probar Estudiante, Respuesta perdida, Código vencido, Auxiliar, activar, Mostrar QR, fullscreen/Escape, temas y contenedor 360px. No es un teléfono ni valida HMAC. Cerrar el servidor al terminar. No subir capturas de códigos vigentes ni cuentas reales.
