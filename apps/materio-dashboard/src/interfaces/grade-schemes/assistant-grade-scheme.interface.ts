import type { IActivity } from '@/interfaces/activities/activity.interface';
import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';

export interface IAssistantGradeSchemeDetail {
  idGradeSchemeDetail: number;
  percentage: number;
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
}

export interface IAssistantGradeSchemeDetailCreate {
  percentage: number;
  order: number;
  gradeItem: {
    idGradeItem: number;
  };
}

export interface IAssistantGradeSchemeCreate {
  assistantPercentage: number;
  name?: string;
  description?: string;
  details: IAssistantGradeSchemeDetailCreate[];
}

export type IAssistantGradeSchemeUpdate = IAssistantGradeSchemeCreate;
