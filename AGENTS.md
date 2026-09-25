# Proyecto

Monorepo PNPM/Turborepo. Usar PNPM; no cambiar versiones ni agregar dependencias
sin necesidad justificada.

- Frontend: `apps/materio-dashboard` (Next.js, React, TypeScript, MUI).
- Backend: `apps/backend-nest` (NestJS, TypeORM, PostgreSQL).
- API con prefijo `/api`; Swagger: `http://localhost:3001/api`.

Igualmente, se tienen controles de calidad con Husky, para el build, lint, format y test.

## Forma de trabajo

- Inspeccionar primero los archivos del dominio afectado y reutilizar patrones existentes.
- Preservar cambios no relacionados del árbol de trabajo.
- Mantener cambios pequeños y no reestructurar arquitectura sin necesidad.
- No usar `any` para ocultar errores de TypeScript.
- Indicar archivos modificados, qué validar en frontend/backend y comprobaciones ejecutadas.

## Frontend

- Rutas: `src/app`; pantallas: `src/views`; llamadas HTTP: `src/api`;
  contratos: `src/interfaces`; lógica reutilizable: `src/hooks`.
- Reutilizar la instancia Axios existente; no crear clientes HTTP paralelos.
- Para CRUD administrativos, revisar primero el patrón de Grade Schemes.
- En tablas, usar `useDataTable` y declarar como ordenables solo columnas escalares
  con `sortable: true`.

## Backend

- Mantener el flujo DTO → controller → service → entity → module.
- Proteger endpoints nuevos con el decorador de permisos cuando corresponda.
- Registrar módulos nuevos en `AppModule`.
- Para cambios de esquema, crear migración; no depender de sincronización automática.
- Ejecutar seed o migraciones solo cuando la tarea lo autorice expresamente.

## Verificación

Preferir comandos por aplicación:

- Frontend: `pnpm --filter aux-system-uatf-frontend build|lint|test`
- Backend: `pnpm --filter aux-system-uatf-backend build|lint|test`

No usar `pnpm check-types` raíz como verificación principal de las aplicaciones.