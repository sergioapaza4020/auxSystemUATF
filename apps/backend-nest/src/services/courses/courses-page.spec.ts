import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Course } from 'src/entities/courses/courses.entity';
import { CourseQueryDto } from 'src/dtos/courses/course-query.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { CoursesService } from './courses.service';

class MetadataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}
describe('Courses remote listing', () => {
  const source = new MetadataSource({
    type: 'postgres',
    entities: [__dirname + '/../../entities/**/*.entity.ts'],
  });
  beforeAll(async () => source.prepare());
  afterEach(() => jest.restoreAllMocks());
  it.each([1, 2])('selects bounded page %s with stable order and no collections', async (page) => {
    const repo = source.getRepository(Course);
    const qb = repo.createQueryBuilder('course');
    jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb);
    const row = { idCourse: page, code: 'SIS', name: 'Sistemas', group: 1, isActive: true };
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[row as Course], 12]);
    const result = await new CoursesService(repo).getPage({
      page,
      limit: 5,
      search: ' SIS ',
      status: RecordStatus.ACTIVE,
    });
    expect(result).toEqual({ data: [row], meta: { page, limit: 5, total: 12, totalPages: 3 } });
    expect(qb.expressionMap.skip).toBe((page - 1) * 5);
    expect(qb.expressionMap.take).toBe(5);
    expect(qb.expressionMap.orderBys).toEqual({ 'course.code': 'ASC', 'course.idCourse': 'ASC' });
    expect(qb.getParameters()).toMatchObject({ search: '%SIS%', orm_param_0: true });
    const sql = qb.getSql();
    expect(sql).toContain('ILIKE');
    expect(sql).toContain('CAST("course"."group" AS text)');
    expect(sql.indexOf('WHERE')).toBeLessThan(sql.indexOf('LIMIT'));
    expect(sql).not.toContain('JOIN');
    expect(sql).not.toContain('user_courses');
  });
  it.each([RecordStatus.ALL, RecordStatus.INACTIVE])(
    'filters %s before pagination',
    async (status) => {
      const repo = source.getRepository(Course);
      const qb = repo.createQueryBuilder('course');
      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb);
      jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);
      const result = await new CoursesService(repo).getPage({ status });
      expect(result.meta.total).toBe(0);
      expect(qb.getParameters()).toEqual(status === RecordStatus.ALL ? {} : { orm_param_0: false });
    },
  );
  it.each([{ page: 0 }, { limit: 101 }, { limit: 0 }, { status: 'bogus' }])(
    'rejects invalid queries %j',
    async (query) => {
      expect((await validate(plainToInstance(CourseQueryDto, query))).length).toBeGreaterThan(0);
    },
  );
});
