export const importRoles = [
  { value: 'STUDENT', label: 'Estudiante' },
  { value: 'ASSISTANT', label: 'Auxiliar' },
  { value: 'TEACHER', label: 'Docente' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'DEAN', label: 'Decano' },
] as const;

export type ImportRole = (typeof importRoles)[number]['value'];

export const requiresRu = (role: ImportRole) => role === 'STUDENT' || role === 'ASSISTANT';

export { validateImportFile } from '../../../../utils/importFile';
