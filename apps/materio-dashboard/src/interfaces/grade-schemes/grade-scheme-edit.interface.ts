import type { IGradeScheme } from './grade-scheme.interface';

export interface IGradeSchemeCreateOrEdit extends Omit<IGradeScheme, 'idGradeScheme' | 'isActive'> {}
