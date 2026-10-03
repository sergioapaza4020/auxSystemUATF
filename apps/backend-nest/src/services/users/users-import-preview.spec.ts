import { Readable } from 'node:stream';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DataSource, Repository } from 'typeorm';
import { BulkOperationStatus, BulkOperationType } from '@common/enums/bulk-operation';
import { User } from 'src/entities/users/users.entity';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { UserImportPreviewQueryDto } from 'src/dtos/users/users-import-preview.dto';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { RolesService } from '../roles/roles.service';
import { UsersService } from './users.service';
import { userImportSearchCondition } from './users-import-preview';
import { createValidationPipe } from '@core/pipes/validation.pipe';

const operationId = 'b73a79d0-02ca-4a3a-8a47-5516cae13e47';
const ownerId = 17;

async function workbookFile(
  values: string[][],
  headers = ['Nombres', 'Apellidos', 'CI', 'RU', 'Email'],
): Promise<Express.Multer.File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Usuarios');
  sheet.addRow(headers);
  for (const row of values) sheet.addRow(row);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    fieldname: 'file',
    originalname: 'users.xlsx',
    encoding: '7bit',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.length,
    buffer,
    stream: Readable.from(buffer),
    destination: '',
    filename: '',
    path: '',
  };
}

describe('Persisted USER_IMPORT preview', () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const repository = { createQueryBuilder: jest.fn(() => query) };
  const bulk = {
    create: jest.fn<
      ReturnType<BulkOperationsService['create']>,
      Parameters<BulkOperationsService['create']>
    >(),
    update: jest.fn<
      ReturnType<BulkOperationsService['update']>,
      Parameters<BulkOperationsService['update']>
    >(),
    saveRows: jest.fn<
      ReturnType<BulkOperationsService['saveRows']>,
      Parameters<BulkOperationsService['saveRows']>
    >(),
    getById: jest.fn<
      ReturnType<BulkOperationsService['getById']>,
      Parameters<BulkOperationsService['getById']>
    >(),
    findRows: jest.fn<
      ReturnType<BulkOperationsService['findRows']>,
      Parameters<BulkOperationsService['findRows']>
    >(),
  };
  let operation: BulkOperation;
  let stored: BulkOperationRow[];
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    query.getMany.mockResolvedValue([]);
    operation = Object.assign(new BulkOperation(), {
      idBulkOperation: operationId,
      createdBy: { idUser: ownerId },
      type: BulkOperationType.USER_IMPORT,
      status: BulkOperationStatus.PENDING,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    });
    stored = [];
    bulk.create.mockReset().mockResolvedValue(operation);
    bulk.update.mockReset().mockImplementation((_id, _owner, dto) => {
      Object.assign(operation, dto);
      return Promise.resolve(operation);
    });
    bulk.saveRows.mockReset().mockImplementation((_id, _owner, inputs) => {
      stored = inputs.map((input) => Object.assign(new BulkOperationRow(), input));
      operation.totalRows = stored.length;
      operation.validRows = stored.filter((row) => row.valid).length;
      operation.invalidRows = stored.length - operation.validRows;
      return Promise.resolve(operation);
    });
    bulk.getById.mockReset().mockImplementation((id, owner) => {
      if (id !== operationId || owner !== ownerId) return Promise.reject(new NotFoundException());
      return Promise.resolve(operation);
    });
    bulk.findRows
      .mockReset()
      .mockImplementation((_id, _owner, { page = 1, limit = 25, valid } = {}) => {
        // In-memory repository double only; SQL generation is tested independently below.
        const selected = stored
          .filter((row) => valid === undefined || row.valid === valid)
          .sort((a, b) => a.rowNumber - b.rowNumber);
        return Promise.resolve({
          data: selected.slice((page - 1) * limit, page * limit),
          meta: {
            page,
            limit,
            total: selected.length,
            totalPages: Math.ceil(selected.length / limit),
          },
        });
      });
    service = new UsersService(
      repository as unknown as Repository<User>,
      {} as RolesService,
      bulk as unknown as BulkOperationsService,
    );
  });

  it('processes Excel once, persists all results without secrets and returns only page one', async () => {
    const file = await workbookFile(
      Array.from({ length: 61 }, (_, i) => [
        `Carlos ${i}`,
        'Quispe Flores',
        `900000${i}`,
        `99000${i}`,
        i === 60 ? 'invalid' : `student${i}@example.test`,
      ]),
    );
    const preview = await service.previewImport(file, ' student ', ownerId);
    expect(bulk.create).toHaveBeenCalledWith(
      {
        type: BulkOperationType.USER_IMPORT,
        metadata: { roleName: 'STUDENT', originalFileName: 'users.xlsx' },
      },
      ownerId,
    );
    expect(query.getMany).toHaveBeenCalledTimes(1);
    expect(bulk.saveRows).toHaveBeenCalledTimes(1);
    expect(stored).toHaveLength(61);
    expect(stored[60]).toMatchObject({
      rowNumber: 62,
      valid: false,
      errors: ['El email no es válido'],
    });
    expect(stored[0].data).toEqual({
      name: 'Carlos 0',
      lastname: 'Quispe Flores',
      ci: '9000000',
      ru: '990000',
      email: 'student0@example.test',
      username: '990000',
    });
    expect(JSON.stringify(stored)).not.toMatch(/password|hash|token|secret/i);
    expect(operation.status).toBe(BulkOperationStatus.READY);
    expect(bulk.update.mock.calls[0][2].status).toBe(BulkOperationStatus.PROCESSING);
    expect(bulk.update.mock.calls[0][2].startedAt).toBeInstanceOf(Date);
    expect(preview).toMatchObject({
      operationId,
      total: 61,
      valid: 60,
      invalid: 1,
      meta: { page: 1, limit: 25, total: 61, totalPages: 3 },
    });
    expect(preview.data).toHaveLength(25);
    expect(preview).not.toHaveProperty('rows');
    expect(bulk.findRows).toHaveBeenCalledWith(
      operationId,
      ownerId,
      { page: 1, limit: 25, valid: undefined },
      undefined,
    );
    const page2 = await service.getImportPreview(operationId, ownerId, {
      page: 2,
      limit: 25,
      status: 'all',
    });
    expect(page2.data[0].row).toBe(27);
    expect(page2.data).toHaveLength(25);
    expect(query.getMany).toHaveBeenCalledTimes(1);
    const invalid = await service.getImportPreview(operationId, ownerId, {
      page: 1,
      limit: 25,
      status: 'invalid',
    });
    expect(invalid).toMatchObject({
      total: 61,
      valid: 60,
      invalid: 1,
      meta: { total: 1, totalPages: 1 },
    });
    expect(invalid.data[0]).toMatchObject({
      row: 62,
      valid: false,
      errors: ['El email no es válido'],
    });
    const valid = await service.getImportPreview(operationId, ownerId, {
      page: 1,
      limit: 25,
      status: 'valid',
    });
    expect(valid.meta.total).toBe(60);
  });

  it.each([25, 50, 100])('passes limit %i to the generic SQL pagination', async (limit) => {
    operation.status = BulkOperationStatus.READY;
    await service.getImportPreview(operationId, ownerId, { page: 2, limit, status: 'all' });
    expect(bulk.findRows).toHaveBeenCalledWith(
      operationId,
      ownerId,
      { page: 2, limit, valid: undefined },
      undefined,
    );
  });

  it.each(['Carlos', 'Quispe', '900000001', '99000001', 'student@example.test', 'username'])(
    'passes search %s as a domain condition',
    async (search) => {
      operation.status = BulkOperationStatus.READY;
      await service.getImportPreview(operationId, ownerId, {
        page: 1,
        limit: 25,
        status: 'all',
        search,
      });
      expect(bulk.findRows.mock.calls[0][3]).toBeDefined();
    },
  );

  it.each([
    ['STUDENT', '987654', '987654'],
    ['ASSISTANT', '987654', '987654'],
    ['TEACHER', '', '1234567'],
    ['DIRECTOR', '987654', '1234567'],
    ['DEAN', '', '1234567'],
  ])('preserves normalized preview credential rules for %s', async (roleName, ru, username) => {
    const preview = await service.previewImport(
      await workbookFile([['Ana', 'Perez', '1234567', ru, 'ANA@example.test']]),
      roleName,
      ownerId,
    );
    expect(preview.data[0]).toMatchObject({
      username,
      email: 'ana@example.test',
      ru,
      valid: true,
      errors: [],
    });
  });

  it('preserves required fields, required RU, Excel duplicates and DB conflicts', async () => {
    query.getMany.mockResolvedValueOnce([
      { ci: '1', ru: '2', email: 'ana@example.test', username: '2' },
    ]);
    const file = await workbookFile([
      ['', '', '1', '2', 'ANA@example.test'],
      ['Ana', 'Perez', '1', '2', 'ANA@example.test'],
      ['Luis', 'Flores', '', '', 'invalid'],
    ]);
    const preview = await service.previewImport(file, 'STUDENT', ownerId);
    expect(preview.invalid).toBe(3);
    expect(preview.data[0].errors).toEqual(
      expect.arrayContaining([
        'Los nombres son obligatorios',
        'Los apellidos son obligatorios',
        'El CI está duplicado dentro del archivo',
        'El RU está duplicado dentro del archivo',
        'El email está duplicado dentro del archivo',
        'Ya existe un usuario con este CI',
        'Ya existe un usuario con este RU',
        'Ya existe un usuario con este email',
        'Ya existe un usuario con este username',
      ]),
    );
    expect(preview.data[2].errors).toEqual(
      expect.arrayContaining([
        'El CI es obligatorio',
        'El email no es válido',
        'El RU es obligatorio para usuarios con rol STUDENT',
      ]),
    );
  });

  it.each(['ADMIN', 'SUPERADMIN'])(
    'rejects forbidden role %s before creating an operation',
    async (role) => {
      await expect(
        service.previewImport(
          await workbookFile([['Ana', 'Perez', '1', '2', 'ana@example.test']]),
          role,
          ownerId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bulk.create).not.toHaveBeenCalled();
    },
  );

  it('marks a header validation failure FAILED and preserves the original error', async () => {
    const file = await workbookFile([['Ana']], ['Bad header']);
    await expect(service.previewImport(file, 'STUDENT', ownerId)).rejects.toThrow(
      'El formato del archivo Excel no es válido',
    );
    expect(operation.status).toBe(BulkOperationStatus.FAILED);
    expect(bulk.saveRows).not.toHaveBeenCalled();
  });

  it('marks a persistence error FAILED without replacing it if the status write also fails', async () => {
    const error = new Error('Persistence failed');
    bulk.saveRows.mockRejectedValueOnce(error);
    bulk.update.mockImplementation((_id, _owner, dto) =>
      dto.status === BulkOperationStatus.FAILED
        ? Promise.reject(new Error('DB unavailable'))
        : Promise.resolve(operation),
    );
    await expect(
      service.previewImport(
        await workbookFile([['Ana', 'Perez', '1', '2', 'ana@example.test']]),
        'STUDENT',
        ownerId,
      ),
    ).rejects.toBe(error);
    expect(bulk.update).toHaveBeenCalledWith(operationId, ownerId, {
      status: BulkOperationStatus.FAILED,
    });
  });

  it('rejects non-xlsx and oversized/empty files before creating operations', async () => {
    const file = await workbookFile([]);
    await expect(
      service.previewImport({ ...file, originalname: 'users.csv' }, 'STUDENT', ownerId),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewImport({ ...file, buffer: Buffer.alloc(0) }, 'STUDENT', ownerId),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.previewImport(
        { ...file, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
        'STUDENT',
        ownerId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bulk.create).not.toHaveBeenCalled();
  });

  it('rejects foreign and nonexistent operations before consulting rows', async () => {
    await expect(service.getImportPreview(operationId, ownerId + 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.getImportPreview('11111111-1111-4111-8111-111111111111', ownerId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(bulk.findRows).not.toHaveBeenCalled();
  });

  it('rejects other operation types and previews that are not READY', async () => {
    operation.type = 'COURSE_ENROLLMENT' as BulkOperationType; // Future type fixture, not a schema change.
    await expect(service.getImportPreview(operationId, ownerId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    operation.type = BulkOperationType.USER_IMPORT;
    await expect(service.getImportPreview(operationId, ownerId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(bulk.findRows).not.toHaveBeenCalled();
  });
});

class MetadataDataSource extends DataSource {
  async prepareMetadata() {
    await this.buildMetadatas();
  }
}

describe('USER_IMPORT search through the generic SQL primitive', () => {
  const source = new MetadataDataSource({
    type: 'postgres',
    entities: [__dirname + '/../../entities/**/*.entity.ts'],
  });
  beforeAll(async () => source.prepareMetadata());

  it.each([
    'Carlos',
    'Quispe',
    '900000001',
    '99000001',
    'student@example.test',
    'Carlos Quispe',
    "x%' OR 1=1 --",
  ])(
    'generates parameterized JSONB ILIKE for %s without losing ownership/limit',
    async (search) => {
      const operations = source.getRepository(BulkOperation);
      const rows = source.getRepository(BulkOperationRow);
      const builder = rows.createQueryBuilder('row');
      const sqlResult = jest.spyOn(builder, 'getManyAndCount').mockResolvedValue([[], 0]);
      const createBuilder = jest.spyOn(rows, 'createQueryBuilder').mockReturnValue(builder);
      const findOne = jest
        .spyOn(operations, 'findOne')
        .mockResolvedValue(Object.assign(new BulkOperation(), { idBulkOperation: operationId }));
      try {
        await new BulkOperationsService(operations, rows).findRows(
          operationId,
          ownerId,
          { page: 2, limit: 25, valid: false },
          userImportSearchCondition(search),
        );
        expect(sqlResult).toHaveBeenCalledTimes(1);
        const [sql, parameters] = builder.getQueryAndParameters();
        for (const field of ['name', 'lastname', 'ci', 'ru', 'email', 'username'])
          expect(sql).toContain(`"data" ->> '${field}' ILIKE`);
        expect(sql).toContain('"operation"."created_by" = $2');
        expect(sql).toContain('"row"."valid" = $3 AND (');
        expect(sql).toContain('ORDER BY "row"."row_number" ASC LIMIT 25 OFFSET 25');
        expect(parameters).toEqual([
          operationId,
          ownerId,
          false,
          `%${search.replace(/[\\%_]/g, '\\$&')}%`,
        ]);
        expect(sql).not.toContain(search);
      } finally {
        sqlResult.mockRestore();
        createBuilder.mockRestore();
        findOne.mockRestore();
      }
    },
  );

  it('omits a blank search condition', () => {
    expect(userImportSearchCondition('  ')).toBeUndefined();
  });
});

describe('User preview query validation', () => {
  const pipe = createValidationPipe();
  const metadata = { type: 'query' as const, metatype: UserImportPreviewQueryDto };
  it('transforms page/limit and keeps defaults, stripping a forged ownerId', async () => {
    await expect(
      pipe.transform({ page: '2', limit: '50', ownerId: 999 }, metadata),
    ).resolves.toMatchObject({ page: 2, limit: 50, status: 'all' });
    const result: unknown = await pipe.transform({ ownerId: 999 }, metadata);
    expect(result).not.toHaveProperty('ownerId');
  });
  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 101 },
    { limit: 20 },
    { status: 'FAILED' },
    { search: 'x'.repeat(201) },
  ])('rejects invalid query %j', async (query) => {
    await expect(pipe.transform(query, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});
