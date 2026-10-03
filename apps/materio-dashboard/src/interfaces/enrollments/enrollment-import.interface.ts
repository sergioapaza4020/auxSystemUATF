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

export interface IEnrollmentImportPreview {
  total: number;
  valid: number;
  invalid: number;
  rows: IEnrollmentImportRow[];
}

export interface IEnrollmentImportResult extends IEnrollmentImportTarget {
  imported: number;
  total: number;
}
