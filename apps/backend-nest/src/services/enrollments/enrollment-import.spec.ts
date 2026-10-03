import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
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

describe('Enrollment import Excel', () => {
  it('creates an actual workbook with one RU header, text formatting and no student data', async () => {
    const template = await createEnrollmentImportTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(template).buffer);
    expect(workbook.worksheets[0].getCell('A1').value).toBe('RU');
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
    const userRepository = { createQueryBuilder: jest.fn(() => userQuery) };
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
        return enrollmentRepository;
      }),
    };
    const transaction = jest.fn(
      async (_isolation: string, work: (value: typeof manager) => Promise<unknown>) => {
        pending = [];
        try {
          const result = await work(manager);
          committed.push(...pending);
          return result;
        } finally {
          pending = [];
        }
      },
    );
    const module = await Test.createTestingModule({
      providers: [
        EnrollmentImportService,
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
      userQuery,
      enrollmentRepository,
      courseRepository,
      semesterRepository,
      transaction,
      committed,
    };
  }

  it('previews valid students without writes or a transaction', async () => {
    const ctx = await setup();
    const preview = await ctx.service.preview(await excel(['1', 2]), target, actor);
    expect(preview).toMatchObject({ total: 2, valid: 2, invalid: 0 });
    expect(preview.rows[0]).toMatchObject({
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
    expect(result.rows[0].errors).toHaveLength(4);
    expect(result.rows[2]).toMatchObject({
      studentId: null,
      errors: ['No existe un estudiante con este RU'],
    });
    expect(ctx.enrollmentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ withDeleted: true }),
    );
  });
  it('blocks the complete import if a single row is invalid', async () => {
    const ctx = await setup();
    await expect(ctx.service.import(await excel(['1', '404']), target, actor)).rejects.toThrow(
      BadRequestException,
    );
    expect(ctx.enrollmentRepository.insert).not.toHaveBeenCalled();
    expect(ctx.committed).toHaveLength(0);
  });
  it('revalidates after preview and rejects a newly existing enrollment', async () => {
    const ctx = await setup();
    const file = await excel(['1']);
    expect((await ctx.service.preview(file, target, actor)).invalid).toBe(0);
    ctx.enrollmentRepository.find.mockResolvedValue([{ user: student(1) }]);
    await expect(ctx.service.import(file, target, actor)).rejects.toThrow(BadRequestException);
    expect(ctx.committed).toHaveLength(0);
  });
  it('creates all enrollments with fixed STUDENT role and actor audit data', async () => {
    const ctx = await setup();
    expect(await ctx.service.import(await excel(['1', '2']), target, actor)).toEqual({
      total: 2,
      imported: 2,
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
      ctx.service.import(await excel(users.map((user) => user.ru ?? '')), target, actor),
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
      await expect(ctx.service.import(await excel(['1']), target, actor)).rejects.toThrow(
        ConflictException,
      );
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
});
