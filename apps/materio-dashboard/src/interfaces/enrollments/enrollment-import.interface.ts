import type { ImportPreviewPage } from '../import-preview.interface';

export interface IEnrollmentImportTarget {
  courseId: number;
  semesterId: number;
}

export interface IEnrollmentImportRow {
  row: number;
  studentId: number | null;
  ru: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  status: 'VALID' | 'INVALID';
  errors: string[];
}

export interface IEnrollmentImportPreview extends ImportPreviewPage<IEnrollmentImportRow> {}

export interface IEnrollmentImportResult extends IEnrollmentImportTarget {
  imported: number;
  total: number;
}
