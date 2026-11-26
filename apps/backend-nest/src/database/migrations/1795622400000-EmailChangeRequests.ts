import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailChangeRequests1795622400000 implements MigrationInterface {
  name = 'EmailChangeRequests1795622400000';

  async up(runner: QueryRunner) {
    await runner.query(`CREATE UNIQUE INDEX users_email_normalized_unique ON users (lower(email))`);
    await runner.query(`
      CREATE TABLE email_change_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        id_user integer NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
        id_session integer NOT NULL,
        new_email varchar(254) NOT NULL,
        old_email varchar NOT NULL,
        token_hash varchar(64) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        invalidated_at timestamptz
      )
    `);
    await runner.query(
      `CREATE INDEX email_change_user_created ON email_change_requests (id_user, created_at)`,
    );
    await runner.query(
      `CREATE INDEX email_change_destination_created ON email_change_requests (new_email, created_at)`,
    );
    await runner.query(`CREATE INDEX email_change_created ON email_change_requests (created_at)`);
    await runner.query(`CREATE UNIQUE INDEX email_change_one_pending ON email_change_requests (id_user)
      WHERE consumed_at IS NULL AND invalidated_at IS NULL`);
  }

  async down(runner: QueryRunner) {
    await runner.query(`DROP TABLE email_change_requests`);
    await runner.query(`DROP INDEX users_email_normalized_unique`);
  }
}
