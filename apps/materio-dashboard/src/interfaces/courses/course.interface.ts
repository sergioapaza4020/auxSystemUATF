import type { IGradeScheme } from '../grade-schemes/grade-scheme.interface';

export interface ICourse {
  idCourse: number;
  isActive: boolean;
  name: string;
  code: string;
  group: number;
  gradeScheme?: IGradeScheme;
}
