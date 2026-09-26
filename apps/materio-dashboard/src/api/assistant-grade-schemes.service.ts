import { instance } from './config/config';

import type {
  IAssistantGradeScheme,
  IAssistantGradeSchemeCreate,
  IAssistantGradeSchemeUpdate,
} from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

export const getMyAssistantGradeScheme = async (
  idCourse: number,
  idEnrollment?: number,
): Promise<IAssistantGradeScheme | null> => {
  const response = await instance.get(`/assistant-grade-schemes/course/${idCourse}`, {
    params: idEnrollment ? { enrollmentId: idEnrollment } : undefined,
  });

  return response.data.data;
};

export const createAssistantGradeScheme = async (
  idCourse: number,
  data: IAssistantGradeSchemeCreate,
  idEnrollment?: number,
): Promise<IAssistantGradeScheme> => {
  const response = await instance.post(`/assistant-grade-schemes/course/${idCourse}`, data, {
    params: idEnrollment ? { enrollmentId: idEnrollment } : undefined,
  });

  return response.data.data;
};

export const updateAssistantGradeScheme = async (
  idAssistantGradeScheme: number,
  data: IAssistantGradeSchemeUpdate,
): Promise<IAssistantGradeScheme> => {
  const response = await instance.put(`/assistant-grade-schemes/${idAssistantGradeScheme}`, data);

  return response.data.data;
};

export const deleteAssistantGradeScheme = async (id: number): Promise<void> => {
  await instance.delete(`/assistant-grade-schemes/${id}`);
};

export const reactivateAssistantGradeScheme = async (id: number): Promise<void> => {
  await instance.patch(`/assistant-grade-schemes/reactivate/${id}`);
};
