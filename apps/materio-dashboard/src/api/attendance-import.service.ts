import type { ApiResponse } from '@/interfaces/apiResponse';
import type {
  AttendanceImportChoice,
  AttendanceImportPreview,
  AttendanceImportSummary,
} from '@/interfaces/attendances/attendance-import.interface';

import { instance } from './config/config';

export async function downloadAttendanceTemplate(enrollmentId: number) {
  const { data } = await instance.get<Blob>(`/attendances/import/${enrollmentId}/template`, { responseType: 'blob' });

  const url = URL.createObjectURL(data);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'plantilla-asistencia.xlsx';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function previewAttendanceImport(
  enrollmentId: number,
  file: File,
  choices: AttendanceImportChoice[],
  updateExisting: boolean,
) {
  const body = new FormData();

  body.append('file', file);
  body.append('options', JSON.stringify({ choices, updateExisting }));

  const { data } = await instance.post<ApiResponse<AttendanceImportPreview>>(
    `/attendances/import/${enrollmentId}/preview`,
    body,
    { timeout: 60000 },
  );

  if (!data.status) throw new Error(data.message || 'No se pudo validar el archivo.');

  return data.data;
}

export async function confirmAttendanceImport(enrollmentId: number, operationId: string) {
  const { data } = await instance.post<ApiResponse<AttendanceImportSummary>>(
    `/attendances/import/${enrollmentId}/${operationId}/confirm`,
    undefined,
    { timeout: 120000 },
  );

  if (!data.status) throw new Error(data.message || 'No se pudo confirmar la importación.');

  return data.data;
}
