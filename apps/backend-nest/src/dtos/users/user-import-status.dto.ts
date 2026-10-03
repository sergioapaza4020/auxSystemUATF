import { ApiProperty } from '@nestjs/swagger';
import { BulkOperationStatus } from '@common/enums/bulk-operation';
import type { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';

export class UserImportStatusDto {
  @ApiProperty({ format: 'uuid' })
  operationId: string;
  @ApiProperty({ enum: BulkOperationStatus })
  status: BulkOperationStatus;
  @ApiProperty()
  total: number;
  @ApiProperty()
  processed: number;
  @ApiProperty()
  failed: number;
  @ApiProperty()
  progress: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  startedAt: Date | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  completedAt: Date | null;
}

export function userImportStatus(operation: BulkOperation): UserImportStatusDto {
  return {
    operationId: operation.idBulkOperation,
    status: operation.status,
    total: operation.totalRows,
    processed: operation.processedRows,
    failed: operation.failedRows,
    progress: operation.totalRows
      ? Math.min(
          100,
          ((operation.processedRows + operation.failedRows) / operation.totalRows) * 100,
        )
      : 0,
    startedAt: operation.startedAt,
    completedAt: operation.completedAt,
  };
}
