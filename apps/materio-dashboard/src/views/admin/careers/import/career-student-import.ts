import type { ICareerStudentImportPreview } from '@/interfaces/careers/career-student-import.interface';

export function canConfirmCareerStudentImport(preview: ICareerStudentImportPreview | null): boolean {
  return (
    !!preview && preview.invalid === 0 && preview.valid > 0 && preview.total === preview.valid && !!preview.operationId
  );
}
