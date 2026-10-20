import { DataSource, Repository } from 'typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeQueryDto } from 'src/dtos/grade-schemes/grade-scheme-query.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { GradeSchemesService } from './grade-schemes.service';

class MetadataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}
describe('Global grade schemes pagination', () => {
  const source = new MetadataSource({
    type: 'postgres',
    entities: [__dirname + '/../../entities/**/*.entity.ts'],
  });
  beforeAll(async () => source.prepare());
  afterEach(() => jest.restoreAllMocks());
  it.each([1, 2])(
    'pages root schemes on page %s, retaining details without activities or course joins',
    async (page) => {
      const repo = source.getRepository(GradeScheme);
      const qb = repo.createQueryBuilder('scheme');
      jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb);
      const schemes = [
        {
          idGradeScheme: 20,
          details: [{ idGradeSchemeDetail: 1 }],
          assistantEnrollment: { idEnrollment: 7 },
        },
      ] as GradeScheme[];
      jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([schemes, 31]);
      const service = new GradeSchemesService(
        repo,
        {} as Repository<GradeSchemeDetail>,
        {} as Repository<Enrollment>,
        source,
      );
      const result = await service.getPage({
        page,
        limit: 5,
        search: ' Parcial ',
        status: RecordStatus.INACTIVE,
        sortBy: 'name',
        sortOrder: 'ASC',
      });
      expect(result).toEqual({ data: schemes, meta: { page, limit: 5, total: 31, totalPages: 7 } });
      expect(qb.expressionMap.skip).toBe((page - 1) * 5);
      expect(qb.expressionMap.take).toBe(5);
      expect(qb.expressionMap.orderBys).toEqual({
        'scheme.name': 'ASC',
        'scheme.idGradeScheme': 'DESC',
      });
      expect(qb.getParameters()).toMatchObject({ search: '%Parcial%', orm_param_0: false });
      const sql = qb.getSql();
      expect(sql).toContain('grade_scheme_details');
      expect(sql).toContain('grade_items');
      expect(sql).toContain('ILIKE');
      expect(sql).not.toContain('"activities"');
      expect(sql).not.toContain('"courses"');
      expect(sql).not.toContain('id_assistant_enrollment IS NULL');
    },
  );
  it('does not override an explicit ascending primary-key sort with its tie breaker', async () => {
    const repo = source.getRepository(GradeScheme);
    const qb = repo.createQueryBuilder('scheme');
    jest.spyOn(repo, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);
    const service = new GradeSchemesService(
      repo,
      {} as Repository<GradeSchemeDetail>,
      {} as Repository<Enrollment>,
      source,
    );
    await service.getPage({ sortBy: 'idGradeScheme', sortOrder: 'ASC' });
    expect(qb.expressionMap.orderBys).toEqual({ 'scheme.idGradeScheme': 'ASC' });
  });
  it.each([
    { page: 0 },
    { limit: 101 },
    { status: 'bad' },
    { sortBy: 'details' },
    { sortOrder: 'SQL' },
  ])('validates query %j', async (query) => {
    expect((await validate(plainToInstance(GradeSchemeQueryDto, query))).length).toBeGreaterThan(0);
  });
});
