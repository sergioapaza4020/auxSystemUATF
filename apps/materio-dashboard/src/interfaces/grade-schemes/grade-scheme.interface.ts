import type { IGradeItem } from '../grade-items/grade-item.interface';

export interface IGradeScheme {
  idGradeScheme: number;
  name: string;
  description: string;
  details: IDetail[];
  isActive: boolean;
}

export interface IDetail {
  percentage: number;
  gradeItem: IGradeItem;
}
