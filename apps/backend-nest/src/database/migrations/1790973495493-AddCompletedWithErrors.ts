import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompletedWithErrors1790973495493 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_status_enum" ADD VALUE IF NOT EXISTS 'COMPLETED_WITH_ERRORS'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bulk_operations" SET "status" = 'FAILED' WHERE "status"::text = 'COMPLETED_WITH_ERRORS'`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_status_enum" RENAME TO "bulk_operations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_status_enum" AS ENUM('PENDING','PROCESSING','READY','IMPORTING','COMPLETED','FAILED','EXPIRED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" TYPE "public"."bulk_operations_status_enum" USING "status"::text::"public"."bulk_operations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_status_enum_old"`);
  }
}
