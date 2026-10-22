import type { IEnrollmentImportPreview } from '@/interfaces/enrollments/enrollment-import.interface';

export function canConfirmEnrollmentImport(preview: IEnrollmentImportPreview | null): boolean {
  return (
    !!preview && preview.invalid === 0 && preview.total > 0 && preview.total === preview.valid && !!preview.operationId
  );
}

export const enrollmentImportActionLabel = (row: {
  status: 'VALID' | 'INVALID';
  action?: 'CREATE_ACCOUNT' | 'ENROLL' | 'SKIP' | 'ERROR';
}) => {
  if (row.status === 'INVALID' || row.action === 'ERROR') return 'Error';
  if (row.action === 'CREATE_ACCOUNT') return 'Crear cuenta y matricular';
  if (row.action === 'SKIP') return 'Ya matriculado: se omitirá';

  return 'Usar cuenta existente y matricular';
};
