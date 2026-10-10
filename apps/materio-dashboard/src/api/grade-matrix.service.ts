import { instance } from './config/config';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { IGradeMatrix, IBulkActivityGrade, IMatrixGrade } from '@/interfaces/grades/grade-matrix.interface';

export async function getGradeMatrix(
  idEnrollment: number,
  detailId?: number,
  signal?: AbortSignal,
): Promise<IGradeMatrix> {
  const response = await instance.get<ApiResponse<IGradeMatrix>>(`/grades/matrix/${idEnrollment}`, {
    params: { detailId },
    signal,
  });

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo cargar la planilla.');

  return response.data.data;
}

export async function saveActivityGrades(idEnrollment: number, grades: IBulkActivityGrade[]): Promise<IMatrixGrade[]> {
  const response = await instance.patch<ApiResponse<{ grades: IMatrixGrade[] }>>(`/grades/bulk/${idEnrollment}`, {
    grades,
  });

  if (!response.data.status) throw new Error(response.data.message || 'No se pudieron guardar las calificaciones.');

  return response.data.data.grades;
}
