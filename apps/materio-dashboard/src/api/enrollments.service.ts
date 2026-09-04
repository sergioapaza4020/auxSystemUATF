import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { instance } from './config/config';
import type { IEnrollmentCreate } from '@/interfaces/enrollments/enrollment-create.interface';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

export const getEnrollments = async (): Promise<IEnrollment[]> => {
  const enrollments = await instance.get('/enrollments');

  return enrollments.data.data;
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
