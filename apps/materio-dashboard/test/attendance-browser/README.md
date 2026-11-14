# Vista visual aislada de Attendance

Desde la raíz del monorepo:

```powershell
pnpm --filter aux-system-uatf-frontend exec vite --config test/attendance-browser/vite.config.mts
```

Abrir `http://127.0.0.1:4317/`. Usa el Vite ya disponible mediante Vitest; no requiere instalar dependencias. Solo escucha en loopback. Detener con Ctrl+C.

La vista importa los componentes reales y el hook real. Los aliases de esta configuración sustituyen el servicio y Snackbar únicamente aquí; el GPS se reemplaza por posiciones ficticias únicamente en `main.tsx` de esta fixture. No importa esta fixture desde la aplicación ni la despliegues como un entorno académico.

No hay credenciales, peticiones a la API de aplicación ni acceso a PostgreSQL. Las teselas del mapa sí se descargan de OSM, con la atribución del componente real; el centro usado es ficticio. No usar datos personales en la fixture.

El selector permite comprobar estados y errores simulados. El toggle oscuro aplica solo al ThemeProvider de pruebas, no al global del producto. El contexto de autenticación y la renovación real de JWT no se ejecutan aquí.

Esto valida presentación/interacciones de componentes, no un E2E de Next/Nest/JWT/DB ni precisión de GPS físico. Ver `docs/attendance-phase7/REPORT.md` para evidencia, límites y matrices pendientes.
