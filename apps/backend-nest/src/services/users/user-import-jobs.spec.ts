import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import type { DataSource, EntityManager } from 'typeorm';
import type { Queue } from 'bullmq';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationStatus as Status, BulkOperationType } from '@common/enums/bulk-operation';
import { USER_IMPORT_JOB, USER_IMPORT_QUEUE } from '@common/types/user-import-job';
import type { UserImportJob } from '@common/types/user-import-job';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { UsersController } from 'src/controllers/users/users.controller';
import { UserImportJobsService } from './user-import-jobs.service';
import { userImportStatus } from 'src/dtos/users/user-import-status.dto';

const id = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const operation: BulkOperation = Object.assign(new BulkOperation(), {
    idBulkOperation: id,
    type: BulkOperationType.USER_IMPORT,
    status: Status.READY,
    totalRows: 100,
    validRows: 100,
    invalidRows: 0,
    processedRows: 0,
    failedRows: 0,
    createdBy: { idUser: 7 },
    expiresAt: null,
    startedAt: null,
    completedAt: null,
  });
  const query = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(operation),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => query),
    save: jest.fn((value: BulkOperation) => Promise.resolve(value)),
  };
  let tail = Promise.resolve();
  const source = {
    transaction: jest.fn(<T>(callback: (manager: EntityManager) => Promise<T>) => {
      const next = tail.then(() =>
        callback({ getRepository: () => repo } as unknown as EntityManager),
      );
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    }),
  };
  const bulk = {
    getById: jest.fn((_id: string, owner: number) => {
      if (_id !== id || owner !== 7) throw new NotFoundException();
      return Promise.resolve(operation);
    }),
  };
  const jobs = new Set<string>();
  const queue = {
    add: jest.fn((_name: string, _payload: UserImportJob, options: { jobId: string }) => {
      jobs.add(options.jobId);
      return Promise.resolve();
    }),
  };
  const service = new UserImportJobsService(
    source as unknown as DataSource,
    bulk as unknown as BulkOperationsService,
    queue as unknown as Queue<UserImportJob>,
  );
  return { operation, query, repo, source, bulk, queue, jobs, service };
}

describe('USER_IMPORT enqueue and durable status', () => {
  it('atomically claims READY, returns progress and queues only the identifier', async () => {
    const f = fixture();
    expect(await f.service.confirm(id, 7)).toEqual(
      expect.objectContaining({
        operationId: id,
        status: Status.IMPORTING,
        total: 100,
        processed: 0,
        failed: 0,
        progress: 0,
      }),
    );
    expect(f.query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(f.query.andWhere).toHaveBeenCalledWith('operation.created_by = :ownerId', {
      ownerId: 7,
    });
    expect(f.queue.add).toHaveBeenCalledWith(USER_IMPORT_JOB, { operationId: id }, { jobId: id });
    expect(USER_IMPORT_QUEUE).toBe('bulk-user-import');
    expect(f.operation.startedAt).toBeInstanceOf(Date);
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        Object.getOwnPropertyDescriptor(UsersController.prototype, 'confirmImport')
          ?.value as unknown,
      ),
    ).toBe(202);
  });
  it.each([
    [id, 8],
    ['22222222-2222-4222-8222-222222222222', 7],
  ])('hides missing/non-owned operations', async (operationId, owner) => {
    const f = fixture();
    await expect(f.service.confirm(operationId, owner)).rejects.toBeInstanceOf(NotFoundException);
    await expect(f.service.status(operationId, owner)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.queue.add).not.toHaveBeenCalled();
  });
  it('rejects a different domain type', async () => {
    const f = fixture();
    f.operation.type = 'OTHER' as BulkOperationType;
    await expect(f.service.confirm(id, 7)).rejects.toBeInstanceOf(NotFoundException);
    await expect(f.service.status(id, 7)).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([
    Status.PENDING,
    Status.PROCESSING,
    Status.COMPLETED,
    Status.COMPLETED_WITH_ERRORS,
    Status.FAILED,
    Status.EXPIRED,
  ])('rejects %s', async (status) => {
    const f = fixture();
    f.operation.status = status;
    await expect(f.service.confirm(id, 7)).rejects.toBeInstanceOf(ConflictException);
    expect(f.queue.add).not.toHaveBeenCalled();
  });
  it('rejects expired previews and previews containing invalid rows', async () => {
    const f = fixture();
    f.operation.expiresAt = new Date(0);
    await expect(f.service.confirm(id, 7)).rejects.toBeInstanceOf(ConflictException);
    f.operation.expiresAt = null;
    f.operation.invalidRows = 1;
    await expect(f.service.confirm(id, 7)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('serializes concurrent confirms and uses a stable retained job without resetting progress', async () => {
    const f = fixture();
    await Promise.all([f.service.confirm(id, 7), f.service.confirm(id, 7)]);
    expect(f.jobs.size).toBe(1);
    expect(f.repo.save).toHaveBeenCalledTimes(1);
    f.operation.processedRows = 40;
    f.operation.failedRows = 10;
    expect(await f.service.confirm(id, 7)).toEqual(
      expect.objectContaining({ processed: 40, failed: 10, progress: 50 }),
    );
    expect(f.repo.save).toHaveBeenCalledTimes(1);
  });
  it('keeps durable IMPORTING intent when Redis acknowledgement fails', async () => {
    const f = fixture();
    f.queue.add.mockRejectedValueOnce(new Error('redis down'));
    await expect(f.service.confirm(id, 7)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(f.operation.status).toBe(Status.IMPORTING);
    await f.service.confirm(id, 7);
    expect(f.jobs.size).toBe(1);
  });
  it('bounds enqueue acknowledgement time without waiting for processing', async () => {
    jest.useFakeTimers();
    try {
      const f = fixture();
      f.queue.add.mockImplementation(() => new Promise<void>(() => undefined));
      const result = f.service.confirm(id, 7);
      const assertion = expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
      await jest.advanceTimersByTimeAsync(5000);
      await assertion;
      expect(f.operation.status).toBe(Status.IMPORTING);
    } finally {
      jest.useRealTimers();
    }
  });
  it('returns durable counters including failed rows, dates and progress; empty totals stay finite', async () => {
    const f = fixture();
    f.operation.processedRows = 75;
    f.operation.failedRows = 5;
    expect(await f.service.status(id, 7)).toEqual(
      expect.objectContaining({ total: 100, processed: 75, failed: 5, progress: 80 }),
    );
    f.operation.totalRows = 0;
    expect(userImportStatus(f.operation).progress).toBe(0);
  });
});
