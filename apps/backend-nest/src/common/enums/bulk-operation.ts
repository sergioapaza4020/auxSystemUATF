export enum BulkOperationType {
  USER_IMPORT = 'USER_IMPORT',
  // Future types (with a corresponding enum migration):
  // CAREER_STUDENT_ASSIGNMENT, COURSE_ENROLLMENT, GRADE_IMPORT.
}

export enum BulkOperationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  IMPORTING = 'IMPORTING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum BulkOperationRowStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}
