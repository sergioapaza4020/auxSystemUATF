import { instance } from './config/config';

import type {
  IAssistantGradeScheme,
  IAssistantGradeSchemeCreate,
  IAssistantGradeSchemeUpdate,
} from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

export const getMyAssistantGradeScheme = async (idCourse: number): Promise<IAssistantGradeScheme | null> => {
  const response = await instance.get(`/assistant-grade-schemes/course/${idCourse}`);

  return response.data.data;
};

export const createAssistantGradeScheme = async (
  idCourse: number,
  data: IAssistantGradeSchemeCreate,
): Promise<IAssistantGradeScheme> => {
  const response = await instance.post(`/assistant-grade-schemes/course/${idCourse}`, data);

  return response.data.data;
};

export const updateAssistantGradeScheme = async (
  idAssistantGradeScheme: number,
  data: IAssistantGradeSchemeUpdate,
): Promise<IAssistantGradeScheme> => {
  const response = await instance.put(`/assistant-grade-schemes/${idAssistantGradeScheme}`, data);

  return response.data.data;
};
