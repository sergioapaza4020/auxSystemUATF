export interface ICareerStudentImportRow {
  row: number;
  studentId: number | null;
  ru: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  currentCareer: { idCareer: number; name: string } | null;
  status: 'VALID' | 'INVALID';
  errors: string[];
}

export interface ICareerStudentImportPreview {
  total: number;
  valid: number;
  invalid: number;
  rows: ICareerStudentImportRow[];
}

export interface ICareerStudentImportResult {
  careerId: number;
  imported: number;
  total: number;
}
