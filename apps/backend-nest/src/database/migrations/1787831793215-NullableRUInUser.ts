import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableRUInUser1787831793215 implements MigrationInterface {
  name = 'NullableRUInUser1787831793215';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "ru" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "ru" SET NOT NULL`);
  }
}
