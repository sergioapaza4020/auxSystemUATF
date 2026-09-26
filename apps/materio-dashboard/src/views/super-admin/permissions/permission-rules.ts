import type { IPermission } from '@/interfaces/permissions/permission.interface';

export const permissionPrefix = (name: string) => (name.includes('.') ? name.split('.')[0] : '(sin prefijo)');

export function permissionKeyError(name: string, records: IPermission[]): string {
  if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(name.trim()))
    return 'Usa una clave como user.get-all, en minúsculas y sin espacios.';
  if (records.some((permission) => permission.name === name.trim()))
    return 'Esta clave ya existe. Si está inactiva, puedes reactivarla.';

  return '';
}
