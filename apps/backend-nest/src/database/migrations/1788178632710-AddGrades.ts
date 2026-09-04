import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGrades1788178632710 implements MigrationInterface {
  name = 'AddGrades1788178632710';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "grades" ("id_grade" SERIAL NOT NULL, "score" numeric(5,2) NOT NULL, "id_enrollment" integer, "id_grade_scheme_detail" integer, CONSTRAINT "PK_5bd2dbb0d11d80321f01c1e5327" PRIMARY KEY ("id_grade"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "grades" ADD CONSTRAINT "FK_421006c2a31cb43a9b1dc59c14f" FOREIGN KEY ("id_enrollment") REFERENCES "enrollments"("id_enrollment") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "grades" ADD CONSTRAINT "FK_44f5853d3d2dfff14ba4baef979" FOREIGN KEY ("id_grade_scheme_detail") REFERENCES "grade_scheme_details"("id_grade_scheme_detail") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grades" DROP CONSTRAINT "FK_44f5853d3d2dfff14ba4baef979"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grades" DROP CONSTRAINT "FK_421006c2a31cb43a9b1dc59c14f"`,
    );
    await queryRunner.query(`DROP TABLE "grades"`);
  }
}
