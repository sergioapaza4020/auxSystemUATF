import type { IGrade } from '@/interfaces/grades/grade.interface';
import { instance } from './config/config';

export const getGradesByEnrollment = async (idEnrollment: number): Promise<IGrade[]> => {
  const response = await instance.get(`/grades/enrollment/${idEnrollment}`);

  return response.data.data;
};

export const createGrade = async (data: {
  enrollmentId: number;
  gradeSchemeDetailId: number;
  score: number;
}): Promise<IGrade> => {
  const response = await instance.post('/grades', data);

  return response.data.data;
};

export const updateGrade = async (idGrade: number, score: number): Promise<IGrade> => {
  const response = await instance.patch(`/grades/${idGrade}`, { score });

  return response.data.data;
};
