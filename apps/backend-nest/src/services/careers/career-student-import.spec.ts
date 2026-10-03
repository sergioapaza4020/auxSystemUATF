import { Readable } from 'node:stream';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { Career } from 'src/entities/careers/careers.entity';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { CareerStudentImportService } from './career-student-import.service';

const student = (id: number) =>
  Object.assign(new User(), {
    idUser: id,
    ru: String(id),
    username: String(id),
    name: 'Ana',
    lastname: 'Perez',
    email: `student${id}@example.com`,
    isActive: true,
    deletedAt: null,
    roles: [
      Object.assign(new Role(), { idRole: 1, name: 'STUDENT', isActive: true, deletedAt: null }),
    ],
  });

async function excel(values: ExcelJS.CellValue[]): Promise<Express.Multer.File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Estudiantes');
  sheet.addRow(['RU']);
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

interface ReadQueryMock {
  withDeleted: jest.Mock<ReadQueryMock, []>;
  leftJoinAndSelect: jest.Mock<ReadQueryMock, [string, string]>;
  select: jest.Mock<ReadQueryMock, [string[]]>;
  where: jest.Mock<ReadQueryMock, [string, { rus: string[] }]>;
  getMany: jest.Mock<Promise<User[]>, []>;
}

interface UpdateQueryMock {
  update: jest.Mock<UpdateQueryMock, [typeof User]>;
  set: jest.Mock<UpdateQueryMock, [{ careers: { idCareer: number }; updatedBy: number }]>;
  where: jest.Mock<UpdateQueryMock, [string, { ids: number[] }]>;
  andWhere: jest.Mock<UpdateQueryMock, [string]>;
  execute: jest.Mock<Promise<{ affected: number }>, []>;
}

async function setup(users: User[] = [student(1), student(2)]) {
  let lookup: string[] = [];
  const readQuery: ReadQueryMock = {
    withDeleted: jest.fn<ReadQueryMock, []>().mockReturnThis(),
    leftJoinAndSelect: jest.fn<ReadQueryMock, [string, string]>().mockReturnThis(),
    select: jest.fn<ReadQueryMock, [string[]]>().mockReturnThis(),
    where: jest.fn((_sql: string, params: { rus: string[] }) => {
      lookup = params.rus;
      return readQuery;
    }),
    getMany: jest.fn(() => Promise.resolve(users.filter((user) => lookup.includes(user.ru ?? '')))),
  };
  let ids: number[] = [];
  let destination = 0;
  let pending = new Map<number, number>();
  const committed = new Map<number, number>();
  const updateQuery: UpdateQueryMock = {
    update: jest.fn<UpdateQueryMock, [typeof User]>().mockReturnThis(),
    set: jest.fn((value: { careers: { idCareer: number }; updatedBy: number }) => {
      destination = value.careers.idCareer;
      return updateQuery;
    }),
    where: jest.fn((_sql: string, params: { ids: number[] }) => {
      ids = params.ids;
      return updateQuery;
    }),
    andWhere: jest.fn<UpdateQueryMock, [string]>().mockReturnThis(),
    execute: jest.fn(() => {
      for (const id of ids) pending.set(id, destination);
      return Promise.resolve({ affected: ids.length });
    }),
  };
  const userRepository = {
    createQueryBuilder: jest.fn((alias?: string) => (alias ? readQuery : updateQuery)),
  };
  const careerRepository = {
    findOneBy: jest.fn().mockResolvedValue({ idCareer: 10, name: 'Informática', isActive: true }),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Career ? careerRepository : userRepository,
    ),
  };
  const transaction = jest.fn(
    async (_isolation: string, work: (value: typeof manager) => Promise<unknown>) => {
      pending = new Map(committed);
      try {
        const result = await work(manager);
        for (const [id, career] of pending) committed.set(id, career);
        return result;
      } finally {
        pending.clear();
      }
    },
  );
  const module = await Test.createTestingModule({
    providers: [
      CareerStudentImportService,
      { provide: getRepositoryToken(Career), useValue: { manager: { ...manager, transaction } } },
    ],
  }).compile();
  const service = module.get(CareerStudentImportService);
  await module.close();
  return { service, readQuery, updateQuery, transaction, careerRepository, committed };
}

describe('Career student import', () => {
  it('creates a valid RU-only workbook with no real records', async () => {
    const ctx = await setup();
    const buffer = await ctx.service.template(10);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(buffer).buffer);
    expect(workbook.worksheets[0].getCell('A1').value).toBe('RU');
    expect(workbook.worksheets[0].rowCount).toBe(1);
    expect(ctx.updateQuery.execute).not.toHaveBeenCalled();
  });
  it('previews valid existing students without writing and keeps real Excel rows', async () => {
    const ctx = await setup();
    const preview = await ctx.service.preview(await excel([1, ' 2 ']), 10);
    expect(preview).toMatchObject({ total: 2, valid: 2, invalid: 0 });
    expect(preview.rows[0]).toMatchObject({
      row: 2,
      studentId: 1,
      currentCareer: null,
      status: 'VALID',
    });
    expect(ctx.updateQuery.execute).not.toHaveBeenCalled();
    expect(ctx.transaction).not.toHaveBeenCalled();
  });
  it('accumulates duplicate, nonexistent, inactive and non-student errors', async () => {
    const user = student(1);
    user.isActive = false;
    user.roles = [];
    const ctx = await setup([user]);
    const preview = await ctx.service.preview(await excel(['1', '1', '404']), 10);
    expect(preview.invalid).toBe(3);
    expect(preview.rows[0].errors).toHaveLength(3);
    expect(preview.rows[2]).toMatchObject({
      studentId: null,
      errors: ['No existe un estudiante con este RU'],
    });
  });
  it.each([10, 20])(
    'blocks an existing career %s without reassigning, even if that career was soft-deleted',
    async (idCareer) => {
      const user = student(1);
      user.careers = Object.assign(new Career(), {
        idCareer,
        name: 'Ingeniería Civil',
        deletedAt: new Date(),
      });
      const ctx = await setup([user]);
      const file = await excel(['1']);
      const preview = await ctx.service.preview(file, 10);
      expect(preview.invalid).toBe(1);
      expect(preview.rows[0].currentCareer).toEqual({ idCareer, name: 'Ingeniería Civil' });
      expect(preview.rows[0].errors[0]).toContain(
        idCareer === 10 ? 'carrera destino' : 'Ingeniería Civil',
      );
      await expect(ctx.service.import(file, 10, 99)).rejects.toThrow(BadRequestException);
      expect(ctx.updateQuery.execute).not.toHaveBeenCalled();
      expect(ctx.readQuery.withDeleted).toHaveBeenCalled();
    },
  );
  it('rejects a nonexistent or inactive destination', async () => {
    const ctx = await setup();
    ctx.careerRepository.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ isActive: false });
    await expect(ctx.service.template(10)).rejects.toThrow(NotFoundException);
    await expect(ctx.service.preview(await excel(['1']), 10)).rejects.toThrow(BadRequestException);
  });
  it('one invalid row blocks every assignment', async () => {
    const ctx = await setup();
    await expect(ctx.service.import(await excel(['1', '404']), 10, 99)).rejects.toThrow(
      BadRequestException,
    );
    expect(ctx.updateQuery.execute).not.toHaveBeenCalled();
    expect(ctx.committed.size).toBe(0);
  });
  it('revalidates current career after preview', async () => {
    const user = student(1);
    const ctx = await setup([user]);
    const file = await excel(['1']);
    expect((await ctx.service.preview(file, 10)).invalid).toBe(0);
    user.careers = Object.assign(new Career(), { idCareer: 20, name: 'Civil' });
    await expect(ctx.service.import(file, 10, 99)).rejects.toThrow(BadRequestException);
    expect(ctx.committed.size).toBe(0);
  });
  it('assigns every student in one transaction, updating only the relation and audit fields', async () => {
    const ctx = await setup();
    expect(await ctx.service.import(await excel(['1', '2']), 10, 99)).toEqual({
      imported: 2,
      total: 2,
      careerId: 10,
    });
    expect([...ctx.committed]).toEqual([
      [1, 10],
      [2, 10],
    ]);
    expect(ctx.transaction).toHaveBeenCalledWith('SERIALIZABLE', expect.any(Function));
    expect(ctx.updateQuery.set).toHaveBeenCalledWith({ careers: { idCareer: 10 }, updatedBy: 99 });
    expect(ctx.updateQuery.andWhere).toHaveBeenCalledWith('careers IS NULL');
  });
  it('rolls back the first batch when the second fails, using batched lookups', async () => {
    const users = Array.from({ length: 501 }, (_, index) => student(index + 1));
    const ctx = await setup(users);
    const execute = ctx.updateQuery.execute.getMockImplementation();
    if (!execute) throw new Error('Missing test implementation');
    ctx.updateQuery.execute
      .mockImplementationOnce(execute)
      .mockRejectedValueOnce(new Error('secret DB detail'));
    await expect(
      ctx.service.import(await excel(users.map((user) => user.ru ?? '')), 10, 99),
    ).rejects.toThrow(InternalServerErrorException);
    expect(ctx.readQuery.getMany).toHaveBeenCalledTimes(2);
    expect(ctx.updateQuery.execute).toHaveBeenCalledTimes(2);
    expect(ctx.committed.size).toBe(0);
  });
  it('rejects an affected-row mismatch instead of reporting partial success', async () => {
    const ctx = await setup();
    ctx.updateQuery.execute.mockResolvedValueOnce({ affected: 1 });
    await expect(ctx.service.import(await excel(['1', '2']), 10, 99)).rejects.toThrow(
      ConflictException,
    );
    expect(ctx.committed.size).toBe(0);
  });
  it.each(['23505', '23503', '40001', '40P01'])(
    'maps database conflict %s without leaking SQL',
    async (code) => {
      const ctx = await setup();
      ctx.updateQuery.execute.mockRejectedValueOnce({ code, detail: 'secret SQL' });
      await expect(ctx.service.import(await excel(['1']), 10, 99)).rejects.toThrow(
        ConflictException,
      );
      expect(ctx.committed.size).toBe(0);
    },
  );
});

class MetadataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}

describe('Career assignment SQL mapping', () => {
  it('uses the existing single nullable FK and never updates personal fields', async () => {
    const source = new MetadataSource({
      type: 'postgres',
      entities: [__dirname + '/../../entities/**/*.entity.ts'],
    });
    await source.prepare();
    const relation = source.getMetadata(User).findRelationWithPropertyPath('careers');
    expect(relation?.isManyToOne).toBe(true);
    expect(relation?.isNullable).toBe(true);
    const [sql, parameters] = source
      .getRepository(User)
      .createQueryBuilder()
      .update(User)
      .set({ careers: { idCareer: 10 }, updatedBy: 99 })
      .where('id_user IN (:...ids)', { ids: [1, 2] })
      .andWhere('careers IS NULL')
      .andWhere('is_active = true')
      .andWhere('deleted_at IS NULL')
      .getQueryAndParameters();
    expect(sql).toContain('"careers" = $1');
    expect(sql).toContain('"careers" IS NULL');
    expect(sql).not.toMatch(/"(?:name|email|password|ru)"\s*=/);
    expect(parameters).toEqual([10, 99, 1, 2]);
  });
});
