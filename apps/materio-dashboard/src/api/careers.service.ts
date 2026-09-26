import { instance } from './config/config';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { ICareer, ICareerCreate, ICareerUpdate, IFacultyOption } from '@/interfaces/careers/career.interface';
import type { RecordStatus } from '@/interfaces/status-query.interface';

export const getCareers = async (status?: RecordStatus): Promise<ICareer[]> =>
  (await instance.get<ApiResponse<ICareer[]>>('/careers', { params: { status } })).data.data;
export const getCareerFaculties = async (): Promise<IFacultyOption[]> =>
  (await instance.get<ApiResponse<IFacultyOption[]>>('/faculties')).data.data;

export const createCareer = async (data: ICareerCreate): Promise<void> => {
  await instance.post('/careers', data);
};

export const updateCareer = async (id: number, data: ICareerUpdate): Promise<void> => {
  await instance.patch(`/careers/${id}`, data);
};

export const deactivateCareer = async (id: number): Promise<void> => {
  await instance.delete(`/careers/${id}`);
};

export const reactivateCareer = async (id: number): Promise<void> => {
  await instance.patch(`/careers/reactivate/${id}`);
};
