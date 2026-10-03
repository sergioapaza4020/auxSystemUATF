import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BulkOperation } from './bulk-operation.entity';
import { BulkOperationRowStatus } from '@common/enums/bulk-operation';
import type { JsonObject } from 'src/dtos/bulk-operations/bulk-operation.dto';

@Entity('bulk_operation_rows')
@Index('UQ_bulk_operation_rows_operation_row', ['operation', 'rowNumber'], { unique: true })
@Index('IDX_bulk_operation_rows_operation_valid', ['operation', 'valid'])
@Index('IDX_bulk_operation_rows_operation_status', ['operation', 'status'])
@Check('CHK_bulk_operation_rows_row_number', '"row_number" > 0')
export class BulkOperationRow {
  @PrimaryGeneratedColumn({
    name: 'id_bulk_operation_row',
    primaryKeyConstraintName: 'PK_bulk_operation_rows',
  })
  idBulkOperationRow: number;

  @ManyToOne(() => BulkOperation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'id_bulk_operation',
    foreignKeyConstraintName: 'FK_bulk_operation_rows_operation',
  })
  operation: BulkOperation;

  @Column({ name: 'row_number' })
  rowNumber: number;

  @Column({ type: 'jsonb' })
  data: JsonObject;

  @Column({ type: 'boolean' })
  valid: boolean;

  @Column({ type: 'jsonb', nullable: true })
  errors: string[] | null;

  @Column({
    type: 'enum',
    enum: BulkOperationRowStatus,
    enumName: 'bulk_operation_rows_status_enum',
    default: BulkOperationRowStatus.PENDING,
  })
  status: BulkOperationRowStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
