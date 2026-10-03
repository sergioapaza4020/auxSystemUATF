import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { BulkOperationsService } from 'src/services/bulk-operations/bulk-operations.service';

@Module({
  imports: [TypeOrmModule.forFeature([BulkOperation, BulkOperationRow])],
  providers: [BulkOperationsService],
  exports: [BulkOperationsService],
})
export class BulkOperationsModule {}
