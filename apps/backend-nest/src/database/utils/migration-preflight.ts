import { DataSource } from 'typeorm';

/** Stop known unsafe historical transitions before executing any pending up. */
export async function assertSafeMigrationPath(source: DataSource): Promise<void> {
  const runner = source.createQueryRunner();
  try {
    const history: unknown = (await runner.hasTable('migrations'))
      ? await runner.query('SELECT name FROM "migrations"')
      : [];
    if (!Array.isArray(history)) throw new Error('Unexpected migration history');
    const executed = new Set(history.map((row: { name: string }) => row.name));
    const pending = new Set(
      source.migrations
        .map((migration) => migration.name ?? migration.constructor.name)
        .filter((name) => !executed.has(name)),
    );
    if (pending.has('ModifyCourseRelationsEnum1787854574886')) {
      for (const [table, column] of [
        ['user_courses', 'relationType'],
        ['enrollments', 'role'],
      ] as const) {
        if (!(await runner.hasTable(table))) continue;
        const rows: unknown = await runner.query(
          `SELECT 1 FROM "${table}" WHERE "${column}"::text = 'ASSITANT' LIMIT 1`,
        );
        if (!Array.isArray(rows) || rows.length)
          throw new Error(
            `MIGRATION_BLOCKED: historical ASSITANT values in ${table} require a reviewed preservation plan before the enum migration.`,
          );
      }
    }
    if (pending.has('EditActivityFields1791317489801') && (await runner.hasTable('activities'))) {
      const rows: unknown = await runner.query('SELECT 1 FROM "activities" LIMIT 1');
      if (!Array.isArray(rows) || rows.length)
        throw new Error(
          'MIGRATION_BLOCKED: historical publication replacement can discard activity data. Rehearse a preservation plan on a restored isolated copy.',
        );
    }
  } finally {
    await runner.release();
  }
}
