import type { QueryRunner } from 'typeorm';
import { AttendanceExcusedWeight1791655200000 } from 'src/database/migrations/1791655200000-AttendanceExcusedWeight';

describe('Attendance schema migration', () => {
  it('adds the category and bounded default without rewriting historical attendance', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new AttendanceExcusedWeight1791655200000().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.flat().join('\n');
    expect(sql).toContain("ADD VALUE 'EXCUSED'");
    expect(sql).toContain('NOT NULL DEFAULT 1');
    expect(sql).toContain('"permission_weight" >= 0 AND "permission_weight" <= 1');
    expect(sql).not.toMatch(/UPDATE|DELETE|DROP/);
  });
});
