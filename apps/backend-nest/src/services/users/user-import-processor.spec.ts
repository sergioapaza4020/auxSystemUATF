import { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager } from 'typeorm';
import { UnrecoverableError } from 'bullmq';
import * as bcrypt from 'bcrypt';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import {
  BulkOperationStatus as Status,
  BulkOperationRowStatus as RowStatus,
  BulkOperationType,
} from '@common/enums/bulk-operation';
import { UserImportProcessor } from './user-import-processor';
import { mapConcurrent } from './user-import-concurrency';
import { redisConnection, userImportSettings } from '@core/config/bulk-import.config';

jest.mock('bcrypt', () => ({
  hash: jest.fn((password: string, cost: number) => Promise.resolve(`hash:${cost}:${password}`)),
}));
interface InsertQuery {
  insert: jest.Mock<InsertQuery, []>;
  values: jest.Mock<InsertQuery, [Partial<User>[]]>;
  orIgnore: jest.Mock<InsertQuery, []>;
  returning: jest.Mock<InsertQuery, [string[]]>;
  execute: jest.Mock<Promise<{ raw: { id_user: number; username: string }[] }>, []>;
}
interface RelationQuery {
  relation: jest.Mock<RelationQuery, [unknown, string]>;
  of: jest.Mock<RelationQuery, [number[]]>;
  add: jest.Mock<Promise<void>, [number]>;
}
const hashMock = bcrypt.hash as unknown as jest.Mock<Promise<string>, [string, number]>;
const id = '11111111-1111-4111-8111-111111111111';
function fixture(count = 5, batchSize = 2) {
  const operation: BulkOperation = Object.assign(new BulkOperation(), {
    idBulkOperation: id,
    type: BulkOperationType.USER_IMPORT,
    status: Status.IMPORTING,
    totalRows: count,
    validRows: count,
    invalidRows: 0,
    processedRows: 0,
    failedRows: 0,
    createdBy: { idUser: 7 },
    metadata: { roleName: 'STUDENT' },
    completedAt: null,
  });
  let storedRows: BulkOperationRow[] = Array.from({ length: count }, (_, index) =>
    Object.assign(new BulkOperationRow(), {
      idBulkOperationRow: index + 1,
      rowNumber: index + 2,
      status: RowStatus.PENDING,
      valid: true,
      errors: null,
      operation,
      data: {
        name: 'Ana',
        lastname: 'Perez',
        ci: `ci${index}`,
        ru: `ru${index}`,
        email: `ana${index}@example.test`,
        username: `ru${index}`,
      },
    }),
  );
  let users: Partial<User>[] = [];
  let roles: { userIds: number[]; roleId: number }[] = [];
  let insertValues: Partial<User>[] = [];
  let roleAvailable = true;
  const select = {
    withDeleted: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(() => Promise.resolve(users)),
  };
  const insert: InsertQuery = {
    insert: jest.fn<InsertQuery, []>().mockReturnThis(),
    values: jest.fn((values: Partial<User>[]) => {
      insertValues = values;
      return insert;
    }),
    orIgnore: jest.fn<InsertQuery, []>().mockReturnThis(),
    returning: jest.fn<InsertQuery, [string[]]>().mockReturnThis(),
    execute: jest.fn(() => {
      const raw: { id_user: number; username: string }[] = [];
      for (const value of insertValues) {
        if (
          users.some((user) =>
            ['ci', 'ru', 'email', 'username'].some((field) => {
              const key = field as 'ci' | 'ru' | 'email' | 'username';
              return value[key] && user[key] === value[key];
            }),
          )
        )
          continue;
        const idUser = users.length + 100;
        users.push({ ...value, idUser });
        raw.push({ id_user: idUser, username: value.username ?? '' });
      }
      return Promise.resolve({ raw });
    }),
  };
  const userRepo = { createQueryBuilder: jest.fn((alias?: string) => (alias ? select : insert)) };
  const opQuery = {
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(() => Promise.resolve(operation)),
  };
  const opRepo = {
    findOne: jest.fn(() => Promise.resolve(operation)),
    createQueryBuilder: () => opQuery,
    save: jest.fn((value: BulkOperation) => Promise.resolve(value)),
    update: jest.fn(() => Promise.resolve()),
  };
  const rowRepo = {
    createQueryBuilder: jest.fn(() => {
      let limit: number | undefined;
      let ids: number[] | undefined;
      return {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn(function (this: unknown, _sql: string, params: { ids?: number[] }) {
          if (params.ids) ids = params.ids;
          return this;
        }),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn(function (this: unknown, value: number) {
          limit = value;
          return this;
        }),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn(() =>
          Promise.resolve(
            storedRows
              .filter(
                (row) =>
                  row.status === RowStatus.PENDING &&
                  (!ids || ids.includes(row.idBulkOperationRow)),
              )
              .slice(0, limit)
              .map((row) => ({ ...row })),
          ),
        ),
      };
    }),
    save: jest.fn((values: BulkOperationRow[]) => {
      for (const value of values)
        storedRows[
          storedRows.findIndex((row) => row.idBulkOperationRow === value.idBulkOperationRow)
        ] = value;
      return Promise.resolve(values);
    }),
    countBy: jest.fn((options: { status: RowStatus }) =>
      Promise.resolve(storedRows.filter((row) => row.status === options.status).length),
    ),
  };
  const roleRepo = {
    findOne: jest.fn(() => Promise.resolve(roleAvailable ? { idRole: 3, name: 'STUDENT' } : null)),
  };
  let related: number[] = [];
  const relation: RelationQuery = {
    relation: jest.fn<RelationQuery, [unknown, string]>().mockReturnThis(),
    of: jest.fn((ids: number[]) => {
      related = ids;
      return relation;
    }),
    add: jest.fn((roleId: number) => {
      roles.push({ userIds: related, roleId });
      return Promise.resolve();
    }),
  };
  const getRepository = (entity: unknown): unknown => {
    if (entity === User) return userRepo;
    if (entity === BulkOperation) return opRepo;
    if (entity === BulkOperationRow) return rowRepo;
    if (entity === Role) return roleRepo;
    throw new Error('Unexpected repository');
  };
  const manager = { getRepository, createQueryBuilder: () => relation } as unknown as EntityManager;
  const transaction = jest.fn(async <T>(action: (value: EntityManager) => Promise<T>) => {
    const snapshot = {
      users: users.map((user) => ({ ...user })),
      rows: storedRows.map((row) => ({ ...row })),
      roles: [...roles],
      operation: { ...operation },
    };
    try {
      return await action(manager);
    } catch (error) {
      users = snapshot.users;
      storedRows = snapshot.rows;
      roles = snapshot.roles;
      Object.assign(operation, snapshot.operation);
      throw error;
    }
  });
  const source = { getRepository, manager, transaction } as unknown as DataSource;
  const processor = new UserImportProcessor(
    source,
    new ConfigService({
      BULK_USER_IMPORT_BATCH_SIZE: String(batchSize),
      BULK_USER_IMPORT_BCRYPT_CONCURRENCY: '2',
    }),
  );
  return {
    processor,
    operation,
    rowRepo,
    roleRepo,
    userRepo,
    select,
    insert,
    relation,
    transaction,
    rows: () => storedRows,
    users: () => users,
    roles: () => roles,
    existing: (value: Partial<User>) => users.push(value),
    disableRole: () => {
      roleAvailable = false;
    },
  };
}

describe('USER_IMPORT transactional batches', () => {
  beforeEach(() => jest.clearAllMocks());
  it('processes only PENDING in bounded batches, revalidates sets, assigns roles and completes', async () => {
    const f = fixture();
    f.rows()[0].status = RowStatus.PROCESSED;
    f.rows()[1].status = RowStatus.FAILED;
    f.rows()[1].errors = ['previous conflict'];
    await f.processor.process(id);
    expect(f.users()).toHaveLength(3);
    expect(f.insert.values.mock.calls.map(([values]) => values.length)).toEqual([2, 1]);
    expect(
      f.users().every((user) => user.createdBy === 7 && user.password?.startsWith('hash:10:')),
    ).toBe(true);
    expect(f.roles().flatMap((entry) => entry.userIds)).toHaveLength(3);
    expect(f.roles().every((entry) => entry.roleId === 3)).toBe(true);
    expect(f.rows()[1].errors).toEqual(['previous conflict']);
    expect(f.operation).toEqual(
      expect.objectContaining({
        processedRows: 4,
        failedRows: 1,
        status: Status.COMPLETED_WITH_ERRORS,
      }),
    );
    expect(f.operation.completedAt).toBeInstanceOf(Date);
    expect(f.select.where).toHaveBeenCalledWith(
      expect.stringContaining('ANY(:cis)'),
      expect.objectContaining({
        cis: expect.any(Array) as unknown,
        rus: expect.any(Array) as unknown,
        emails: expect.any(Array) as unknown,
        usernames: expect.any(Array) as unknown,
      }),
    );
    expect(
      f.userRepo.createQueryBuilder.mock.calls.filter(([alias]) => alias).length,
    ).toBeLessThanOrEqual(6);
    expect(f.roleRepo.findOne).toHaveBeenCalledTimes(3); // Once per job, plus one locked check per batch.
    for (const row of f.rows()) expect(JSON.stringify(row.data)).not.toMatch(/password|hash:/);
  });
  it('COMPLETED when all rows succeed and does not duplicate completed jobs', async () => {
    const f = fixture(3);
    await f.processor.process(id);
    await f.processor.process(id);
    expect(f.users()).toHaveLength(3);
    expect(f.operation.status).toBe(Status.COMPLETED);
    expect(f.operation.processedRows).toBe(3);
    expect(f.operation.failedRows).toBe(0);
  });
  it.each(['STUDENT', 'ASSISTANT', 'TEACHER', 'DIRECTOR', 'DEAN'])(
    'persists correct username and optional RU for %s',
    async (role) => {
      const f = fixture(1);
      f.operation.metadata = { roleName: role };
      const requiresRu = role === 'STUDENT' || role === 'ASSISTANT';
      f.rows()[0].data.ru = requiresRu ? 'ru0' : '';
      f.rows()[0].data.username = requiresRu ? 'ru0' : 'ci0';
      await f.processor.process(id);
      expect(f.users()[0]).toEqual(
        expect.objectContaining({
          username: requiresRu ? 'ru0' : 'ci0',
          ru: requiresRu ? 'ru0' : undefined,
        }),
      );
      expect(f.roleRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { name: role, isActive: true },
      });
    },
  );
  it.each(['ci', 'ru', 'email', 'username'] as const)(
    'marks a %s business conflict FAILED and continues',
    async (field) => {
      const f = fixture(3);
      const value = f.rows()[0].data[field];
      f.existing({
        ci: 'different-ci',
        ru: 'different-ru',
        email: 'different@example.test',
        username: 'different',
        [field]: value,
      });
      await f.processor.process(id);
      expect(f.rows()[0].status).toBe(RowStatus.FAILED);
      expect(f.rows()[0].errors?.join(' ')).toContain(
        field === 'ci' ? 'CI' : field === 'ru' ? 'RU' : field,
      );
      expect(f.operation.status).toBe(Status.COMPLETED_WITH_ERRORS);
      expect(f.operation.processedRows).toBe(2);
      expect(f.operation.failedRows).toBe(1);
      expect(
        f
          .rows()
          .slice(1)
          .every((row) => row.status === RowStatus.PROCESSED),
      ).toBe(true);
    },
  );
  it('preserves business validation and rejects duplicate identifiers within a batch', async () => {
    const f = fixture(4, 4);
    f.rows()[0].data.email = 'not-an-email';
    f.rows()[1].data.ci = f.rows()[2].data.ci;
    f.rows()[3].data.username = 'wrong';
    await f.processor.process(id);
    expect(f.users()).toHaveLength(0);
    expect(f.rows().every((row) => row.status === RowStatus.FAILED)).toBe(true);
    expect(f.operation.failedRows).toBe(4);
  });
  it('handles unique conflicts occurring after the set-based revalidation', async () => {
    const f = fixture(2);
    f.insert.execute.mockResolvedValueOnce({ raw: [] });
    await f.processor.process(id);
    expect(f.rows().every((row) => row.status === RowStatus.FAILED)).toBe(true);
    expect(f.relation.add).not.toHaveBeenCalled();
  });
  it('rolls back users, roles, row state and counters together; retry continues pending batches', async () => {
    const f = fixture(5);
    const original = f.rowRepo.save.getMockImplementation();
    let saves = 0;
    f.rowRepo.save.mockImplementation(async (rows) => {
      saves++;
      if (saves === 2) throw new Error('database unavailable');
      return original ? original(rows) : rows;
    });
    await expect(f.processor.process(id)).rejects.toThrow('database unavailable');
    expect(f.users()).toHaveLength(2);
    expect(f.roles().flatMap((entry) => entry.userIds)).toHaveLength(2);
    expect(f.rows().filter((row) => row.status === RowStatus.PENDING)).toHaveLength(3);
    expect(f.operation.processedRows).toBe(2);
    expect(f.operation.status).toBe(Status.IMPORTING);
    await f.processor.process(id);
    expect(f.users()).toHaveLength(5);
    expect(new Set(f.users().map((user) => user.username)).size).toBe(5);
    expect(f.operation.processedRows).toBe(5);
    expect(f.operation.status).toBe(Status.COMPLETED);
  });
  it.each(['ADMIN', 'SUPERADMIN', 123, null])(
    'permanently rejects invalid role metadata %s',
    async (role) => {
      const f = fixture();
      f.operation.metadata = { roleName: role };
      await expect(f.processor.process(id)).rejects.toBeInstanceOf(UnrecoverableError);
      expect(f.insert.execute).not.toHaveBeenCalled();
    },
  );
  it('rejects a role removed/deactivated since preview', async () => {
    const f = fixture();
    f.disableRole();
    await expect(f.processor.process(id)).rejects.toBeInstanceOf(UnrecoverableError);
  });
  it('uses bcrypt cost 10 with bounded concurrency', async () => {
    const f = fixture(6, 6);
    let active = 0;
    let max = 0;
    hashMock.mockImplementation(async (password: string, cost: number) => {
      active++;
      max = Math.max(max, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      active--;
      return `hash:${cost}:${password}`;
    });
    await f.processor.process(id);
    expect(max).toBe(2);
    expect(bcrypt.hash).toHaveBeenCalledTimes(6);
    expect(hashMock.mock.calls.every(([, cost]) => cost === 10)).toBe(true);
  });
});

describe('Worker settings and concurrency helper', () => {
  it('uses safe defaults and validates configuration', () => {
    expect(userImportSettings({})).toEqual({
      batchSize: 250,
      bcryptConcurrency: 4,
      jobConcurrency: 1,
    });
    for (const value of ['0', '-1', '2.5', 'NaN', '1001'])
      expect(() => userImportSettings({ BULK_USER_IMPORT_BATCH_SIZE: value })).toThrow();
    expect(() => redisConnection({})).toThrow('REDIS_HOST');
    expect(redisConnection({ REDIS_HOST: 'localhost' })).toEqual(
      expect.objectContaining({ port: 6379, maxRetriesPerRequest: 1, enableOfflineQueue: false }),
    );
    expect(redisConnection({ REDIS_HOST: 'redis' }, true).maxRetriesPerRequest).toBeNull();
  });
  it('preserves result order with bounded asynchronous work', async () => {
    expect(await mapConcurrent([1, 2, 3], 2, (value) => Promise.resolve(value * 2))).toEqual([
      2, 4, 6,
    ]);
  });
});
