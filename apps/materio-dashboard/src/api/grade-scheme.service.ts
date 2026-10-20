import type { CatalogPageQuery } from '@/interfaces/catalog-page.interface';
import type { PaginatedApiResponse, ApiResponse } from '@/interfaces/apiResponse';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import { instance } from './config/config';
import type { IGradeSchemeCreateOrEdit } from '@/interfaces/grade-schemes/grade-scheme-edit.interface';

export const getGradeSchemes = async (): Promise<IGradeScheme[]> => {
  const gradeSchemes = await instance.get<ApiResponse<IGradeScheme[]>>('/grade-schemes');

  return gradeSchemes.data.data;
};

export const createGradeScheme = async (gradeScheme: IGradeSchemeCreateOrEdit): Promise<IGradeScheme> => {
  const newGradeScheme = await instance.post<ApiResponse<IGradeScheme>>('/grade-schemes', gradeScheme);

  return newGradeScheme.data.data;
};

export const getGradeSchemeById = async (idGradeScheme: number): Promise<IGradeScheme> => {
  const gradeScheme = await instance.get<ApiResponse<IGradeScheme>>(`/grade-schemes/id/${idGradeScheme}`);

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

export const getGradeSchemesPage = async (query: CatalogPageQuery, signal?: AbortSignal) =>
  (await instance.get<PaginatedApiResponse<IGradeScheme[]>>('/grade-schemes', { params: query, signal })).data;
