import type { IActivity } from '../activities/activity.interface';
import type { IGradeItem } from '../grade-items/grade-item.interface';

export interface IGradeScheme {
  idGradeScheme: number;
  name: string;
  description?: string;
  details: IDetail[];
  isActive: boolean;
}

export interface IDetail {
  idGradeSchemeDetail: number;
  percentage: number;
  order: number;
  gradeItem: IGradeItem;
  activities: IActivity[];
}
