import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordChangeAttempts1795708800000 implements MigrationInterface {
  name = 'PasswordChangeAttempts1795708800000';

  async up(runner: QueryRunner) {
    await runner.query(`
      CREATE TABLE password_change_attempts (
        id_user integer PRIMARY KEY REFERENCES users(id_user) ON DELETE CASCADE,
        attempts integer NOT NULL,
        expires_at timestamptz NOT NULL
      )
    `);
  }

  async down(runner: QueryRunner) {
    await runner.query('DROP TABLE password_change_attempts');
  }
}
