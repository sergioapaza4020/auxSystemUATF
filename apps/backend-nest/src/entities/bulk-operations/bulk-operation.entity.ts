import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';
import { User } from '../users/users.entity';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import type { JsonObject } from 'src/dtos/bulk-operations/bulk-operation.dto';

@Entity('bulk_operations')
@Index('IDX_bulk_operations_created_by', ['createdBy'])
@Index('IDX_bulk_operations_type', ['type'])
@Index('IDX_bulk_operations_status', ['status'])
@Index('IDX_bulk_operations_created_at', ['createdAt'])
@Index('IDX_bulk_operations_expires_at', ['expiresAt'])
@Check(
  'CHK_bulk_operations_counts',
  '"total_rows" >= 0 AND "valid_rows" >= 0 AND "invalid_rows" >= 0 AND "processed_rows" >= 0 AND "failed_rows" >= 0 AND "valid_rows" + "invalid_rows" = "total_rows" AND "processed_rows" + "failed_rows" <= "total_rows"',
)
export class BulkOperation {
  @PrimaryGeneratedColumn('uuid', {
    name: 'id_bulk_operation',
    primaryKeyConstraintName: 'PK_bulk_operations',
  })
  idBulkOperation: string;

  @Column({ type: 'enum', enum: BulkOperationType, enumName: 'bulk_operations_type_enum' })
  type: BulkOperationType;

  @Column({
    type: 'enum',
    enum: BulkOperationStatus,
    enumName: 'bulk_operations_status_enum',
    default: BulkOperationStatus.PENDING,
  })
  status: BulkOperationStatus;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'FK_bulk_operations_created_by' })
  createdBy: User;

  @Column({ name: 'total_rows', default: 0 })
  totalRows: number;

  @Column({ name: 'valid_rows', default: 0 })
  validRows: number;

  @Column({ name: 'invalid_rows', default: 0 })
  invalidRows: number;

  @Column({ name: 'processed_rows', default: 0 })
  processedRows: number;

  @Column({ name: 'failed_rows', default: 0 })
  failedRows: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: JsonObject | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;
}
