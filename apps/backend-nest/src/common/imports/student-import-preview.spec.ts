import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { BulkOperationsService } from 'src/services/bulk-operations/bulk-operations.service';
import {
  ImportPreviewQueryDto,
  ExecuteImportDto,
} from 'src/dtos/bulk-operations/import-preview.dto';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { studentImportSearchCondition } from './student-import-preview';
class MetadataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}
const source = new MetadataSource({
  type: 'postgres',
  entities: [__dirname + '/../../entities/**/*.entity.ts'],
});
beforeAll(async () => source.prepare());
it.each([false, true])(
  'generates scoped, paginated SQL with literal search and career=%s',
  async (career) => {
    const operations = source.getRepository(BulkOperation),
      rows = source.getRepository(BulkOperationRow);
    const builder = rows.createQueryBuilder('row');
    const result = jest.spyOn(builder, 'getManyAndCount').mockResolvedValue([[], 0]);
    const build = jest.spyOn(rows, 'createQueryBuilder').mockReturnValue(builder);
    const get = jest.spyOn(operations, 'findOne').mockResolvedValue(new BulkOperation());
    try {
      await new BulkOperationsService(operations, rows).findRows(
        '00000000-0000-4000-8000-000000000001',
        9,
        { page: 2, limit: 25, valid: false },
        studentImportSearchCondition("x%' OR 1=1 --", career),
      );
      const [sql, params] = builder.getQueryAndParameters();
      expect(sql).toContain('"operation"."created_by" = $2');
      expect(sql).toContain('"row"."valid" = $3 AND (');
      expect(sql).toContain('ORDER BY "row"."row_number" ASC LIMIT 25 OFFSET 25');
      for (const field of ['fullName', 'ru', 'username', 'email'])
        expect(sql).toContain(`"data" ->> '${field}' ILIKE`);
      expect(sql.includes("-> 'currentCareer' ->> 'name'")).toBe(career);
      expect(sql).not.toContain('OR 1=1');
      expect(params.at(-1)).toBe("%x\\%' OR 1=1 --%");
    } finally {
      result.mockRestore();
      build.mockRestore();
      get.mockRestore();
    }
  },
);
it.each([
  { page: 0 },
  { page: 1.5 },
  { limit: 101 },
  { limit: 20 },
  { status: 'invalid-value' },
  { search: 'x'.repeat(201) },
])('rejects bad preview query %j', async (query) => {
  await expect(
    createValidationPipe().transform(query, { type: 'query', metatype: ImportPreviewQueryDto }),
  ).rejects.toThrow(BadRequestException);
});
it('accepts numeric query strings and strips forged owner/context/rows from final body', async () => {
  const pipe = createValidationPipe();
  expect(
    await pipe.transform(
      { page: '2', limit: '100', status: 'valid' },
      { type: 'query', metatype: ImportPreviewQueryDto },
    ),
  ).toMatchObject({ page: 2, limit: 100, status: 'valid' });
  expect(
    await pipe.transform(
      { operationId: '00000000-0000-4000-8000-000000000001', ownerId: 1, courseId: 999, rows: [] },
      { type: 'body', metatype: ExecuteImportDto },
    ),
  ).toEqual({ operationId: '00000000-0000-4000-8000-000000000001' });
  await expect(
    pipe.transform({ rows: [] }, { type: 'body', metatype: ExecuteImportDto }),
  ).rejects.toThrow(BadRequestException);
});
