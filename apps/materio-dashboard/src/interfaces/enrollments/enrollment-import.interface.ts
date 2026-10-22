import type { ImportPreviewPage } from '../import-preview.interface';

export interface IEnrollmentImportTarget {
  courseId: number;
  semesterId: number;
}

export interface IEnrollmentImportRow {
  action?: 'CREATE_ACCOUNT' | 'ENROLL' | 'SKIP' | 'ERROR';
  row: number;
  studentId: number | null;
  ru: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  status: 'VALID' | 'INVALID';
  errors: string[];
}

export interface IEnrollmentImportPreview extends ImportPreviewPage<IEnrollmentImportRow> {
  newAccounts?: number;
  existingAccounts?: number;
  skipped?: number;
}

export interface IEnrollmentImportResult extends IEnrollmentImportTarget {
  accountsCreated?: number;
  accountsReused?: number;
  skipped?: number;
  errors?: number;
  imported: number;
  total: number;
}
