import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  lockAttendanceCombinedRollback,
  attendanceCombinedCatalogRows,
} from '../utils/attendance-combined-rollback';

export class AttendanceCombinedEnums1794614400000 implements MigrationInterface {
  transaction = true;

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TYPE public.attendance_sessions_mode_enum ADD VALUE 'GEOLOCATION_QR'`,
    );
    await runner.query(
      `ALTER TYPE public.attendances_registration_method_enum ADD VALUE 'GEOLOCATION_QR'`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await lockAttendanceCombinedRollback(runner);
    const dependencies = await attendanceCombinedCatalogRows(
      runner,
      `
      SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
      WHERE t.typnamespace = 'public'::regnamespace
        AND t.typname IN ('attendance_sessions_mode_enum', 'attendances_registration_method_enum')
        AND a.attnum > 0 AND NOT a.attisdropped
        AND NOT ((a.attrelid = 'public.attendance_sessions'::regclass AND a.attname = 'mode')
          OR (a.attrelid = 'public.attendances'::regclass AND a.attname = 'registration_method'))
      UNION ALL
      SELECT 1 FROM pg_depend d JOIN pg_type t ON t.oid = d.refobjid
      WHERE d.refclassid = 'pg_type'::regclass AND d.classid = 'pg_proc'::regclass
        AND t.typnamespace = 'public'::regnamespace
        AND t.typname IN ('attendance_sessions_mode_enum', 'attendances_registration_method_enum')
      LIMIT 1`,
    );
    if (dependencies.length)
      throw new Error('COMBINED_ROLLBACK_BLOCKED: external enum dependencies require review');

    // Restrictive DROP rejects unknown views/functions/columns atomically. No CASCADE.
    for (const [table, column, type] of [
      ['attendance_sessions', 'mode', 'attendance_sessions_mode_enum'],
      ['attendances', 'registration_method', 'attendances_registration_method_enum'],
    ] as const) {
      const rows = await attendanceCombinedCatalogRows(
        runner,
        `SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint
         WHERE conrelid = $1::regclass AND contype = 'c'`,
        [`public.${table}`],
      );
      const checks: { name: string; definition: string }[] = [];
      for (const row of rows) {
        if (
          !row ||
          typeof row !== 'object' ||
          !('name' in row) ||
          typeof row.name !== 'string' ||
          !('definition' in row) ||
          typeof row.definition !== 'string'
        )
          throw new Error('COMBINED_ROLLBACK_BLOCKED: invalid CHECK metadata');
        checks.push({ name: row.name, definition: row.definition });
      }
      for (const check of checks)
        await runner.query(
          `ALTER TABLE public."${table}" DROP CONSTRAINT "${check.name.replaceAll('"', '""')}"`,
        );
      await runner.query(
        `CREATE TYPE public."${type}_without_combined" AS ENUM ('MANUAL', 'GEOLOCATION', 'QR')`,
      );
      await runner.query(`ALTER TABLE public."${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
      await runner.query(`ALTER TABLE public."${table}" ALTER COLUMN "${column}" TYPE public."${type}_without_combined"
        USING "${column}"::text::public."${type}_without_combined"`);
      await runner.query(`DROP TYPE public."${type}"`);
      await runner.query(`ALTER TYPE public."${type}_without_combined" RENAME TO "${type}"`);
      await runner.query(
        `ALTER TABLE public."${table}" ALTER COLUMN "${column}" SET DEFAULT 'MANUAL'`,
      );
      for (const check of checks)
        await runner.query(
          `ALTER TABLE public."${table}" ADD CONSTRAINT "${check.name.replaceAll('"', '""')}" ${check.definition}`,
        );
    }
  }
}
