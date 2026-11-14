import AppDataSource from './datasource';
import { revertReviewedMigration } from './utils/safe-migration-revert';

async function revert() {
  try {
    await AppDataSource.initialize();
    await revertReviewedMigration(AppDataSource);
  } catch (error: unknown) {
    console.error(
      error instanceof Error && error.message.startsWith('ROLLBACK_BLOCKED:')
        ? error.message
        : 'Rollback refused or failed. Review migration history and data in isolation.',
    );
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

void revert();
