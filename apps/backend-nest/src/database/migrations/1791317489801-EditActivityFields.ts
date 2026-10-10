import { MigrationInterface, QueryRunner } from 'typeorm';

export class EditActivityFields1791317489801 implements MigrationInterface {
  name = 'EditActivityFields1791317489801';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" RENAME COLUMN "published_at" TO "publication_date"`,
    );
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "publication_date"`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "publication_date" date`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" RENAME TO "bulk_operations_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum" AS ENUM('USER_IMPORT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "type" TYPE "public"."bulk_operations_type_enum" USING "type"::"text"::"public"."bulk_operations_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_status_enum" RENAME TO "bulk_operations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_status_enum" AS ENUM('PENDING', 'PROCESSING', 'READY', 'IMPORTING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" TYPE "public"."bulk_operations_status_enum" USING "status"::"text"::"public"."bulk_operations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_status_enum_old"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bulk_operation_rows_operation_status"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operation_rows_status_enum" RENAME TO "bulk_operation_rows_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operation_rows_status_enum" AS ENUM('PENDING', 'PROCESSED', 'FAILED')`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" TYPE "public"."bulk_operation_rows_status_enum" USING "status"::"text"::"public"."bulk_operation_rows_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operation_rows_status_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operation_rows_operation_status" ON "bulk_operation_rows" ("id_bulk_operation", "status") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_bulk_operation_rows_operation_status"`);
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operation_rows_status_enum_old" AS ENUM('PENDING', 'PROCESSED', 'FAILED')`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" TYPE "public"."bulk_operation_rows_status_enum_old" USING "status"::"text"::"public"."bulk_operation_rows_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operation_rows_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operation_rows_status_enum_old" RENAME TO "bulk_operation_rows_status_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operation_rows_operation_status" ON "bulk_operation_rows" ("id_bulk_operation", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_status_enum_old" AS ENUM('PENDING', 'PROCESSING', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED', 'EXPIRED', 'COMPLETED_WITH_ERRORS')`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" TYPE "public"."bulk_operations_status_enum_old" USING "status"::"text"::"public"."bulk_operations_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_status_enum_old" RENAME TO "bulk_operations_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum_old" AS ENUM('USER_IMPORT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "type" TYPE "public"."bulk_operations_type_enum_old" USING "type"::"text"::"public"."bulk_operations_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum_old" RENAME TO "bulk_operations_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "publication_date"`);
    await queryRunner.query(
      `ALTER TABLE "activities" ADD "publication_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" RENAME COLUMN "publication_date" TO "published_at"`,
    );
  }
}
