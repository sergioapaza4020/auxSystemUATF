import { QueryRunner } from 'typeorm';
import { AddAcademicImportTypes1792526400000 } from 'src/database/migrations/1792526400000-AddAcademicImportTypes';

describe('Academic import schema prerequisite', () => {
  it('adds both supported types idempotently without recreating the enum or deleting data', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const runner = { query } as unknown as QueryRunner;
    await new AddAcademicImportTypes1792526400000().up(runner);
    expect(query.mock.calls.map(([sql]: [string]) => sql)).toEqual([
      `ALTER TYPE "public"."bulk_operations_type_enum" ADD VALUE IF NOT EXISTS 'ENROLLMENT_IMPORT'`,
      `ALTER TYPE "public"."bulk_operations_type_enum" ADD VALUE IF NOT EXISTS 'CAREER_STUDENT_IMPORT'`,
    ]);
  });
});
