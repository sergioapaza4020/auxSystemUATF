import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivitiesEntity1789015901575 implements MigrationInterface {
  name = 'AddActivitiesEntity1789015901575';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "activities" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_activity" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "activity_date" date NOT NULL, "order" integer NOT NULL, "id_grade_scheme_detail" integer, CONSTRAINT "PK_8bd879b3d37dfbed063cdda0a72" PRIMARY KEY ("id_activity"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_727ff3b915f5b88d1d0cb15374a" FOREIGN KEY ("id_grade_scheme_detail") REFERENCES "grade_scheme_details"("id_grade_scheme_detail") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_727ff3b915f5b88d1d0cb15374a"`,
    );
    await queryRunner.query(`DROP TABLE "activities"`);
  }
}
