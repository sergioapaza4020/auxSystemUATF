import { MigrationInterface, QueryRunner } from 'typeorm';
import { lockAttendanceQrRollback } from '../utils/attendance-qr-rollback';

export class AttendanceQrEnums1794355200000 implements MigrationInterface {
  // TypeORM rejects the default "all" mode before running pending migrations.
  // --transaction each commits this migration before the QR CHECKs use the labels.
  transaction = true;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."attendance_sessions_mode_enum" ADD VALUE 'QR'`);
    await queryRunner.query(
      `ALTER TYPE "public"."attendances_registration_method_enum" ADD VALUE 'QR'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await lockAttendanceQrRollback(queryRunner);
    // PostgreSQL has no DROP VALUE. Preserve the actual CHECK definitions while
    // changing their column types, then recreate them against the narrowed enums.
    // Unknown dependencies fail atomically; never use DROP ... CASCADE.
    for (const [table, column, type, checks] of [
      [
        'attendance_sessions',
        'mode',
        'attendance_sessions_mode_enum',
        ['CHK_attendance_session_geo_configuration', 'CHK_attendance_session_manual_fields'],
      ],
      [
        'attendances',
        'registration_method',
        'attendances_registration_method_enum',
        ['CHK_attendance_geo_evidence', 'CHK_attendance_geo_status'],
      ],
    ] as const) {
      const definitions: unknown = await queryRunner.query(
        `SELECT conname AS name, pg_get_constraintdef(oid) AS definition
         FROM pg_constraint WHERE conrelid = $1::regclass AND conname = ANY($2::text[])`,
        [`public.${table}`, checks],
      );
      if (!Array.isArray(definitions) || definitions.length !== checks.length)
        throw new Error('QR rollback requires the existing MANUAL/GEO CHECKs');
      const preserved: { name: string; definition: string }[] = [];
      for (const row of definitions as unknown[]) {
        if (
          !row ||
          typeof row !== 'object' ||
          !('name' in row) ||
          typeof row.name !== 'string' ||
          !('definition' in row) ||
          typeof row.definition !== 'string'
        )
          throw new Error('Unexpected PostgreSQL CHECK metadata');
        preserved.push({ name: row.name, definition: row.definition });
      }
      for (const check of checks)
        await queryRunner.query(`ALTER TABLE "public"."${table}" DROP CONSTRAINT "${check}"`);
      await queryRunner.query(
        `CREATE TYPE "public"."${type}_without_qr" AS ENUM ('MANUAL', 'GEOLOCATION')`,
      );
      await queryRunner.query(
        `ALTER TABLE "public"."${table}" ALTER COLUMN "${column}" DROP DEFAULT`,
      );
      await queryRunner.query(
        `ALTER TABLE "public"."${table}" ALTER COLUMN "${column}" TYPE "public"."${type}_without_qr"
         USING "${column}"::text::"public"."${type}_without_qr"`,
      );
      await queryRunner.query(`DROP TYPE "public"."${type}"`);
      await queryRunner.query(`ALTER TYPE "public"."${type}_without_qr" RENAME TO "${type}"`);
      await queryRunner.query(
        `ALTER TABLE "public"."${table}" ALTER COLUMN "${column}" SET DEFAULT 'MANUAL'`,
      );
      for (const check of preserved)
        await queryRunner.query(
          `ALTER TABLE "public"."${table}" ADD CONSTRAINT "${check.name}" ${check.definition}`,
        );
    }
  }
}
