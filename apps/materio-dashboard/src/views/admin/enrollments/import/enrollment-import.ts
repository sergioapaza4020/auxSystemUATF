import type {
  IEnrollmentImportPreview,
  IEnrollmentImportRow,
} from '@/interfaces/enrollments/enrollment-import.interface';

export type EnrollmentImportFilter = 'all' | 'VALID' | 'INVALID';

export function filterEnrollmentImportRows(
  rows: IEnrollmentImportRow[],
  search: string,
  filter: EnrollmentImportFilter,
) {
  const query = search.trim().toLocaleLowerCase();

  return rows.filter(
    (row) =>
      (filter === 'all' || row.status === filter) &&
      [row.fullName, row.ru, row.username, row.email].some((value) =>
        (value ?? '').toLocaleLowerCase().includes(query),
      ),
  );
}

export function canConfirmEnrollmentImport(preview: IEnrollmentImportPreview | null): boolean {
  return (
    !!preview &&
    preview.invalid === 0 &&
    preview.valid > 0 &&
    preview.total === preview.valid &&
    preview.rows.length === preview.total &&
    preview.rows.every((row) => row.status === 'VALID' && row.errors.length === 0)
  );
}
