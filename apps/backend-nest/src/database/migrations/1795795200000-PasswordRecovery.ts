import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordRecovery1795795200000 implements MigrationInterface {
  name = 'PasswordRecovery1795795200000';

  async up(runner: QueryRunner) {
    await runner.query(`
      CREATE TABLE password_recovery_requests (
        id uuid PRIMARY KEY,
        id_user integer NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
        email varchar(254) NOT NULL,
        code_digest char(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        expires_at timestamptz NOT NULL,
        state varchar(12) NOT NULL CHECK (state IN ('pending','sent','verified','consumed','invalidated','blocked')),
        attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
        verified_at timestamptz,
        consumed_at timestamptz,
        proof_digest char(64)
      );
      CREATE UNIQUE INDEX password_recovery_one_open ON password_recovery_requests(id_user)
        WHERE state IN ('pending','sent','verified');
      CREATE INDEX password_recovery_expiry ON password_recovery_requests(expires_at);
      CREATE INDEX password_recovery_user_window ON password_recovery_requests(id_user, created_at);
      CREATE TABLE password_recovery_limits (
        bucket char(64) PRIMARY KEY,
        attempts timestamptz[] NOT NULL,
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX password_recovery_limit_expiry ON password_recovery_limits(expires_at);
    `);
  }

  async down(runner: QueryRunner) {
    await runner.query(
      'DROP TABLE password_recovery_limits; DROP TABLE password_recovery_requests',
    );
  }
}
