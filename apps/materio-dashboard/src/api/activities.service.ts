import { instance } from './config/config';
import type { IActivity } from '@/interfaces/activities/activity.interface';

export interface IActivityCreate {
  gradeSchemeDetailId: number;
  name: string;
  description?: string;
  date: string;
  order: number;
}

export interface IActivityUpdate {
  name?: string;
  description?: string;
  date?: string;
  order?: number;
}

export const getActivitiesByGradeSchemeDetail = async (idGradeSchemeDetail: number): Promise<IActivity[]> => {
  const response = await instance.get(`/activities/grade-scheme-detail/${idGradeSchemeDetail}`);

  return response.data.data;
};

export const createActivity = async (idCourse: number, data: IActivityCreate): Promise<IActivity> => {
  const response = await instance.post(`/activities/course/${idCourse}`, data);

  return response.data.data;
};

export const updateActivity = async (idActivity: number, data: IActivityUpdate): Promise<IActivity> => {
  const response = await instance.put(`/activities/${idActivity}`, data);

  return response.data.data;
};

export const deleteActivity = async (idActivity: number): Promise<IActivity> => {
  const response = await instance.delete(`/activities/${idActivity}`);

  return response.data.data;
};

export const reactivateActivity = async (idActivity: number): Promise<IActivity> => {
  const response = await instance.patch(`/activities/reactivate/${idActivity}`);

  return response.data.data;
};
