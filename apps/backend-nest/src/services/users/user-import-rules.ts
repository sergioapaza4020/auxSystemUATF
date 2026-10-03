import { BadRequestException } from '@nestjs/common';

const importableRoles = new Set(['STUDENT', 'ASSISTANT', 'TEACHER', 'DIRECTOR', 'DEAN']);

export function validateUserImportRole(roleName: string): string {
  const normalized = roleName?.trim().toUpperCase();
  if (!normalized) throw new BadRequestException('El rol es obligatorio');
  if (!importableRoles.has(normalized))
    throw new BadRequestException(`El rol ${normalized} no está permitido para importación masiva`);
  return normalized;
}

export function userImportRequiresRu(roleName: string): boolean {
  return roleName === 'STUDENT' || roleName === 'ASSISTANT';
}

export function userImportUsername(roleName: string, ci: string, ru: string): string {
  return userImportRequiresRu(roleName) ? ru : ci;
}
