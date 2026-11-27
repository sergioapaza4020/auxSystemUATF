import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceSessionTopic1796054400000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "attendance_sessions" ADD "topic" character varying(255) NULL');
  }

  async down(runner: QueryRunner): Promise<void> {
    if (!runner.isTransactionActive)
      throw new Error('ATTENDANCE_TOPIC_ROLLBACK_BLOCKED: transaction required');
    // Never silently discard academic metadata on rollback.
    await runner.query('LOCK TABLE "attendance_sessions" IN ACCESS EXCLUSIVE MODE');
    const rows = (await runner.query(
      'SELECT EXISTS(SELECT 1 FROM "attendance_sessions" WHERE "topic" IS NOT NULL) AS used',
    )) as { used: boolean }[];
    if (rows[0].used) throw new Error('ATTENDANCE_TOPIC_ROLLBACK_BLOCKED: topics exist');
    await runner.query('ALTER TABLE "attendance_sessions" DROP COLUMN "topic"');
  }
}
