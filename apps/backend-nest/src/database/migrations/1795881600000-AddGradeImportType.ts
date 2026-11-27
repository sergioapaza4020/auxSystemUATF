import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGradeImportType1795881600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" ADD VALUE IF NOT EXISTS 'GRADE_IMPORT'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [row] = (await queryRunner.query(
      `SELECT EXISTS (SELECT 1 FROM "bulk_operations" WHERE "type" = 'GRADE_IMPORT') AS used`,
    )) as { used: boolean }[];
    if (row.used)
      throw new Error(
        'La reversión requiere conservar o archivar primero las importaciones de calificaciones',
      );
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" RENAME TO "bulk_operations_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum" AS ENUM ('USER_IMPORT', 'ENROLLMENT_IMPORT', 'CAREER_STUDENT_IMPORT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "type" TYPE "public"."bulk_operations_type_enum" USING "type"::text::"public"."bulk_operations_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum_old"`);
  }
}
