import type { ImportPreviewQuery } from '@/interfaces/import-preview.interface';
import type {
  IStudentGradeSummary,
  IIndividualStudentGradeSummary,
} from '@/interfaces/enrollments/student-grade-summary.interface';
import type { ApiResponse, PaginatedApiResponse } from '@/interfaces/apiResponse';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import type { IEnrollment, IMyEnrollment } from '@/interfaces/enrollments/enrollment.interface';
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
export const getEnrollmentsPage = async (query: EnrollmentPageQuery, signal?: AbortSignal) =>
  (await instance.get<PaginatedApiResponse<IEnrollment[]>>('/enrollments', { params: query, signal })).data;

export const deactivateEnrollment = async (id: number) => {
  await instance.delete(`/enrollments/${id}`);
};

export const reactivateEnrollment = async (id: number) => {
  await instance.patch(`/enrollments/reactivate/${id}`);
};

export const getMyEnrollments = async (signal?: AbortSignal): Promise<IMyEnrollment[]> => {
  const myEnrollments = await instance.get<ApiResponse<IMyEnrollment[]>>('/enrollments/my-enrollments', {
    params: { current: true },
    signal,
  });

  return myEnrollments.data.data;
};

export const getMyEnrollment = async (idEnrollment: number, signal?: AbortSignal): Promise<IEnrollment> => {
  const response = await instance.get<ApiResponse<IEnrollment>>(`/enrollments/my-enrollments/${idEnrollment}`, {
    signal,
  });

  return response.data.data;
};

export const getManagedEnrollment = async (idEnrollment: number, includeCourseScheme = true): Promise<IEnrollment> => {
  const response = await instance.get(`/enrollments/managed/${idEnrollment}`, {
    params: { includeCourseScheme },
  });

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

export interface StudentRosterQuery {
  page: number;
  limit: number;
  search?: string;
}

export const getEnrollmentStudentsPage = async (id: number, query: StudentRosterQuery, signal?: AbortSignal) =>
  (
    await instance.get<PaginatedApiResponse<IEnrollmentStudent[]>>(`/enrollments/${id}/students`, {
      params: query,
      signal,
    })
  ).data;

export const getStudentGradeSummaryPage = async (id: number, query: StudentRosterQuery, signal?: AbortSignal) =>
  (
    await instance.get<PaginatedApiResponse<IStudentGradeSummary & { roster: IEnrollmentStudent[] }>>(
      `/enrollments/${id}/student-grade-summary`,
      { params: query, signal },
    )
  ).data;

export const getIndividualStudentGradeSummary = async (
  idEnrollment: number,
  studentEnrollmentId: number,
): Promise<IIndividualStudentGradeSummary> => {
  const response = await instance.get<ApiResponse<IIndividualStudentGradeSummary>>(
    `/enrollments/${idEnrollment}/students/${studentEnrollmentId}/grade-summary`,
  );

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo cargar el resumen de notas.');

  return response.data.data;
};

export const getStudentGradeSummary = async (
  idEnrollment: number,
  signal?: AbortSignal,
): Promise<IStudentGradeSummary> => {
  const response = await instance.get<ApiResponse<IStudentGradeSummary>>(
    `/enrollments/${idEnrollment}/student-grade-summary`,
    { signal },
  );

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo cargar el resumen de notas.');

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

export const getEnrollmentImportPreviewPage = async (
  operationId: string,
  query: ImportPreviewQuery,
  signal?: AbortSignal,
): Promise<IEnrollmentImportPreview> => {
  const response = await instance.get<ApiResponse<IEnrollmentImportPreview>>(
    `/enrollments/import/preview/${operationId}`,
    { params: query, signal },
  );

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo cargar el preview.');

  return response.data.data;
};

export const importEnrollments = async (operationId: string): Promise<IEnrollmentImportResult> => {
  const response = await instance.post<ApiResponse<IEnrollmentImportResult>>('/enrollments/import', { operationId });

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo confirmar la matriculación.');

  return response.data.data;
};
