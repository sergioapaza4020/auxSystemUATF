import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueActivityGrade1791547200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing duplicate data must be reviewed, never silently deleted by a migration.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_grade_enrollment_activity" ON "grades" ("id_enrollment", "id_activity") WHERE "id_activity" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_grade_enrollment_activity"`);
  }
}
