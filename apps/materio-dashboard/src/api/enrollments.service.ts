import type { ApiResponse, PaginatedApiResponse } from '@/interfaces/apiResponse';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { instance } from './config/config';
import type { IEnrollmentCreate } from '@/interfaces/enrollments/enrollment-create.interface';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type {
  IEnrollmentImportTarget,
  IEnrollmentImportPreview,
  IEnrollmentImportResult,
} from '@/interfaces/enrollments/enrollment-import.interface';

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

export const getMyEnrollment = async (idEnrollment: number, signal?: AbortSignal): Promise<IEnrollment> => {
  const response = await instance.get<ApiResponse<IEnrollment>>(`/enrollments/my-enrollments/${idEnrollment}`, {
    signal,
  });

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

export const downloadEnrollmentImportTemplate = async (target: IEnrollmentImportTarget): Promise<Blob> => {
  const response = await instance.get<Blob>('/enrollments/import/template', { params: target, responseType: 'blob' });

  return response.data;
};

const enrollmentImportForm = (file: File, target: IEnrollmentImportTarget): FormData => {
  const data = new FormData();

  data.append('file', file);
  data.append('courseId', String(target.courseId));
  data.append('semesterId', String(target.semesterId));

  return data;
};

export const previewEnrollmentImport = async (
  file: File,
  target: IEnrollmentImportTarget,
): Promise<IEnrollmentImportPreview> => {
  const response = await instance.post<ApiResponse<IEnrollmentImportPreview>>(
    '/enrollments/import/preview',
    enrollmentImportForm(file, target),
  );

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo revisar el archivo.');

  return response.data.data;
};

export const importEnrollments = async (
  file: File,
  target: IEnrollmentImportTarget,
): Promise<IEnrollmentImportResult> => {
  const response = await instance.post<ApiResponse<IEnrollmentImportResult>>(
    '/enrollments/import',
    enrollmentImportForm(file, target),
  );

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo confirmar la matriculación.');

  return response.data.data;
};
