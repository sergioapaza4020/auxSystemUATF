import type { IGradeItem } from '../grade-items/grade-item.interface';

export interface IGradeSchemeCreateOrEdit {
  name: string;
  description?: string;
  details: IGradeSchemeDetailCreateOrEdit[];
}

export interface IGradeSchemeDetailCreateOrEdit {
  percentage: number;
  order: number;
  gradeItem: IGradeItem;
}
