import * as bcrypt from 'bcrypt';
import { bulkImportMock } from '@common/test-mocks/bulk-import.mock';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { EntityManager, QueryFailedError } from 'typeorm';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { EnrollmentImportController } from 'src/controllers/enrollments/enrollment-import.controller';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { Semester } from 'src/entities/semesters/semester.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { EnrollmentImportService } from './enrollment-import.service';
import {
  createEnrollmentImportTemplate,
  ENROLLMENT_IMPORT_MAX_BYTES,
  parseEnrollmentImport,
} from './enrollment-import-excel';

const actor: JwtPayload = {
  idUser: 99,
  idSession: 1,
  username: 'admin',
  email: 'admin@example.com',
  roles: ['ADMIN'],
  permissions: ['enrollment.create'],
};
const target = { courseId: 10, semesterId: 20 };
const student = (id: number, ru = String(id)) =>
  Object.assign(new User(), {
    idUser: id,
    ru,
    ci: `CI${id}`,
    name: 'Ana',
    lastname: 'Perez',
    username: ru,
    email: `student${id}@example.com`,
    isActive: true,
    deletedAt: null,
    roles: [
      Object.assign(new Role(), { idRole: 1, name: 'STUDENT', isActive: true, deletedAt: null }),
    ],
  });

async function excel(values: ExcelJS.CellValue[], header = 'RU'): Promise<Express.Multer.File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Estudiantes');
  sheet.addRow([header]);
  for (const value of values) sheet.addRow([value]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    fieldname: 'file',
    originalname: 'students.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.length,
    buffer,
    encoding: '7bit',
    stream: Readable.from(buffer),
    destination: '',
    filename: '',
    path: '',
  };
}

const headersFrom = (sheet: ExcelJS.Worksheet) =>
  [1, 2, 3, 4, 5].map((column) => sheet.getCell(1, column).value);

describe('Enrollment import Excel', () => {
  it('creates an actual workbook with one RU header, text formatting and no student data', async () => {
    const template = await createEnrollmentImportTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(template).buffer);
    expect(headersFrom(workbook.worksheets[0])).toEqual([
      'Nombres',
      'Apellidos',
      'CI',
      'RU',
      'Email',
    ]);
    expect(workbook.worksheets[0].rowCount).toBe(1);
    expect(workbook.worksheets[0].getColumn(1).numFmt).toBe('@');
  });
  it('handles numeric and text RU, keeps leading zeros and real row numbers including empty rows', async () => {
    const rows = await parseEnrollmentImport(await excel([123, null, ' 00123 ']));
    expect(rows.map((row) => [row.row, row.ru])).toEqual([
      [2, '123'],
      [3, ''],
      [4, '00123'],
    ]);
    expect(rows[1].errors).toContain('La fila está vacía');
  });
  it('rejects formulas and unsafe numbers rather than interpreting identifiers', async () => {
    const rows = await parseEnrollmentImport(
      await excel([{ formula: '1+1', result: 2 }, 1.5, new Date(), Number.MAX_SAFE_INTEGER + 1]),
    );
    expect(rows.every((row) => row.errors.length > 0)).toBe(true);
  });
  it('rejects missing, oversized, wrong extension/MIME, corrupt and header-only workbooks', async () => {
    const file = await excel(['1']);
    await expect(parseEnrollmentImport(undefined)).rejects.toThrow(BadRequestException);
    await expect(
      parseEnrollmentImport({ ...file, size: ENROLLMENT_IMPORT_MAX_BYTES + 1 }),
    ).rejects.toThrow(PayloadTooLargeException);
    await expect(parseEnrollmentImport({ ...file, originalname: 'a.csv' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(parseEnrollmentImport({ ...file, mimetype: 'text/csv' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      parseEnrollmentImport({ ...file, buffer: Buffer.from('not an excel') }),
    ).rejects.toThrow(BadRequestException);
    await expect(parseEnrollmentImport(await excel(['1'], 'CI'))).rejects.toThrow(
      BadRequestException,
    );
    await expect(parseEnrollmentImport(await excel([]))).rejects.toThrow(BadRequestException);
  });
});

describe('Enrollment import service', () => {
  async function setup(users: User[] = [student(1), student(2)]) {
    const userQuery = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(users),
    };
    let pendingUsers: User[] = [];
    const committedUsers: User[] = [];
    const userRepository = {
      createQueryBuilder: jest.fn(() => userQuery),
      create: jest.fn((value: Partial<User>) => Object.assign(new User(), value)),
      save: jest.fn((value: User) => {
        const saved = Object.assign(new User(), value, { idUser: 10000 + pendingUsers.length });
        pendingUsers.push(saved);
        return Promise.resolve(saved);
      }),
    };
    const roleRepository = {
      findOneBy: jest
        .fn()
        .mockResolvedValue(
          Object.assign(new Role(), { idRole: 1, name: 'STUDENT', isActive: true }),
        ),
    };
    const courseRepository = {
      findOneBy: jest.fn().mockResolvedValue({ idCourse: 10, isActive: true }),
    };
    const semesterRepository = {
      findOneBy: jest.fn().mockResolvedValue({ idSemester: 20, isActive: true }),
    };
    let pending: unknown[] = [];
    const committed: unknown[] = [];
    const enrollmentRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(null),
      insert: jest.fn((values: unknown[]) => {
        pending.push(...values);
        return Promise.resolve({});
      }),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Course) return courseRepository;
        if (entity === Semester) return semesterRepository;
        if (entity === User) return userRepository;
        if (entity === Role) return roleRepository;
        return enrollmentRepository;
      }),
    };
    const transaction = jest.fn(
      async (_isolation: string, work: (value: typeof manager) => Promise<unknown>) => {
        pending = [];
        pendingUsers = [];
        try {
          const result = await work(manager);
          committed.push(...pending);
          committedUsers.push(...pendingUsers);
          users.push(...pendingUsers);
          return result;
        } finally {
          pending = [];
          pendingUsers = [];
        }
      },
    );
    const stored = bulkImportMock((work) =>
      transaction('SERIALIZABLE', (manager) => work(manager as unknown as EntityManager)),
    );
    const module = await Test.createTestingModule({
      providers: [
        EnrollmentImportService,
        { provide: BulkOperationsService, useValue: stored.bulk },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { manager: { ...manager, transaction } },
        },
      ],
    }).compile();
    const service = module.get(EnrollmentImportService);
    await module.close();
    return {
      service,
      ...stored,
      userQuery,
      userRepository,
      roleRepository,
      committedUsers,
      enrollmentRepository,
      courseRepository,
      semesterRepository,
      transaction,
      committed,
    };
  }

  async function executeFile(
    ctx: Awaited<ReturnType<typeof setup>>,
    file: Express.Multer.File,
    author = actor,
  ) {
    const preview = await ctx.service.preview(file, target, author);
    ctx.userQuery.getMany.mockClear();
    ctx.enrollmentRepository.find.mockClear();
    return ctx.service.import(preview.operationId, author);
  }

  it('previews valid students without writes or a transaction', async () => {
    const ctx = await setup();
    const preview = await ctx.service.preview(await excel(['1', 2]), target, actor);
    expect(preview).toMatchObject({ total: 2, valid: 2, invalid: 0 });
    expect(preview.data[0]).toMatchObject({
      row: 2,
      studentId: 1,
      fullName: 'Ana Perez',
      status: 'VALID',
    });
    expect(ctx.enrollmentRepository.insert).not.toHaveBeenCalled();
    expect(ctx.transaction).not.toHaveBeenCalled();
  });
  it('reports all relevant errors for missing, duplicated, inactive, non-student and already enrolled users', async () => {
    const user = student(1);
    user.isActive = false;
    user.roles = [];
    const ctx = await setup([user]);
    ctx.enrollmentRepository.find.mockResolvedValue([{ user }]);
    const result = await ctx.service.preview(await excel(['1', '1', '404']), target, actor);
    expect(result.invalid).toBe(3);
    expect(result.data[0].errors).toHaveLength(4);
    expect(result.data[2]).toMatchObject({
      studentId: null,
      action: 'ERROR',
    });
    expect(ctx.enrollmentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ withDeleted: true }),
    );
  });
  it('blocks the complete import if a single row is invalid', async () => {
    const ctx = await setup();
    await expect(executeFile(ctx, await excel(['1', '404']), actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(ctx.enrollmentRepository.insert).not.toHaveBeenCalled();
    expect(ctx.committed).toHaveLength(0);
  });
  it('revalidates after preview and skips a newly existing active student enrollment', async () => {
    const ctx = await setup();
    const preview = await ctx.service.preview(await excel(['1']), target, actor);
    ctx.enrollmentRepository.find.mockResolvedValue([
      { user: student(1), isActive: true, role: 'STUDENT', deletedAt: null },
    ]);
    await expect(ctx.service.import(preview.operationId, actor)).resolves.toMatchObject({
      imported: 0,
      skipped: 1,
    });
    expect(ctx.committed).toHaveLength(0);
  });
  it('persists all rows but returns 25, with stable remote pages, global counters and validity filters', async () => {
    const users = Array.from({ length: 60 }, (_, index) => student(index + 1));
    const ctx = await setup(users);
    const preview = await ctx.service.preview(
      await excel(users.map((user) => user.ru ?? '')),
      target,
      actor,
    );
    expect(preview.data).toHaveLength(25);
    expect(preview.meta).toEqual({ page: 1, limit: 25, total: 60, totalPages: 3 });
    expect(ctx.rows.get(preview.operationId)).toHaveLength(60);
    const second = await ctx.service.getPreview(preview.operationId, actor, {
      page: 2,
      limit: 25,
      status: 'valid',
    });
    expect(second.data.map((row) => row.row)).toEqual(Array.from({ length: 25 }, (_, i) => i + 27));
    expect(second.total).toBe(60);
    expect(second.meta.total).toBe(60);
    expect(second.data.some((row) => preview.data.some((first) => row.row === first.row))).toBe(
      false,
    );
    expect(
      (
        await ctx.service.getPreview(preview.operationId, actor, {
          page: 1,
          limit: 25,
          status: 'invalid',
        })
      ).meta.total,
    ).toBe(0);
  });
  it('rejects another owner, missing operations and repeated execution; uses the saved context', async () => {
    const ctx = await setup();
    const preview = await ctx.service.preview(await excel(['1']), target, actor);
    await expect(
      ctx.service.getPreview(preview.operationId, { ...actor, idUser: 1 }),
    ).rejects.toThrow(NotFoundException);
    await expect(ctx.service.import(preview.operationId, { ...actor, idUser: 1 })).rejects.toThrow(
      NotFoundException,
    );
    await expect(ctx.service.status('00000000-0000-4000-8000-999999999999', actor)).rejects.toThrow(
      NotFoundException,
    );
    const result = await ctx.service.import(preview.operationId, actor);
    expect(result).toMatchObject(target);
    await expect(ctx.service.import(preview.operationId, actor)).resolves.toEqual(result);
    expect((await ctx.service.status(preview.operationId, actor)).imported).toBe(1);
  });
  it('creates all enrollments with fixed STUDENT role and actor audit data', async () => {
    const ctx = await setup();
    expect(await executeFile(ctx, await excel(['1', '2']), actor)).toEqual({
      total: 2,
      imported: 2,
      accountsCreated: 0,
      accountsReused: 2,
      skipped: 0,
      errors: 0,
      ...target,
    });
    expect(ctx.transaction).toHaveBeenCalledWith('SERIALIZABLE', expect.any(Function));
    expect(ctx.committed).toEqual(
      [1, 2].map((idUser) => ({
        user: { idUser },
        course: { idCourse: 10 },
        semester: { idSemester: 20 },
        role: 'STUDENT',
        createdBy: 99,
      })),
    );
  });
  it('batches lookups and rolls back the first batch when the second insert fails', async () => {
    const users = Array.from({ length: 501 }, (_, index) => student(index + 1));
    const ctx = await setup(users);
    const insert = ctx.enrollmentRepository.insert.getMockImplementation();
    if (!insert) throw new Error('Missing insert test implementation');
    ctx.enrollmentRepository.insert
      .mockImplementationOnce(insert)
      .mockRejectedValueOnce(new Error('internal DB detail'));
    await expect(
      executeFile(ctx, await excel(users.map((user) => user.ru ?? '')), actor),
    ).rejects.toThrow(InternalServerErrorException);
    expect(ctx.userQuery.getMany).toHaveBeenCalledTimes(2);
    expect(ctx.enrollmentRepository.find).toHaveBeenCalledTimes(2);
    expect(ctx.enrollmentRepository.insert).toHaveBeenCalledTimes(2);
    expect(ctx.committed).toHaveLength(0);
  });
  it.each(['23505', '40001', '40P01'])(
    'maps concurrent conflict %s to a safe exception',
    async (code) => {
      const ctx = await setup();
      ctx.enrollmentRepository.insert.mockRejectedValue({ code, detail: 'secret SQL' });
      await expect(executeFile(ctx, await excel(['1']), actor)).rejects.toThrow(ConflictException);
      expect(ctx.committed).toHaveLength(0);
    },
  );
  it('rejects missing/inactive destinations', async () => {
    const ctx = await setup();
    ctx.courseRepository.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ isActive: false });
    const file = await excel(['1']);
    await expect(ctx.service.preview(file, target, actor)).rejects.toThrow(NotFoundException);
    await expect(ctx.service.preview(file, target, actor)).rejects.toThrow(BadRequestException);
    ctx.semesterRepository.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ isActive: false });
    await expect(ctx.service.preview(file, target, actor)).rejects.toThrow(NotFoundException);
    await expect(ctx.service.preview(file, target, actor)).rejects.toThrow(BadRequestException);
  });
  it('requires an active assistant enrollment for the selected course and semester, preserving SUPERADMIN bypass', async () => {
    const ctx = await setup();
    const assistant = { ...actor, roles: ['ASSISTANT'] };
    await expect(ctx.service.template(target, assistant)).rejects.toThrow(ForbiddenException);
    ctx.enrollmentRepository.findOneBy.mockResolvedValueOnce({ idEnrollment: 100 });
    await expect(ctx.service.template(target, assistant)).resolves.toBeInstanceOf(Buffer);
    expect(ctx.enrollmentRepository.findOneBy).toHaveBeenCalledWith({
      user: { idUser: 99 },
      course: { idCourse: 10 },
      semester: { idSemester: 20 },
      role: 'ASSISTANT',
      isActive: true,
    });
    await expect(
      ctx.service.template(target, { ...assistant, roles: ['ASSISTANT', 'SUPERADMIN'] }),
    ).resolves.toBeInstanceOf(Buffer);
  });
  async function fullExcel(rows: ExcelJS.CellValue[][]) {
    const file = await excel([]);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Estudiantes');
    sheet.addRow(['Nombres', 'Apellidos', 'CI', 'RU', 'Email']);
    rows.forEach((row) => sheet.addRow(row));
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { ...file, buffer, size: buffer.length };
  }
  const newRow = ['Nueva', 'Estudiante', '00111', '00999', 'nueva@example.com'];
  it('creates only new accounts and matriculates mixed rows; preserves existing credentials and skips active enrollments', async () => {
    const existing = student(1);
    existing.username = 'custom-name';
    existing.password = 'existing-password-hash';
    const ctx = await setup([existing, student(2)]);
    ctx.enrollmentRepository.find.mockResolvedValue([
      { user: student(2), isActive: true, role: 'STUDENT', deletedAt: null },
    ]);
    const file = await fullExcel([newRow, ['', '', '', '1', ''], ['', '', '', '2', '']]);
    const preview = await ctx.service.preview(file, target, actor);
    expect(preview).toMatchObject({
      valid: 3,
      invalid: 0,
      newAccounts: 1,
      existingAccounts: 1,
      skipped: 1,
    });
    expect(preview.data.map((row) => row.action)).toEqual(['CREATE_ACCOUNT', 'ENROLL', 'SKIP']);
    expect(JSON.stringify(preview)).not.toContain('00111');
    expect(ctx.userRepository.save).not.toHaveBeenCalled();
    expect(ctx.enrollmentRepository.insert).not.toHaveBeenCalled();
    const result = await ctx.service.import(preview.operationId, actor);
    expect(result).toMatchObject({
      accountsCreated: 1,
      accountsReused: 1,
      imported: 2,
      skipped: 1,
      errors: 0,
    });
    expect(ctx.committedUsers).toHaveLength(1);
    const created = ctx.committedUsers[0];
    expect(created.username).toBe('00999');
    expect(created.password).not.toBe('00111');
    expect(await bcrypt.compare('00111', created.password)).toBe(true);
    expect(created.roles.map((role) => role.name)).toEqual(['STUDENT']);
    expect(created.createdBy).toBe(actor.idUser);
    expect(existing.username).toBe('custom-name');
    expect(existing.password).toBe('existing-password-hash');
    await expect(ctx.service.import(preview.operationId, actor)).resolves.toEqual(result);
    expect(ctx.committedUsers).toHaveLength(1);
  });
  it('rolls back new accounts as well as enrollments after an insertion failure', async () => {
    const ctx = await setup([]);
    const preview = await ctx.service.preview(await fullExcel([newRow]), target, actor);
    ctx.enrollmentRepository.insert.mockRejectedValue(new Error('database failure'));
    await expect(ctx.service.import(preview.operationId, actor)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(ctx.userRepository.save).toHaveBeenCalledTimes(1);
    expect(ctx.committedUsers).toHaveLength(0);
    expect(ctx.committed).toHaveLength(0);
  });
  it('reuses an account created after preview when its identity matches', async () => {
    const users: User[] = [];
    const ctx = await setup(users);
    const preview = await ctx.service.preview(await fullExcel([newRow]), target, actor);
    users.push(Object.assign(student(77, '00999'), { ci: '00111', email: 'nueva@example.com' }));
    const result = await ctx.service.import(preview.operationId, actor);
    expect(result).toMatchObject({ accountsCreated: 0, accountsReused: 1, imported: 1 });
    expect(ctx.userRepository.save).not.toHaveBeenCalled();
  });
  it.each(['ci', 'email', 'username'] as const)(
    'rejects a %s belonging to a different identity',
    async (field) => {
      const other = Object.assign(student(44), {
        [field]: field === 'ci' ? '00111' : field === 'email' ? 'nueva@example.com' : '00999',
      });
      const ctx = await setup([other]);
      const preview = await ctx.service.preview(await fullExcel([newRow]), target, actor);
      expect(preview.invalid).toBe(1);
      expect(preview.data[0].errors.join(' ')).toContain('otra identidad');
    },
  );
  it('rejects mismatched CI and duplicate RU/CI/email in the file without writes', async () => {
    const ctx = await setup([student(1)]);
    const preview = await ctx.service.preview(
      await fullExcel([['', '', 'wrong', '1', ''], newRow, newRow]),
      target,
      actor,
    );
    expect(preview.invalid).toBe(3);
    expect(preview.data[0].errors.join(' ')).toContain('CI no coincide');
    expect(preview.data[1].errors.join(' ')).toContain('RU está duplicado');
    expect(preview.data[1].errors.join(' ')).toContain('CI está duplicado');
    expect(preview.data[1].errors.join(' ')).toContain('email está duplicado');
    expect(ctx.userRepository.save).not.toHaveBeenCalled();
  });
  it.each([
    { isActive: false, role: 'STUDENT' },
    { isActive: true, role: 'ASSISTANT' },
    { isActive: true, role: 'STUDENT', deletedAt: new Date() },
  ])('does not reactivate or convert conflicting enrollment %j', async (flags) => {
    const ctx = await setup();
    ctx.enrollmentRepository.find.mockResolvedValue([{ user: student(1), ...flags }]);
    const preview = await ctx.service.preview(await excel(['1']), target, actor);
    expect(preview.invalid).toBe(1);
  });
  it('rechecks assistant ownership at confirmation and rejects a missing student role before creating accounts', async () => {
    const ctx = await setup([]);
    const assistant = { ...actor, roles: ['ASSISTANT'] };
    ctx.enrollmentRepository.findOneBy.mockResolvedValue({ idEnrollment: 99 });
    const preview = await ctx.service.preview(await fullExcel([newRow]), target, assistant);
    ctx.enrollmentRepository.findOneBy.mockResolvedValue(null);
    await expect(ctx.service.import(preview.operationId, assistant)).rejects.toThrow(
      ForbiddenException,
    );
    ctx.roleRepository.findOneBy.mockResolvedValue(null);
    await expect(ctx.service.import(preview.operationId, actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(ctx.userRepository.save).not.toHaveBeenCalled();
  });
  it('retries a serialization conflict with fresh state and bounded attempts', async () => {
    const ctx = await setup();
    ctx.enrollmentRepository.insert.mockRejectedValueOnce({ code: '40001' });
    const result = await executeFile(ctx, await excel(['1']), actor);
    expect(result.imported).toBe(1);
    expect(ctx.transaction).toHaveBeenCalledTimes(2);
    expect(ctx.committed).toHaveLength(1);
  });

  it('resolves a unique conflict by revalidating and reusing the concurrently created account', async () => {
    const users: User[] = [];
    const ctx = await setup(users);
    const preview = await ctx.service.preview(await fullExcel([newRow]), target, actor);
    ctx.enrollmentRepository.insert.mockImplementationOnce(() => {
      users.push(Object.assign(student(88, '00999'), { ci: '00111', email: 'nueva@example.com' }));
      throw Object.assign(new Error('Concurrent conflict'), { code: '23505' });
    });
    const result = await ctx.service.import(preview.operationId, actor);
    expect(result).toMatchObject({ accountsCreated: 0, accountsReused: 1, imported: 1 });
    expect(ctx.committedUsers).toHaveLength(0);
    expect(ctx.committed).toHaveLength(1);
  });
  it('validates all expanded columns without interpreting formulas, dates or extra columns', async () => {
    const file = await fullExcel([
      [{ formula: '1+1', result: 2 }, 'Apellido', new Date(), '0001', 'bad'],
      [...newRow, 'extra'],
    ]);
    const rows = await parseEnrollmentImport(file);
    expect(rows[0].errors).toHaveLength(2);
    expect(rows[1].errors.join(' ')).toContain('columnas adicionales');
    expect(rows[0].ru).toBe('0001');
  });

  it.each([
    {
      message: 'invalid input value for enum bulk_operations_type_enum: "ENROLLMENT_IMPORT"',
      status: 503,
    },
    { message: 'invalid input syntax for type uuid', status: 500 },
  ])('returns a safe HTTP $status for preview failure: $message', async ({ message, status }) => {
    const ctx = await setup();
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const driver = Object.assign(new Error(message), { code: '22P02' });
    ctx.bulk.create.mockRejectedValue(
      new QueryFailedError('INSERT INTO bulk_operations ...', ['private-value'], driver),
    );
    const module = await Test.createTestingModule({
      controllers: [EnrollmentImportController],
      providers: [{ provide: EnrollmentImportService, useValue: ctx.service }],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, { user: actor });
      next();
    });
    app.useGlobalGuards(new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    try {
      await app.init();
      const file = await excel(['1']);
      const response = await request(app.getHttpServer() as Server)
        .post('/api/enrollments/import/preview')
        .field('courseId', '10')
        .field('semesterId', '20')
        .attach('file', file.buffer, { filename: file.originalname, contentType: file.mimetype })
        .expect(status);
      expect(response.body).toMatchObject({
        status: false,
        statusCode: status,
        path: '/api/enrollments/import/preview',
      });
      expect(response.body).toHaveProperty(
        'message',
        status === 503
          ? 'La importación de matrículas no está habilitada en esta base de datos. El administrador debe aplicar la actualización pendiente de importaciones académicas.'
          : 'No se pudo procesar la importación. No se crearon cuentas ni matrículas.',
      );
      expect(JSON.stringify(response.body)).not.toMatch(/private-value|INSERT INTO|22P02/);
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'preview', code: '22P02' }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-value|INSERT INTO/);
      expect(ctx.userRepository.save).not.toHaveBeenCalled();
      expect(ctx.enrollmentRepository.insert).not.toHaveBeenCalled();
    } finally {
      await app.close();
      log.mockRestore();
    }
  });

  it('reports the same migration prerequisite at execution without losing transaction boundaries', async () => {
    const ctx = await setup();
    const preview = await ctx.service.preview(await excel(['1']), target, actor);
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    ctx.bulk.executeReady.mockRejectedValue(
      Object.assign(
        new Error('invalid input value for enum bulk_operations_type_enum: "ENROLLMENT_IMPORT"'),
        { code: '22P02' },
      ),
    );
    try {
      await expect(ctx.service.import(preview.operationId, actor)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'execute', code: '22P02' }),
      );
      expect(ctx.committed).toHaveLength(0);
    } finally {
      log.mockRestore();
    }
  });
});
