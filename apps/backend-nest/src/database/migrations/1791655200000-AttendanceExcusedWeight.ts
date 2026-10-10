import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceExcusedWeight1791655200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."attendances_status_enum" ADD VALUE 'EXCUSED'`);
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD "permission_weight" double precision NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD CONSTRAINT "CHK_attendance_permission_weight" CHECK ("permission_weight" >= 0 AND "permission_weight" <= 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse to discard the distinct academic category when EXCUSED records exist.
    await queryRunner.query(
      `CREATE TYPE "public"."attendances_status_enum_old" AS ENUM ('PRESENT', 'ABSENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ALTER COLUMN "status" TYPE "public"."attendances_status_enum_old" USING "status"::text::"public"."attendances_status_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."attendances_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."attendances_status_enum_old" RENAME TO "attendances_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "grade_scheme_details" DROP COLUMN "permission_weight"`);
  }
}
