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
  isActive?: boolean;
  idGradeSchemeDetail: number;
  percentage: number;
  permissionWeight?: number;
  order: number;
  gradeItem: IGradeItem;
  activities: IActivity[];
}
