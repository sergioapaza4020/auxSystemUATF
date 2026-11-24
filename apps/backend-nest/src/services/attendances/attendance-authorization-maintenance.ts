import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class AttendanceAuthorizationMaintenance
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AttendanceAuthorizationMaintenance.name);
  private timer?: ReturnType<typeof setTimeout>;
  private closing = false;
  private pending?: Promise<number>;
  constructor(
    private readonly source: DataSource,
    private readonly config: ConfigService,
  ) {}

  async sweep(): Promise<number> {
    return this.source.transaction(async (manager) => {
      await manager.query("SET LOCAL statement_timeout = '2000ms'");
      const lock: { acquired: boolean }[] = await manager.query(
        'SELECT pg_try_advisory_xact_lock(17946144,6) AS acquired',
      );
      if (!lock[0]?.acquired) return 0;
      // Same session-first lock order as renewal/check-in; no waits on live sessions.
      // Retain expired/consumed authorizations for 24h. Attendance and append-only audit are untouched.
      const rows: { deleted: number }[] = await manager.query(`
        WITH old AS MATERIALIZED (
          SELECT a.id_attendance_combined_authorization AS id
          FROM attendance_combined_authorizations a
          JOIN attendance_sessions s ON s.id_attendance_session=a.id_attendance_session
          WHERE a.expires_at < clock_timestamp() - interval '24 hours'
          ORDER BY a.expires_at,a.id_attendance_combined_authorization
          LIMIT 100 FOR UPDATE OF s SKIP LOCKED
        )
        , removed AS (DELETE FROM attendance_combined_authorizations a USING old
        WHERE a.id_attendance_combined_authorization=old.id
          AND a.expires_at < clock_timestamp() - interval '24 hours'
        RETURNING a.id_attendance_combined_authorization) SELECT count(*)::int AS deleted FROM removed`);
      return rows[0].deleted;
    });
  }

  onApplicationBootstrap() {
    if (this.config.get<string>('ATTENDANCE_AUTHORIZATION_CLEANUP_ENABLED') !== 'true') return;
    const run = () => {
      if (this.closing) return;
      this.pending = this.sweep();
      void this.pending
        .then((deleted) => this.logger.log(`attendance_authorization_cleanup deleted=${deleted}`))
        .catch(() => this.logger.warn('attendance_authorization_cleanup_failed'))
        .finally(() => {
          if (!this.closing) this.timer = setTimeout(run, 300000);
        });
    };
    run();
  }
  async onApplicationShutdown() {
    this.closing = true;
    if (this.timer) clearTimeout(this.timer);
    await this.pending?.catch(() => undefined);
  }
}
