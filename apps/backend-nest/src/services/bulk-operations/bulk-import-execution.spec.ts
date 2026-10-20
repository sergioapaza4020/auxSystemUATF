import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository, type FindManyOptions } from 'typeorm';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import {
  BulkOperationStatus as Status,
  BulkOperationType as Type,
  BulkOperationRowStatus,
} from '@common/enums/bulk-operation';
import { BulkOperationsService } from './bulk-operations.service';
const id = '00000000-0000-4000-8000-000000000001';
function fixture(type = Type.ENROLLMENT_IMPORT, count = 501) {
  const stored = Object.assign(new BulkOperation(), {
    idBulkOperation: id,
    createdBy: { idUser: 9 },
    type,
    status: Status.READY,
    totalRows: count,
    validRows: count,
    invalidRows: 0,
    processedRows: 0,
    failedRows: 0,
  });
  let working = stored;
  let requestedOwner = 9;
  const lock = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(() => Promise.resolve(requestedOwner === 9 ? working : null)),
  };
  lock.andWhere.mockImplementation((_sql: string, values: { ownerId: number }) => {
    requestedOwner = values.ownerId;
    return lock;
  });
  const operations = {
    createQueryBuilder: jest.fn(() => lock),
    save: jest.fn((value: BulkOperation) => Promise.resolve(value)),
  };
  const records = Array.from({ length: count }, (_, index) =>
    Object.assign(new BulkOperationRow(), {
      rowNumber: index + 2,
      valid: true,
      data: { studentId: index + 1, ru: String(index + 1) },
    }),
  );
  const rows = {
    find: jest.fn((query: FindManyOptions<BulkOperationRow>) =>
      Promise.resolve(records.slice(query.skip, (query.skip ?? 0) + (query.take ?? 500))),
    ),
    update: jest.fn().mockResolvedValue({}),
  };
  const manager = {
    getRepository: (entity: unknown) => (entity === BulkOperation ? operations : rows),
  };
  const transaction = jest.fn(
    async (_isolation: string, work: (manager: EntityManager) => Promise<unknown>) => {
      working = Object.assign(new BulkOperation(), stored);
      const result = await work(manager as unknown as EntityManager);
      Object.assign(stored, working);
      return result;
    },
  );
  const repository = {
    ...operations,
    manager: { transaction },
  } as unknown as Repository<BulkOperation>;
  return {
    service: new BulkOperationsService(repository, rows as unknown as Repository<BulkOperationRow>),
    stored,
    rows,
    records,
    lock,
    transaction,
  };
}
it.each([Type.ENROLLMENT_IMPORT, Type.CAREER_STUDENT_IMPORT])(
  'executes %s in one locked transaction with bounded reads and durable counters',
  async (type) => {
    const f = fixture(type);
    const work = jest.fn(
      async (_manager: EntityManager, operation: BulkOperation, rows: BulkOperationRow[]) => {
        expect(operation.status).toBe(Status.IMPORTING);
        expect(rows).toHaveLength(501);
        return Promise.resolve({ imported: rows.length });
      },
    );
    expect(await f.service.executeReady(id, 9, type, work)).toEqual({ imported: 501 });
    expect(f.rows.find).toHaveBeenCalledTimes(2);
    expect(f.rows.find.mock.calls.map(([query]) => query.skip)).toEqual([0, 500]);
    expect(f.lock.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(f.stored).toMatchObject({ status: Status.COMPLETED, processedRows: 501, failedRows: 0 });
    expect(f.rows.update).toHaveBeenCalledWith(
      { operation: { idBulkOperation: id }, valid: true },
      { status: BulkOperationRowStatus.PROCESSED },
    );
    await expect(f.service.executeReady(id, 9, type, work)).rejects.toThrow(ConflictException);
    expect(work).toHaveBeenCalledTimes(1);
  },
);
it('rejects foreign owners and other types before invoking domain writes', async () => {
  const f = fixture();
  const work = jest.fn();
  await expect(f.service.executeReady(id, 10, Type.ENROLLMENT_IMPORT, work)).rejects.toThrow(
    NotFoundException,
  );
  await expect(f.service.executeReady(id, 9, Type.CAREER_STUDENT_IMPORT, work)).rejects.toThrow(
    NotFoundException,
  );
  expect(work).not.toHaveBeenCalled();
  expect(f.rows.find).not.toHaveBeenCalled();
});
it('rolls back operation state when domain validation/write fails', async () => {
  const f = fixture();
  await expect(
    f.service.executeReady(id, 9, Type.ENROLLMENT_IMPORT, () =>
      Promise.reject(new Error('Conflict')),
    ),
  ).rejects.toThrow('Conflict');
  expect(f.stored.status).toBe(Status.READY);
  expect(f.rows.update).not.toHaveBeenCalled();
});
it('rejects invalid, empty, expired and incomplete persisted previews', async () => {
  const f = fixture();
  const work = jest.fn();
  f.stored.invalidRows = 1;
  await expect(f.service.executeReady(id, 9, Type.ENROLLMENT_IMPORT, work)).rejects.toThrow(
    BadRequestException,
  );
  f.stored.invalidRows = 0;
  f.stored.expiresAt = new Date(0);
  await expect(f.service.executeReady(id, 9, Type.ENROLLMENT_IMPORT, work)).rejects.toThrow(
    ConflictException,
  );
  f.stored.expiresAt = null;
  f.rows.find.mockResolvedValue([]);
  await expect(f.service.executeReady(id, 9, Type.ENROLLMENT_IMPORT, work)).rejects.toThrow(
    ConflictException,
  );
  expect(work).not.toHaveBeenCalled();
});
