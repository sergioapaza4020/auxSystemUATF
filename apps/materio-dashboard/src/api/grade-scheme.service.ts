import { instance } from './config/config';
import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

export const getGradeSchemes = async (): Promise<any> => {
  const gradeSchemes = await instance.get('/grade-schemes');

  return gradeSchemes.data.data;
};

export const createGradeScheme = async (gradeScheme: IGradeSchemeCreateOrEdit): Promise<any> => {
  const newGradeScheme = await instance.post('/grade-schemes', gradeScheme);

  return newGradeScheme.data.data;
};

export const getGradeSchemeById = async (idGradeScheme: number): Promise<any> => {
  const gradeScheme = await instance.get(`/grade-schemes/id/${idGradeScheme}`);

  return gradeScheme.data.data;
};

export const updateGradeScheme = async (
  idGradeScheme: number,
  updateGradeScheme: IGradeSchemeCreateOrEdit,
): Promise<void> => {
  await instance.put(`/grade-schemes/update/${idGradeScheme}`, updateGradeScheme);
};

export const deleteGradeScheme = async (idGradeScheme: number): Promise<void> => {
  await instance.delete(`/grade-schemes/${idGradeScheme}`);
};

export const reactivateGradeScheme = async (idGradeScheme: number): Promise<void> => {
  await instance.patch(`/grade-schemes/reactivate/${idGradeScheme}`);
};
