import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttendanceImportType1795968000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" ADD VALUE IF NOT EXISTS 'ATTENDANCE_IMPORT'`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    const [row] = (await runner.query(
      `SELECT EXISTS (SELECT 1 FROM "bulk_operations" WHERE "type" = 'ATTENDANCE_IMPORT') AS used`,
    )) as { used: boolean }[];
    if (row.used)
      throw new Error('Archiva las importaciones de asistencia antes de revertir la migración');
    await runner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" RENAME TO "bulk_operations_type_enum_old"`,
    );
    await runner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum" AS ENUM ('USER_IMPORT', 'ENROLLMENT_IMPORT', 'CAREER_STUDENT_IMPORT', 'GRADE_IMPORT')`,
    );
    await runner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "type" TYPE "public"."bulk_operations_type_enum" USING "type"::text::"public"."bulk_operations_type_enum"`,
    );
    await runner.query(`DROP TYPE "public"."bulk_operations_type_enum_old"`);
  }
}
