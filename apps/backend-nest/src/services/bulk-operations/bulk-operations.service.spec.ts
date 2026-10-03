import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import type { CreateBulkOperationRowDto } from 'src/dtos/bulk-operations/bulk-operation.dto';
import { BULK_OPERATION_ROW_CHUNK_SIZE, BulkOperationsService } from './bulk-operations.service';

const operationId = 'b73a79d0-02ca-4a3a-8a47-5516cae13e47';
const ownerId = 17;

describe('BulkOperationsService', () => {
  const insert = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn<void, [unknown[]]>().mockReturnThis(),
    setParameters: jest.fn<void, [Record<string, string | null>]>().mockReturnThis(),
    execute: jest.fn(),
  };
  const query = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const lock = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const operations = {
    create: jest.fn((value: Partial<BulkOperation>) => value),
    save: jest.fn((value: Partial<BulkOperation>) =>
      Promise.resolve({ idBulkOperation: operationId, ...value }),
    ),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => lock),
  };
  const rows = { createQueryBuilder: jest.fn(() => query) };
  const manager = {
    getRepository: jest.fn((entity: typeof BulkOperation | typeof BulkOperationRow) =>
      entity === BulkOperation ? operations : { createQueryBuilder: () => insert },
    ),
  };
  const transaction = jest.fn(async (callback: (manager: EntityManager) => Promise<unknown>) =>
    callback(manager as unknown as EntityManager),
  );
  let service: BulkOperationsService;
  let operation: BulkOperation;
  const inputs: CreateBulkOperationRowDto[] = [
    {
      rowNumber: 3,
      data: { name: 'Carlos', nested: { flags: [true, null, 7] } },
      valid: false,
      errors: ['RU duplicado', 'Email duplicado'],
    },
    { rowNumber: 1, data: { ru: '99000001' }, valid: true },
    { rowNumber: 2, data: { ru: '99000002' }, valid: true },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    insert.execute.mockReset().mockResolvedValue({});
    operation = Object.assign(new BulkOperation(), {
      idBulkOperation: operationId,
      createdBy: { idUser: ownerId },
      status: BulkOperationStatus.PENDING,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      processedRows: 0,
      failedRows: 0,
    });
    lock.getOne.mockResolvedValue(operation);
    operations.findOne.mockResolvedValue(operation);
    query.getManyAndCount.mockResolvedValue([[], 0]);
    service = new BulkOperationsService(
      { ...operations, manager: { transaction } } as unknown as Repository<BulkOperation>,
      rows as unknown as Repository<BulkOperationRow>,
    );
  });

  it('creates an operation owned by User, with metadata and expiry', async () => {
    const expiresAt = new Date('2026-10-03T12:00:00Z');
    const result = await service.create(
      {
        type: BulkOperationType.USER_IMPORT,
        metadata: { roleName: 'STUDENT', originalFileName: 'users.xlsx' },
        expiresAt,
      },
      ownerId,
    );
    expect(result).toMatchObject({
      idBulkOperation: operationId,
      createdBy: { idUser: ownerId },
      status: BulkOperationStatus.PENDING,
      totalRows: 0,
      metadata: { roleName: 'STUDENT' },
      expiresAt,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insert.execute).not.toHaveBeenCalled();
  });

  it('creates initial rows in the same transaction, preserving JSON data and errors', async () => {
    const result = await service.create({ type: BulkOperationType.USER_IMPORT }, ownerId, inputs);
    expect(result).toMatchObject({ totalRows: 3, validRows: 2, invalidRows: 1 });
    expect(manager.getRepository).toHaveBeenCalledWith(BulkOperationRow);
    expect(insert.values.mock.calls[0][0]).toHaveLength(inputs.length);
    inputs.forEach((row, index) => {
      expect(insert.values.mock.calls[0][0][index]).toMatchObject({
        operation: { idBulkOperation: operationId },
        rowNumber: row.rowNumber,
        valid: row.valid,
      });
    });
    const parameters = insert.setParameters.mock.calls[0][0];
    expect(JSON.parse(parameters.data0!)).toEqual(inputs[0].data);
    expect(JSON.parse(parameters.errors0!)).toEqual(inputs[0].errors);
    expect(parameters.errors1).toBeNull();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('inserts multiple chunks and updates counters under a write lock', async () => {
    const batch = Array.from({ length: BULK_OPERATION_ROW_CHUNK_SIZE * 2 + 1 }, (_, index) => ({
      rowNumber: index + 1,
      data: { index },
      valid: index % 2 === 0,
    }));
    await service.saveRows(operationId, ownerId, batch);
    expect(insert.values.mock.calls.map(([values]: [unknown[]]) => values.length)).toEqual([
      500, 500, 1,
    ]);
    expect(insert.execute).toHaveBeenCalledTimes(3);
    expect(lock.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(operations.save).toHaveBeenCalledWith(
      expect.objectContaining({ totalRows: 1001, validRows: 501, invalidRows: 500 }),
    );
  });

  it('does not update counters when a later insert fails; propagates to the transaction', async () => {
    insert.execute.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('duplicate row'));
    const batch = Array.from({ length: 501 }, (_, index) => ({
      rowNumber: index + 1,
      data: {},
      valid: true,
    }));
    await expect(service.saveRows(operationId, ownerId, batch)).rejects.toThrow('duplicate row');
    expect(operations.save).not.toHaveBeenCalled();
  });

  it.each([1, 2])('paginates page %i with SQL ordering, limit and offset', async (page) => {
    const data = inputs
      .slice()
      .sort((a, b) => a.rowNumber - b.rowNumber)
      .slice((page - 1) * 2, page * 2);
    query.getManyAndCount.mockResolvedValueOnce([data, 3]);
    await expect(service.findRows(operationId, ownerId, { page, limit: 2 })).resolves.toEqual({
      data,
      meta: { page, limit: 2, total: 3, totalPages: 2 },
    });
    expect(query.orderBy).toHaveBeenCalledWith('row.rowNumber', 'ASC');
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(query.offset).toHaveBeenCalledWith((page - 1) * 2);
    expect(query.where).toHaveBeenCalledWith('operation.idBulkOperation = :operationId', {
      operationId,
    });
    expect(query.andWhere).toHaveBeenCalledWith('operation.created_by = :ownerId', { ownerId });
  });

  it.each([true, false])(
    'filters validity = %s in SQL and returns the filtered total',
    async (valid) => {
      const data = inputs.filter((row) => row.valid === valid);
      query.getManyAndCount.mockResolvedValueOnce([data, data.length]);
      const result = await service.findRows(operationId, ownerId, { valid });
      expect(query.andWhere).toHaveBeenCalledWith('row.valid = :valid', { valid });
      expect(result.data).toEqual(data);
      expect(result.meta.total).toBe(data.length);
    },
  );

  it('returns defaults and zero total pages for an empty operation', async () => {
    await expect(service.findRows(operationId, ownerId)).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('rejects missing or foreign operations without consulting rows', async () => {
    operations.findOne.mockResolvedValueOnce(null);
    await expect(service.findRows(operationId, ownerId + 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(operations.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idBulkOperation: operationId, createdBy: { idUser: ownerId + 1 } },
      }),
    );
    expect(rows.createQueryBuilder).not.toHaveBeenCalled();
  });

  it.each(['saveRows', 'update'] as const)(
    'rejects a missing/foreign operation on %s',
    async (method) => {
      lock.getOne.mockResolvedValueOnce(null);
      await expect(
        method === 'saveRows'
          ? service.saveRows(operationId, ownerId + 1, inputs)
          : service.update(operationId, ownerId + 1, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(lock.andWhere).toHaveBeenCalledWith('operation.created_by = :ownerId', {
        ownerId: ownerId + 1,
      });
      expect(insert.execute).not.toHaveBeenCalled();
      expect(operations.save).not.toHaveBeenCalled();
    },
  );

  it('updates only allowed fields with bounded counters', async () => {
    operation.totalRows = 3;
    const startedAt = new Date();
    await service.update(operationId, ownerId, {
      status: BulkOperationStatus.IMPORTING,
      processedRows: 2,
      failedRows: 1,
      startedAt,
    });
    expect(operations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BulkOperationStatus.IMPORTING,
        processedRows: 2,
        failedRows: 1,
        startedAt,
      }),
    );
    await expect(
      service.update(operationId, ownerId, { processedRows: 3, failedRows: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(operationId, ownerId, { failedRows: -1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects appends once a preview is ready', async () => {
    operation.status = BulkOperationStatus.READY;
    await expect(service.saveRows(operationId, ownerId, inputs)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(insert.execute).not.toHaveBeenCalled();
  });

  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 101 },
    { limit: 0 },
    { page: Number.MAX_SAFE_INTEGER, limit: 100 },
  ])('rejects invalid pagination %j', async (query) => {
    await expect(service.findRows(operationId, ownerId, query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects duplicate/invalid row numbers before opening a transaction', async () => {
    await expect(
      service.saveRows(operationId, ownerId, [inputs[0], inputs[0]]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.saveRows(operationId, ownerId, [{ ...inputs[0], rowNumber: 0 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(['password', 'password_hash', 'accessToken', 'secret', 'api_key'])(
    'rejects nested sensitive field %s in data and metadata',
    async (field) => {
      await expect(
        service.create(
          { type: BulkOperationType.USER_IMPORT, metadata: { nested: [{ [field]: 'sensitive' }] } },
          ownerId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.saveRows(operationId, ownerId, [
          { ...inputs[0], data: { nested: { [field]: 'sensitive' } } },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects malformed identity, non-JSON values and dates', async () => {
    await expect(service.getById('invalid', ownerId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ type: BulkOperationType.USER_IMPORT }, 0)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.create({ type: BulkOperationType.USER_IMPORT, metadata: { invalid: NaN } }, ownerId),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        { type: BulkOperationType.USER_IMPORT, expiresAt: new Date('invalid') },
        ownerId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
