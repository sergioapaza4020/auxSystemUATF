import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAcademicImportTypes1792526400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" ADD VALUE IF NOT EXISTS 'ENROLLMENT_IMPORT'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" ADD VALUE IF NOT EXISTS 'CAREER_STUDENT_IMPORT'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse a rollback that would discard persisted academic previews or import history.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "bulk_operations" WHERE "type"::text IN ('ENROLLMENT_IMPORT', 'CAREER_STUDENT_IMPORT')) THEN
        RAISE EXCEPTION 'Cannot remove academic import types while operations exist';
      END IF;
    END $$`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" RENAME TO "bulk_operations_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum" AS ENUM('USER_IMPORT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "type" TYPE "public"."bulk_operations_type_enum" USING "type"::text::"public"."bulk_operations_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum_old"`);
  }
}
