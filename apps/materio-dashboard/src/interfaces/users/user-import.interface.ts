import type { PaginationMeta } from '../apiResponse';

export type UserImportStatus = 'all' | 'valid' | 'invalid';

export interface UserImportPreviewQuery {
  page: number;
  limit: number;
  status: UserImportStatus;
  search: string;
}

export interface IUserImportRow {
  row: number;
  name: string;
  lastname: string;
  ci: string;
  ru: string;
  email: string;
  username: string;
  valid: boolean;
  errors: string[];
}

export interface IUserImportPreview {
  operationId: string;
  total: number;
  valid: number;
  invalid: number;
  data: IUserImportRow[];
  meta: PaginationMeta;
}

export type UserImportExecutionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'EXPIRED';

export interface IUserImportExecution {
  operationId: string;
  status: UserImportExecutionStatus;
  total: number;
  processed: number;
  failed: number;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
}
