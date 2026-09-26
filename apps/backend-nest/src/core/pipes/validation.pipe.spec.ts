import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from './validation.pipe';
import { LoginDto } from 'src/dtos/auth/login.dto';
import { UserQueryDto } from 'src/dtos/users/user-query.dto';
import { StatusQueryDto } from 'src/dtos/common/status-query.dto';
import { GradeSchemeCreateDto } from 'src/dtos/grade-schemes/grade-schemes.dto';
import { SemesterCreateDto } from 'src/dtos/semesters/semesters.dto';
import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import { FacultyCreateDto } from 'src/dtos/faculties/faculties.dto';

describe('HTTP validation', () => {
  const pipe = createValidationPipe();

  it('keeps login credentials and removes unknown properties', async () => {
    const result: unknown = await pipe.transform(
      { username: 'test', password: 'secret', isAdmin: true },
      { type: 'body', metatype: LoginDto },
    );
    expect(result).toEqual({ username: 'test', password: 'secret' });
    await expect(
      pipe.transform({ username: 'test' }, { type: 'body', metatype: LoginDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforms numeric query strings and comma-separated dynamic roles', async () => {
    const result: unknown = await pipe.transform(
      { page: '2', limit: '50', careerId: '3', role: 'STUDENT, CUSTOM', status: 'inactive' },
      { type: 'query', metatype: UserQueryDto },
    );
    expect(result).toEqual({
      page: 2,
      limit: 50,
      careerId: 3,
      role: ['STUDENT', 'CUSTOM'],
      status: 'inactive',
    });
  });

  it.each([
    { page: '0' },
    { limit: '101' },
    { careerId: 'bad' },
    { role: '' },
    { status: 'deleted' },
  ])('rejects invalid query %p', async (query) => {
    await expect(
      pipe.transform(query, { type: 'query', metatype: UserQueryDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('defaults administrative lists to active and accepts all states', async () => {
    expect(await pipe.transform({}, { type: 'query', metatype: StatusQueryDto })).toEqual({
      status: 'active',
    });
    for (const status of ['active', 'inactive', 'all']) {
      expect(await pipe.transform({ status }, { type: 'query', metatype: StatusQueryDto })).toEqual(
        { status },
      );
    }
  });

  it('keeps nested grade scheme references and validates their values', async () => {
    const body = {
      name: 'Scheme',
      details: [{ percentage: 100, order: 1, gradeItem: { idGradeItem: 1, name: 'Extra' } }],
    };
    expect(await pipe.transform(body, { type: 'body', metatype: GradeSchemeCreateDto })).toEqual({
      name: 'Scheme',
      details: [{ percentage: 100, order: 1, gradeItem: { idGradeItem: 1 } }],
    });
    await expect(
      pipe.transform(
        { ...body, details: [{ percentage: 101, order: 1, gradeItem: { idGradeItem: 'bad' } }] },
        { type: 'body', metatype: GradeSchemeCreateDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforms semester HTTP dates and supports optional faculty relations', async () => {
    expect(
      await pipe.transform(
        { year: 2026, period: 'I', startDate: '2026-01-01', endDate: '2026-06-01' },
        { type: 'body', metatype: SemesterCreateDto },
      ),
    ).toMatchObject({ startDate: new Date('2026-01-01'), endDate: new Date('2026-06-01') });
    expect(
      await pipe.transform(
        { name: 'Faculty', idDean: 1 },
        { type: 'body', metatype: FacultyCreateDto },
      ),
    ).toEqual({ name: 'Faculty', idDean: 1 });
  });

  it('keeps partial user edits but strips role and state assignment', async () => {
    expect(
      await pipe.transform(
        { name: 'Edited', isActive: false, roleNames: ['ADMIN'] },
        { type: 'body', metatype: UserUpdateDto },
      ),
    ).toEqual({ name: 'Edited' });
  });
});
