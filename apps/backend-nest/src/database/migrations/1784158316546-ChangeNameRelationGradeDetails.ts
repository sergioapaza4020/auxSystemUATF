import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeNameRelationGradeDetails1784158316546 implements MigrationInterface {
  name = 'ChangeNameRelationGradeDetails1784158316546';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" DROP CONSTRAINT "FK_e7613f4d098d80c2ddc695926fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" RENAME COLUMN "id_grade_scheme_item" TO "id_grade_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD CONSTRAINT "FK_21f8fdab52e6b2ba7c0d74c1c51" FOREIGN KEY ("id_grade_item") REFERENCES "grade_items"("id_grade_item") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" DROP CONSTRAINT "FK_21f8fdab52e6b2ba7c0d74c1c51"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" RENAME COLUMN "id_grade_item" TO "id_grade_scheme_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD CONSTRAINT "FK_e7613f4d098d80c2ddc695926fb" FOREIGN KEY ("id_grade_scheme_item") REFERENCES "grade_items"("id_grade_item") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
