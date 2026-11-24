import { DataSource, MigrationExecutor } from 'typeorm';

// Historical downs include DROP COLUMN/TABLE and lossy status conversions.
// Only reviewed, data-aware rollbacks may be invoked by the package script.
const reviewedRollbacks = new Set([
  'AttendanceMultipleDailySessions1794700800000',
  'AttendanceCombinedPersistence1794614460000',
  'AttendanceCombinedEnums1794614400000',
  'AttendanceQrChecks1794355260000',
  'AttendanceQrEnums1794355200000',
]);

export async function revertReviewedMigration(source: DataSource): Promise<void> {
  const executed = await new MigrationExecutor(source).getExecutedMigrations();
  const latest = executed[0];
  if (!latest) return;
  if (!reviewedRollbacks.has(latest.name))
    throw new Error(
      `ROLLBACK_BLOCKED: ${latest.name} requires an individual data-preservation review. Restore a verified backup in isolation or prepare a forward correction.`,
    );
  await source.undoLastMigration({ transaction: 'each' });
}
