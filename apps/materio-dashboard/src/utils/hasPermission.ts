import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';

export function hasPermission(
  user: Pick<ICurrentUser, 'roles' | 'permissions'> | null | undefined,
  permission: string,
): boolean {
  return !!user && (user.roles.includes('SUPERADMIN') || user.permissions.includes(permission));
}
