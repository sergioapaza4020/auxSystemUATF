import type { ApiResponse } from '@/interfaces/apiResponse';
import type { ISemester, ISemesterWrite } from '@/interfaces/semesters/semester.interface';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import { instance } from './config/config';

export const getCurrentSemester = async (): Promise<ISemester> => {
  const response = await instance.get<ApiResponse<ISemester>>('/semesters/current');

  return response.data.data;
};

export const getSemesters = async (status?: RecordStatus): Promise<ISemester[]> => {
  const response = await instance.get<ApiResponse<ISemester[]>>('/semesters', { params: { status } });

  return response.data.data;
};

export const createSemester = async (data: ISemesterWrite): Promise<void> => {
  await instance.post('/semesters', data);
};

export const updateSemester = async (id: number, data: ISemesterWrite): Promise<void> => {
  await instance.patch(`/semesters/${id}`, data);
};

export const deactivateSemester = async (id: number): Promise<void> => {
  await instance.delete(`/semesters/${id}`);
};

export const reactivateSemester = async (id: number): Promise<void> => {
  await instance.patch(`/semesters/reactivate/${id}`);
};
