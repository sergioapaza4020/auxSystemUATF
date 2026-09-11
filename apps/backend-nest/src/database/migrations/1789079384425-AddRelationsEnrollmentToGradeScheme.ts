import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelationsEnrollmentToGradeScheme1789079384425 implements MigrationInterface {
  name = 'AddRelationsEnrollmentToGradeScheme1789079384425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grade_schemes" ADD "assistant_percentage" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "grade_schemes" ADD "id_assistant_enrollment" integer`);
    await queryRunner.query(
      `ALTER TABLE "grade_schemes" ADD CONSTRAINT "UQ_6dccc4d4f0d1d8d5ba4e210f7da" UNIQUE ("id_assistant_enrollment")`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_schemes" ADD CONSTRAINT "FK_6dccc4d4f0d1d8d5ba4e210f7da" FOREIGN KEY ("id_assistant_enrollment") REFERENCES "enrollments"("id_enrollment") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grade_schemes" DROP CONSTRAINT "FK_6dccc4d4f0d1d8d5ba4e210f7da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_schemes" DROP CONSTRAINT "UQ_6dccc4d4f0d1d8d5ba4e210f7da"`,
    );
    await queryRunner.query(`ALTER TABLE "grade_schemes" DROP COLUMN "id_assistant_enrollment"`);
    await queryRunner.query(`ALTER TABLE "grade_schemes" DROP COLUMN "assistant_percentage"`);
  }
}
