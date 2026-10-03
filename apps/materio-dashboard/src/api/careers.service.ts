import { instance } from './config/config';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { ICareer, ICareerCreate, ICareerUpdate, IFacultyOption } from '@/interfaces/careers/career.interface';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import type {
  ICareerStudentImportPreview,
  ICareerStudentImportResult,
} from '@/interfaces/careers/career-student-import.interface';

export const getCareers = async (status?: RecordStatus, signal?: AbortSignal): Promise<ICareer[]> =>
  (await instance.get<ApiResponse<ICareer[]>>('/careers', { params: { status }, signal })).data.data;
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

export const downloadCareerStudentImportTemplate = async (careerId: number): Promise<Blob> => {
  const response = await instance.get<Blob>(`/careers/${careerId}/students/import/template`, { responseType: 'blob' });

  return response.data;
};

const careerStudentImportForm = (file: File): FormData => {
  const data = new FormData();

  data.append('file', file);

  return data;
};

export const previewCareerStudentImport = async (
  file: File,
  careerId: number,
): Promise<ICareerStudentImportPreview> => {
  const response = await instance.post<ApiResponse<ICareerStudentImportPreview>>(
    `/careers/${careerId}/students/import/preview`,
    careerStudentImportForm(file),
  );

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo revisar el archivo.');

  return response.data.data;
};

export const importCareerStudents = async (file: File, careerId: number): Promise<ICareerStudentImportResult> => {
  const response = await instance.post<ApiResponse<ICareerStudentImportResult>>(
    `/careers/${careerId}/students/import`,
    careerStudentImportForm(file),
  );

  if (!response.data.status) throw new Error(response.data.message || 'No se pudo confirmar la asignación.');

  return response.data.data;
};
