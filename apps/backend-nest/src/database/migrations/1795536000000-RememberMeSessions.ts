import { MigrationInterface, QueryRunner } from 'typeorm';

export class RememberMeSessions1795536000000 implements MigrationInterface {
  name = 'RememberMeSessions1795536000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "user_sessions" ADD COLUMN "remember_me" BOOLEAN NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Downgrade application code first. Rotated credentials cannot be restored.
    await queryRunner.query('ALTER TABLE "user_sessions" DROP COLUMN "remember_me"');
  }
}
