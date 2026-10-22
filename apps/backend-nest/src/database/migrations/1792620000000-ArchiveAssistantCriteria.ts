import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArchiveAssistantCriteria1792620000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grade_scheme_details"
      ADD COLUMN "is_active" boolean NOT NULL DEFAULT true,
      ADD COLUMN "archived_at" timestamp NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the flag would silently reintroduce archived scores into current totals.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "grade_scheme_details" WHERE NOT "is_active") THEN
        RAISE EXCEPTION 'Cannot revert while archived criteria exist';
      END IF;
    END $$`);
    await queryRunner.query(`ALTER TABLE "grade_scheme_details"
      DROP COLUMN "archived_at", DROP COLUMN "is_active"`);
  }
}
