import { createSeedTestDatabase } from '../../test/seeders-postgres';
import { writeFileSync } from 'node:fs';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { execFileSync } from 'node:child_process';
import { revertReviewedMigration } from './utils/safe-migration-revert';
import { assertSafeMigrationPath } from './utils/migration-preflight';

class AuditFailure1900000000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('CREATE TABLE audit_failure_probe (id integer)');
    throw new Error('Intentional isolated migration failure');
  }
  down(): Promise<void> {
    return Promise.reject(new Error('Test-only migration'));
  }
}

const pgBin = process.env.MIGRATION_TEST_PG_BIN;
const describePostgres = pgBin ? describe : describe.skip;

describePostgres('Complete migration history on isolated PostgreSQL', () => {
  it('migrates an empty database, repeats safely and matches all entity metadata', async () => {
    const database = await createSeedTestDatabase(pgBin!);
    try {
      const { source } = database;
      const environment = {
        ...process.env,
        DATABASE_URL: `postgresql://seeders_test@127.0.0.1:${database.port}/postgres`,
      };
      const cli = require.resolve('typeorm/cli-ts-node-commonjs.js');
      const cliOptions = { env: environment, windowsHide: true, timeout: 60000 };
      const shown = execFileSync(
        process.execPath,
        [cli, 'migration:show', '-d', 'src/database/datasource.ts'],
        cliOptions,
      ).toString();
      expect(shown.match(/\[ \]/g)).toHaveLength(source.migrations.length);
      await assertSafeMigrationPath(source);
      const applied = [...source.migrations];
      expect(
        execFileSync(
          process.execPath,
          [
            require.resolve('ts-node/dist/bin.js'),
            '-r',
            'tsconfig-paths/register',
            'src/database/run-migrations.ts',
          ],
          cliOptions,
        ).toString(),
      ).toContain(`Applied migrations: ${applied.length}`);
      expect(await source.runMigrations({ transaction: 'each' })).toEqual([]);
      expect(
        execFileSync(
          process.execPath,
          [cli, 'migration:run', '-d', 'src/database/datasource.ts', '--transaction', 'each'],
          cliOptions,
        ).toString(),
      ).toContain('No migrations are pending');
      if (process.env.MIGRATION_AUDIT_COMPILED === 'true') {
        expect(
          execFileSync(
            process.execPath,
            ['dist/database/run-migrations.js'],
            cliOptions,
          ).toString(),
        ).toContain('Applied migrations: 0');
        expect(
          execFileSync(
            process.execPath,
            [
              require.resolve('typeorm/cli.js'),
              'migration:show',
              '-d',
              'dist/database/datasource.js',
            ],
            cliOptions,
          )
            .toString()
            .match(/\[X\]/g),
        ).toHaveLength(source.migrations.length);
      }
      // Inspection only: never execute the generated synchronization SQL.
      const difference = await source.driver.createSchemaBuilder().log();
      expect(difference.upQueries.map((query) => query.query)).toEqual([]);
      // Exact final catalog, reviewable without access to an application database.
      const catalog: Record<string, unknown> = {};
      for (const [name, sql] of Object.entries({
        columns: `SELECT table_name, column_name, data_type, udt_name, is_nullable,
          column_default, character_maximum_length, numeric_precision, numeric_scale,
          datetime_precision FROM information_schema.columns WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position`,
        constraints: `SELECT conrelid::regclass::text AS table_name, conname, contype,
          pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace ORDER BY table_name, conname`,
        indexes: `SELECT tablename, indexname, indexdef FROM pg_indexes
          WHERE schemaname = 'public' ORDER BY tablename, indexname`,
        enums: `SELECT t.typname, e.enumlabel, e.enumsortorder FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder`,
        migrations: 'SELECT timestamp, name FROM migrations ORDER BY timestamp',
      })) {
        catalog[name] = await source.query(sql);
      }
      if (process.env.MIGRATION_AUDIT_EXPORT === 'true')
        writeFileSync('docs/migrations-schema.json', JSON.stringify(catalog, null, 2) + '\n');

      source.migrations.push(new AuditFailure1900000000000());
      await expect(source.runMigrations({ transaction: 'each' })).rejects.toThrow(
        'Intentional isolated migration failure',
      );
      expect(await source.query("SELECT to_regclass('audit_failure_probe') AS name")).toEqual([
        { name: null },
      ]);
      expect(await source.query('SELECT name FROM migrations')).toHaveLength(applied.length);
      source.migrations.pop();
      expect(await source.runMigrations({ transaction: 'each' })).toEqual([]);
      await revertReviewedMigration(source);
      await revertReviewedMigration(source);
      await revertReviewedMigration(source);
      await revertReviewedMigration(source);
      await revertReviewedMigration(source);
      await expect(revertReviewedMigration(source)).rejects.toThrow('ROLLBACK_BLOCKED:');
      expect(await source.query('SELECT name FROM migrations')).toHaveLength(applied.length - 5);
      expect(await source.runMigrations({ transaction: 'each' })).toHaveLength(5);
    } finally {
      await database.close();
    }
  }, 120000);

  it('demonstrates that the historical ASSITANT cast fails atomically with existing rows', async () => {
    const database = await createSeedTestDatabase(pgBin!);
    try {
      const { source } = database;
      const migrations = [...source.migrations].sort((a, b) =>
        a.constructor.name.slice(-13).localeCompare(b.constructor.name.slice(-13)),
      );
      source.migrations.splice(0, source.migrations.length, ...migrations);
      source.migrations.splice(4);
      await source.runMigrations({ transaction: 'each' });
      await source.query(`INSERT INTO user_courses ("relationType") VALUES ('ASSITANT')`);
      source.migrations.push(migrations[4]);
      await expect(assertSafeMigrationPath(source)).rejects.toThrow('MIGRATION_BLOCKED:');
      await expect(source.runMigrations({ transaction: 'each' })).rejects.toThrow(/ASSITANT/);
      expect(await source.query('SELECT "relationType" FROM user_courses')).toEqual([
        { relationType: 'ASSITANT' },
      ]);
      expect(await source.query('SELECT name FROM migrations')).toHaveLength(4);
    } finally {
      await database.close();
    }
  }, 120000);

  it('demonstrates publication data loss in the unchanged historical migration', async () => {
    const database = await createSeedTestDatabase(pgBin!);
    try {
      const { source } = database;
      const migrations = [...source.migrations].sort((a, b) =>
        a.constructor.name.slice(-13).localeCompare(b.constructor.name.slice(-13)),
      );
      source.migrations.splice(0, source.migrations.length, ...migrations);
      source.migrations.splice(13);
      await source.runMigrations({ transaction: 'each' });
      await source.query(`INSERT INTO activities (name, due_date, published_at)
        VALUES ('Historical publication', '2026-10-01', '2026-09-01T14:00:00Z')`);
      source.migrations.push(migrations[13]);
      await expect(assertSafeMigrationPath(source)).rejects.toThrow('MIGRATION_BLOCKED:');
      await source.runMigrations({ transaction: 'each' });
      expect(await source.query('SELECT publication_date FROM activities')).toEqual([
        { publication_date: null },
      ]);
    } finally {
      await database.close();
    }
  }, 120000);
});
