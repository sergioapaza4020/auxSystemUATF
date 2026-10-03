import type { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface CreateBulkOperationDto {
  type: BulkOperationType;
  metadata?: JsonObject;
  expiresAt?: Date;
}

export interface CreateBulkOperationRowDto {
  rowNumber: number;
  data: JsonObject;
  valid: boolean;
  errors?: string[];
}

export interface UpdateBulkOperationDto {
  status?: BulkOperationStatus;
  processedRows?: number;
  failedRows?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface BulkOperationRowsQueryDto {
  page?: number;
  limit?: number;
  valid?: boolean;
}
