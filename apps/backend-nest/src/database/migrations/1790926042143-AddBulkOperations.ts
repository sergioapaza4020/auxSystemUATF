import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBulkOperations1790926042143 implements MigrationInterface {
  name = 'AddBulkOperations1790926042143';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum" AS ENUM('USER_IMPORT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_status_enum" AS ENUM('PENDING', 'PROCESSING', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operation_rows_status_enum" AS ENUM('PENDING', 'PROCESSED', 'FAILED')`,
    );
    await queryRunner.query(`CREATE TABLE "bulk_operations" (
        "id_bulk_operation" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."bulk_operations_type_enum" NOT NULL,
        "status" "public"."bulk_operations_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_by" integer NOT NULL,
        "total_rows" integer NOT NULL DEFAULT 0,
        "valid_rows" integer NOT NULL DEFAULT 0,
        "invalid_rows" integer NOT NULL DEFAULT 0,
        "processed_rows" integer NOT NULL DEFAULT 0,
        "failed_rows" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        CONSTRAINT "PK_bulk_operations" PRIMARY KEY ("id_bulk_operation"),
        CONSTRAINT "CHK_bulk_operations_counts" CHECK ("total_rows" >= 0 AND "valid_rows" >= 0 AND "invalid_rows" >= 0 AND "processed_rows" >= 0 AND "failed_rows" >= 0 AND "valid_rows" + "invalid_rows" = "total_rows" AND "processed_rows" + "failed_rows" <= "total_rows"),
        CONSTRAINT "FK_bulk_operations_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`);
    await queryRunner.query(`CREATE TABLE "bulk_operation_rows" (
        "id_bulk_operation_row" SERIAL NOT NULL,
        "id_bulk_operation" uuid NOT NULL,
        "row_number" integer NOT NULL,
        "data" jsonb NOT NULL,
        "valid" boolean NOT NULL,
        "errors" jsonb,
        "status" "public"."bulk_operation_rows_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bulk_operation_rows" PRIMARY KEY ("id_bulk_operation_row"),
        CONSTRAINT "CHK_bulk_operation_rows_row_number" CHECK ("row_number" > 0),
        CONSTRAINT "FK_bulk_operation_rows_operation" FOREIGN KEY ("id_bulk_operation") REFERENCES "bulk_operations"("id_bulk_operation") ON DELETE CASCADE ON UPDATE NO ACTION
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_created_by" ON "bulk_operations" ("created_by")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_type" ON "bulk_operations" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_status" ON "bulk_operations" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_created_at" ON "bulk_operations" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_expires_at" ON "bulk_operations" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bulk_operation_rows_operation_row" ON "bulk_operation_rows" ("id_bulk_operation", "row_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operation_rows_operation_valid" ON "bulk_operation_rows" ("id_bulk_operation", "valid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operation_rows_operation_status" ON "bulk_operation_rows" ("id_bulk_operation", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bulk_operation_rows"`);
    await queryRunner.query(`DROP TABLE "bulk_operations"`);
    await queryRunner.query(`DROP TYPE "public"."bulk_operation_rows_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum"`);
    // uuid-ossp may be shared by other tables; deliberately retain the extension.
  }
}
