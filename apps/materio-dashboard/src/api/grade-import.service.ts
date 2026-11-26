import type { ApiResponse } from '@/interfaces/apiResponse';
import type {
  GradeImportChoice,
  GradeImportPreview,
  GradeImportSummary,
} from '@/interfaces/grades/grade-import.interface';

import { instance } from './config/config';

export async function downloadGradeTemplate(enrollmentId: number) {
  const { data } = await instance.get<Blob>(`/grades/import/${enrollmentId}/template`, { responseType: 'blob' });

  const url = URL.createObjectURL(data);

  const link = document.createElement('a');

  link.href = url;
  link.download = 'plantilla-calificaciones.xlsx';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function previewGradeImport(
  enrollmentId: number,
  file: File,
  choices: GradeImportChoice[],
  updateExisting: boolean,
) {
  const body = new FormData();

  body.append('file', file);
  body.append('options', JSON.stringify({ choices, updateExisting }));

  const { data } = await instance.post<ApiResponse<GradeImportPreview>>(`/grades/import/${enrollmentId}/preview`, body);

  if (!data.status) throw new Error(data.message || 'No se pudo validar el archivo.');

  return data.data;
}

export async function confirmGradeImport(enrollmentId: number, operationId: string) {
  const { data } = await instance.post<ApiResponse<GradeImportSummary>>(
    `/grades/import/${enrollmentId}/${operationId}/confirm`,
  );

  if (!data.status) throw new Error(data.message || 'No se pudo confirmar la importación.');

  return data.data;
}
