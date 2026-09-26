import type { ApiResponse, PaginatedApiResponse } from '@/interfaces/apiResponse';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { instance } from './config/config';
import type { IEnrollmentCreate } from '@/interfaces/enrollments/enrollment-create.interface';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

export const getEnrollments = async (status?: RecordStatus): Promise<IEnrollment[]> => {
  const enrollments = await instance.get<ApiResponse<IEnrollment[]>>('/enrollments', { params: { status } });

  return enrollments.data.data;
};

export interface EnrollmentPageQuery {
  page: number;
  limit: number;
  status?: RecordStatus;
  search?: string;
  role?: string;
}
export const getEnrollmentsPage = async (query: EnrollmentPageQuery) =>
  (await instance.get<PaginatedApiResponse<IEnrollment[]>>('/enrollments', { params: query })).data;

export const deactivateEnrollment = async (id: number) => {
  await instance.delete(`/enrollments/${id}`);
};

export const reactivateEnrollment = async (id: number) => {
  await instance.patch(`/enrollments/reactivate/${id}`);
};

export const getMyEnrollments = async (): Promise<IEnrollment[]> => {
  const myEnrollments = await instance.get('/enrollments/my-enrollments');

  return myEnrollments.data.data;
};

export const getMyEnrollment = async (idEnrollment: number): Promise<IEnrollment> => {
  const response = await instance.get(`/enrollments/my-enrollments/${idEnrollment}`);

  return response.data.data;
};

export const getManagedEnrollment = async (idEnrollment: number): Promise<IEnrollment> => {
  const response = await instance.get(`/enrollments/managed/${idEnrollment}`);

  return response.data.data;
};

export const createEnrollment = async (data: Omit<IEnrollmentCreate, 'id' | 'isActive'>) => {
  const response = await instance.post('/enrollments', data);

  return response.data.data;
};

export const getEnrollmentStudents = async (idEnrollment: number): Promise<IEnrollmentStudent[]> => {
  const response = await instance.get(`/enrollments/${idEnrollment}/students`);

  return response.data.data;
};
