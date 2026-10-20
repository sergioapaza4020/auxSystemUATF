import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StudentRosterQueryDto } from 'src/dtos/enrollments/student-roster-query.dto';
import { Repository } from 'typeorm';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { buildStudentRosterQuery, getStudentRosterPage } from './student-roster';

function fixture() {
  const builder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[{ idEnrollment: 8 }], 31]),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => builder),
  } as unknown as Repository<Enrollment>;
  const assistant = { course: { idCourse: 2 }, semester: { idSemester: 3 } } as Enrollment;
  return { builder, repository, assistant };
}

describe('student roster pagination', () => {
  it('scopes active students, searches before slicing and orders with a unique tie breaker', async () => {
    const f = fixture();
    const result = await getStudentRosterPage(f.repository, f.assistant, {
      page: 2,
      limit: 10,
      search: ' Ana ',
    });
    expect(f.builder.where).toHaveBeenCalledWith('student.id_course = :courseId', { courseId: 2 });
    expect(f.builder.andWhere).toHaveBeenCalledWith('student.id_semester = :semesterId', {
      semesterId: 3,
    });
    expect(f.builder.andWhere).toHaveBeenCalledWith('student.role = :role', { role: 'STUDENT' });
    expect(f.builder.andWhere).toHaveBeenCalledWith('student.isActive = true');
    expect(f.builder.andWhere).toHaveBeenCalledWith(expect.stringContaining('user.ru ILIKE'), {
      search: '%Ana%',
    });
    expect(f.builder.orderBy).toHaveBeenCalledWith('user.lastname', 'ASC');
    expect(f.builder.addOrderBy).toHaveBeenCalledWith('user.name', 'ASC');
    expect(f.builder.addOrderBy).toHaveBeenCalledWith('student.idEnrollment', 'ASC');
    expect(f.builder.skip).toHaveBeenCalledWith(10);
    expect(f.builder.take).toHaveBeenCalledWith(10);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 31, totalPages: 4 });
  });
  it('uses 25 by default and escapes wildcard searches', async () => {
    const f = fixture();
    await getStudentRosterPage(f.repository, f.assistant, {});
    expect(f.builder.take).toHaveBeenCalledWith(25);
    buildStudentRosterQuery(f.repository, f.assistant, '%_');
    expect(f.builder.andWhere).toHaveBeenLastCalledWith(expect.any(String), { search: '%\\%\\_%' });
  });
});

it.each([{ page: 0 }, { page: 1.5 }, { limit: 0 }, { limit: 101 }])(
  'rejects invalid roster bounds %j',
  async (query) => {
    expect(await validate(plainToInstance(StudentRosterQueryDto, query))).not.toHaveLength(0);
  },
);

it('converts numeric query strings and accepts the maximum page size', async () => {
  const query = plainToInstance(StudentRosterQueryDto, { page: '2', limit: '100', search: 'Ana' });
  expect(await validate(query)).toEqual([]);
  expect(query.page).toBe(2);
  expect(query.limit).toBe(100);
});
