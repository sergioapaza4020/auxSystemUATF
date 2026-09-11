import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelationsBetweenActivitiesAndGraes1789074562933 implements MigrationInterface {
  name = 'RelationsBetweenActivitiesAndGraes1789074562933';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grades" ADD "id_activity" integer`);
    await queryRunner.query(
      `ALTER TABLE "grades" ADD CONSTRAINT "FK_3ee6200681c2e5b481291c1f50c" FOREIGN KEY ("id_activity") REFERENCES "activities"("id_activity") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grades" DROP CONSTRAINT "FK_3ee6200681c2e5b481291c1f50c"`,
    );
    await queryRunner.query(`ALTER TABLE "grades" DROP COLUMN "id_activity"`);
  }
}
