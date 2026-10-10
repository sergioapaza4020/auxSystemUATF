import { QueryRunner } from 'typeorm';
import { ActivityPublicationAndDeadline1791223200000 } from '../../database/migrations/1791223200000-ActivityPublicationAndDeadline';

describe('Activity publication/deadline migration', () => {
  it('renames the existing deadline and derives historical publication from created_at', async () => {
    const query = jest.fn<Promise<unknown>, [string]>().mockResolvedValue([]);
    await new ActivityPublicationAndDeadline1791223200000().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('RENAME COLUMN "activity_date" TO "due_date"');
    expect(sql).toContain('"created_at" AT TIME ZONE current_setting(\'TimeZone\')');
    expect(sql).not.toContain('UPDATE "activities" SET "due_date"');
    expect(sql).not.toContain('DELETE FROM');
  });

  it('stops before changing the schema when active duplicate names exist', async () => {
    const query = jest
      .fn<Promise<unknown>, [string]>()
      .mockResolvedValue([{ id_course: 1, activity_ids: [2, 3] }]);
    await expect(
      new ActivityPublicationAndDeadline1791223200000().up({ query } as unknown as QueryRunner),
    ).rejects.toThrow('Renombrar o desactivar');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toContain('ALTER TABLE');
  });

  it('reconstructs the old API order deterministically on rollback', async () => {
    const query = jest.fn<Promise<unknown>, [string]>().mockResolvedValue([]);
    await new ActivityPublicationAndDeadline1791223200000().down({
      query,
    } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('ORDER BY "due_date", "created_at", "id_activity"');
    expect(sql).toContain('RENAME COLUMN "due_date" TO "activity_date"');
  });
});
