import type { IPermission } from '@/interfaces/permissions/permission.interface';
import { permissionPrefix } from '../../permissions/permission-rules';

const modules: Record<string, string> = {
  user: 'Usuarios',
  role: 'Roles',
  permission: 'Permisos',
  course: 'Materias',
  enrollment: 'Matrículas',
  grade: 'Calificaciones',
  attendance: 'Asistencia',
  activity: 'Actividades',
  faculty: 'Facultades',
  career: 'Carreras',
  semester: 'Semestres',
  sessions: 'Sesiones',
  'grade-item': 'Criterios de calificación',
  'grade-scheme': 'Esquemas de calificación',
  'assistant-grade-scheme': 'Configuración del auxiliar',
};

const actions: Record<string, string> = {
  create: 'Crear',
  update: 'Actualizar',
  delete: 'Eliminar',
  remove: 'Eliminar',
  reactivate: 'Reactivar',
  'get-all': 'Listar',
  'get-one': 'Consultar',
  save: 'Guardar',
};

export const permissionGroupLabel = (key: string) =>
  Object.hasOwn(modules, key) ? modules[key] : key === '(sin prefijo)' ? 'Otros' : key.replace(/-/g, ' ');

export const permissionLabel = (permission: IPermission) => {
  if (permission.description?.trim()) return permission.description.trim();
  const parts = permission.name.split('.');
  const action = parts.at(-1) ?? '';

  return Object.hasOwn(actions, action)
    ? `${actions[action]} · ${permissionGroupLabel(permissionPrefix(permission.name))}`
    : permission.name.replace(/[.-]/g, ' ');
};

export const normalizePermissionSearch = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();

export function groupPermissions(permissions: IPermission[]) {
  const groups = new Map<string, IPermission[]>();

  for (const permission of permissions) {
    const key = permissionPrefix(permission.name);

    groups.set(key, [...(groups.get(key) ?? []), permission]);
  }

  return [...groups]
    .map(([key, items]) => ({
      key,
      label: permissionGroupLabel(key),
      permissions: [...items].sort(
        (a, b) => permissionLabel(a).localeCompare(permissionLabel(b), 'es') || a.name.localeCompare(b.name),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es') || a.key.localeCompare(b.key));
}
