import type { IGradeScheme } from '../grade-schemes/grade-scheme.interface';

export interface ICourse {
  idCourse: number;
  isActive: boolean;
  name: string;
  code: string;
  group: number;
  gradeScheme?: IGradeScheme;
  career?: { idCareer: number; name: string }[];
}

export type ICourseWrite = Pick<ICourse, 'name' | 'code' | 'group'>;
