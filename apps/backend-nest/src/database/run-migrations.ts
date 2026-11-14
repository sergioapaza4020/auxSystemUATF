import AppDataSource from './datasource';
import { assertSafeMigrationPath } from './utils/migration-preflight';

async function migrate() {
  try {
    const args = process.argv.slice(2);
    if (args.length && args.join(' ') !== '--transaction each')
      throw new Error('MIGRATION_BLOCKED: only --transaction each is supported.');
    await AppDataSource.initialize();
    await assertSafeMigrationPath(AppDataSource);
    const applied = await AppDataSource.runMigrations({ transaction: 'each' });
    console.log(`Applied migrations: ${applied.length}`);
  } catch (error: unknown) {
    console.error(
      error instanceof Error && error.message.startsWith('MIGRATION_BLOCKED:')
        ? error.message
        : 'Migration failed. Review history and the isolated reproduction before retrying.',
    );
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

void migrate();
