import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import { USER_IMPORT_JOB, USER_IMPORT_QUEUE } from '@common/types/user-import-job';
import type { UserImportJob } from '@common/types/user-import-job';
import { userImportStatus } from 'src/dtos/users/user-import-status.dto';

@Injectable()
export class UserImportJobsService {
  constructor(
    private readonly source: DataSource,
    private readonly bulk: BulkOperationsService,
    @InjectQueue(USER_IMPORT_QUEUE) private readonly queue: Queue<UserImportJob>,
  ) {}

  async confirm(id: string, ownerId: number) {
    await this.bulk.getById(id, ownerId);
    const operation = await this.source.transaction(async (manager) => {
      const repo = manager.getRepository(BulkOperation);
      const operation = await repo
        .createQueryBuilder('operation')
        .where('operation.idBulkOperation = :id', { id })
        .andWhere('operation.created_by = :ownerId', { ownerId })
        .setLock('pessimistic_write')
        .getOne();
      if (!operation || operation.type !== BulkOperationType.USER_IMPORT)
        throw new NotFoundException('User import not found');
      if (operation.status === BulkOperationStatus.IMPORTING) return operation; // Repeated request repairs delivery, never resets progress.
      if (operation.status !== BulkOperationStatus.READY)
        throw new ConflictException('User import is not READY');
      if (operation.expiresAt && operation.expiresAt <= new Date())
        throw new ConflictException('User import has expired');
      if (
        operation.invalidRows > 0 ||
        operation.validRows !== operation.totalRows ||
        operation.totalRows < 1
      )
        throw new BadRequestException('El preview debe contener únicamente filas válidas');
      operation.status = BulkOperationStatus.IMPORTING;
      operation.startedAt = new Date();
      operation.completedAt = null;
      return repo.save(operation);
    });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.queue.add(USER_IMPORT_JOB, { operationId: id }, { jobId: id }),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => reject(new Error('Queue acknowledgement timeout')), 5000);
        }),
      ]);
    } catch {
      // Redis acknowledgement can be ambiguous: never roll back IMPORTING to READY.
      throw new ServiceUnavailableException(
        'La operación quedó registrada. Consulta su estado; el worker recuperará el encolado.',
      );
    } finally {
      if (deadline) clearTimeout(deadline);
    }
    return userImportStatus(operation);
  }

  async status(id: string, ownerId: number) {
    const operation = await this.bulk.getById(id, ownerId);
    if (operation.type !== BulkOperationType.USER_IMPORT)
      throw new NotFoundException('User import not found');
    return userImportStatus(operation);
  }
}
