import type { UserRole } from '@/enums/userRole';

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    STUDENT: 'Estudiante',
    ASSISTANT: 'Auxiliar',
    TEACHER: 'Docente',
    DIRECTOR: 'Director',
    DEAN: 'Decano',
  };

  return labels[role];
}
