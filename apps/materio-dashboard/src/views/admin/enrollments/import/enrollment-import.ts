import type { IEnrollmentImportPreview } from '@/interfaces/enrollments/enrollment-import.interface';

export function canConfirmEnrollmentImport(preview: IEnrollmentImportPreview | null): boolean {
  return (
    !!preview && preview.invalid === 0 && preview.valid > 0 && preview.total === preview.valid && !!preview.operationId
  );
}
