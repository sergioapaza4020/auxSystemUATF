import type { IBase } from '../base.interface';
import type { IGradeScheme } from '../grade-schemes/grade-scheme.interface';

export interface ICourse extends IBase {
  name: string;
  code: string;
  group: number;
  gradeScheme?: IGradeScheme;
}
