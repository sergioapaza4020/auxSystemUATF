import type {
  ICareerStudentImportPreview,
  ICareerStudentImportRow,
} from '@/interfaces/careers/career-student-import.interface';

export type CareerStudentImportFilter = 'all' | 'VALID' | 'INVALID';

export function filterCareerStudentImportRows(
  rows: ICareerStudentImportRow[],
  search: string,
  filter: CareerStudentImportFilter,
) {
  const query = search.trim().toLocaleLowerCase();

  return rows.filter(
    (row) =>
      (filter === 'all' || row.status === filter) &&
      [row.fullName, row.ru, row.username, row.email, row.currentCareer?.name].some((value) =>
        (value ?? '').toLocaleLowerCase().includes(query),
      ),
  );
}

export function canConfirmCareerStudentImport(preview: ICareerStudentImportPreview | null): boolean {
  return (
    !!preview &&
    preview.invalid === 0 &&
    preview.valid > 0 &&
    preview.total === preview.valid &&
    preview.rows.length === preview.total &&
    preview.rows.every((row) => row.status === 'VALID' && row.errors.length === 0)
  );
}
