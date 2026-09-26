import { instance } from './config/config';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import type { IFaculty, IFacultyWrite } from '@/interfaces/faculties/faculty.interface';

export const getFaculties = async (status: RecordStatus = 'active') =>
  (await instance.get<ApiResponse<IFaculty[]>>('/faculties', { params: { status } })).data.data;

export const createFaculty = async (data: IFacultyWrite) => {
  await instance.post('/faculties', data);
};

export const updateFaculty = async (id: number, data: Partial<IFacultyWrite>) => {
  await instance.put(`/faculties/update/${id}`, data);
};

export const deactivateFaculty = async (id: number) => {
  await instance.delete(`/faculties/${id}`);
};

export const reactivateFaculty = async (id: number) => {
  await instance.patch(`/faculties/reactivate/${id}`);
};
