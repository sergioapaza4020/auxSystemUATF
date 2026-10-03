export const USER_IMPORT_QUEUE = 'bulk-user-import';
export const USER_IMPORT_JOB = 'user-import';
export const USER_IMPORT_ATTEMPTS = 3;
export interface UserImportJob {
  operationId: string;
}
