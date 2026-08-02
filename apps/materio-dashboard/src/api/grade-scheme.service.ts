import { instance } from './config/config';
import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

export const getGradeSchemes = async (): Promise<any> => {
  try {
    const gradeSchemes = await instance.get('/grade-schemes');

    return gradeSchemes.data.data;
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};

export const createGradeScheme = async (gradeScheme: IGradeSchemeCreateOrEdit): Promise<any> => {
  try {
    const newGradeScheme = await instance.post('/grade-schemes', gradeScheme);

    return newGradeScheme.data.data;
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};

export const getGradeSchemeById = async (idGradeScheme: number): Promise<any> => {
  try {
    const gradeScheme = await instance.get(`/grade-schemes/id/${idGradeScheme}`);

    return gradeScheme.data.data;
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};

export const updateGradeScheme = async (
  idGradeScheme: number,
  updateGradeScheme: IGradeSchemeCreateOrEdit,
): Promise<void> => {
  try {
    await instance.put(`/grade-schemes/update/${idGradeScheme}`, updateGradeScheme);
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};

export const deleteGradeScheme = async (idGradeScheme: number): Promise<void> => {
  try {
    await instance.delete(`/grade-schemes/${idGradeScheme}`);
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};

export const reactivateGradeScheme = async (idGradeScheme: number): Promise<void> => {
  try {
    await instance.patch(`/grade-schemes/reactivate/${idGradeScheme}`);
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};
