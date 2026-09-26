import type { IUser, IUserCreate, IUserUpdate } from '@/interfaces/users/user.interface';
import type { IRole } from '@/interfaces/roles/role.interface';

export const userFields = ['name', 'lastname', 'username', 'email', 'ci', 'ru'] as const;
export type UserForm = Record<(typeof userFields)[number], string> & { password: string };

export function initialUserForm(user: IUser | null): UserForm {
  return {
    name: user?.name ?? '',
    lastname: user?.lastname ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    ci: user?.ci ?? '',
    ru: user?.ru ?? '',
    password: '',
  };
}

export function userCreatePayload(form: UserForm, roleNames: string[]): IUserCreate {
  return {
    name: form.name.trim(),
    lastname: form.lastname.trim(),
    username: form.username.trim(),
    email: form.email.trim(),
    ci: form.ci.trim(),
    ru: form.ru.trim(),
    password: form.password,
    roleNames,
  };
}

export function userUpdatePayload(form: UserForm, user: IUser): IUserUpdate {
  const payload: IUserUpdate = {};

  for (const field of userFields) {
    if (form[field].trim() !== (user[field] ?? '')) payload[field] = form[field].trim();
  }

  if (form.password) payload.password = form.password;

  return payload;
}

export function availableUserRoles(roles: IRole[], user?: IUser | null): IRole[] {
  const assigned = new Set(user?.roles?.map((role) => role.name.toUpperCase()) ?? []);

  return roles.filter((role) => role.isActive && !assigned.has(role.name.toUpperCase()));
}
