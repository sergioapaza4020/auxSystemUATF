import type { IActivity } from '@/interfaces/activities/activity.interface';
import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';

export interface IAssistantGradeSchemeDetail {
  idGradeSchemeDetail: number;
  isActive?: boolean;
  archivedAt?: string | null;
  hasAcademicData?: boolean;
  activityCount?: number;
  gradeCount?: number;
  attendanceSessionCount?: number;
  percentage: number;
  permissionWeight?: number;
  order: number;
  gradeItem: IGradeItem;
  activities: IActivity[];
}

export interface IAssistantGradeScheme {
  idGradeScheme: number;
  name: string;
  description?: string;
  assistantPercentage: number;
  isActive: boolean;
  details: IAssistantGradeSchemeDetail[];
  archivedDetails?: IAssistantGradeSchemeDetail[];
}

export interface IAssistantGradeSchemeDetailCreate {
  idGradeSchemeDetail?: number;
  hasAcademicData?: boolean;
  percentage: number;
  permissionWeight?: number;
  order: number;
  gradeItem: {
    idGradeItem: number;
  };
}

export interface IAssistantGradeSchemeCreate {
  deactivateDetailIds?: number[];
  assistantPercentage: number;
  name?: string;
  description?: string;
  details: IAssistantGradeSchemeDetailCreate[];
}

export type IAssistantGradeSchemeUpdate = IAssistantGradeSchemeCreate;
