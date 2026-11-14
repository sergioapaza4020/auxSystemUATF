import { QueryRunner } from 'typeorm';

/** Shared by the two QR-2B migrations. Never remove evidence during rollback. */
export async function lockAttendanceQrRollback(queryRunner: QueryRunner): Promise<void> {
  if (!queryRunner.isTransactionActive)
    throw new Error('QR rollback requires a transaction; use --transaction each');
  // Keep the check and all DDL atomic, including against concurrent direct SQL writes.
  await queryRunner.query(
    'LOCK TABLE "public"."attendance_sessions", "public"."attendances" IN ACCESS EXCLUSIVE MODE',
  );
  await queryRunner.query(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "public"."attendance_sessions" WHERE "mode"::text = 'QR')
      OR EXISTS (SELECT 1 FROM "public"."attendances" WHERE "registration_method"::text = 'QR')
    THEN RAISE EXCEPTION 'QR_ROLLBACK_BLOCKED: QR sessions or evidence exist';
    END IF;
  END $$`);
}
