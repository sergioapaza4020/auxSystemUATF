import { instance } from './config/config';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { IGradeItem, IGradeItemWrite } from '@/interfaces/grade-items/grade-item.interface';
import type { RecordStatus } from '@/interfaces/status-query.interface';

export const getGradeItems = async (status?: RecordStatus): Promise<IGradeItem[]> => {
  const gradeItems = await instance.get<ApiResponse<IGradeItem[]>>('/grade-items', { params: { status } });

  return gradeItems.data.data;
};

export const createGradeItem = async (data: IGradeItemWrite): Promise<void> => {
  await instance.post('/grade-items', data);
};

export const updateGradeItem = async (id: number, data: IGradeItemWrite): Promise<void> => {
  await instance.patch(`/grade-items/${id}`, data);
};

export const deactivateGradeItem = async (id: number): Promise<void> => {
  await instance.delete(`/grade-items/${id}`);
};

export const reactivateGradeItem = async (id: number): Promise<void> => {
  await instance.patch(`/grade-items/reactivate/${id}`);
};
