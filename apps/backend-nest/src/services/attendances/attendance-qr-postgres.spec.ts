import { execFileSync } from 'node:child_process';
import { DataSource } from 'typeorm';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AttendanceQrEnums1794355200000 } from 'src/database/migrations/1794355200000-AttendanceQrEnums';
import { AttendanceQrChecks1794355260000 } from 'src/database/migrations/1794355260000-AttendanceQrChecks';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { attendanceSessionComputableSql } from '@common/utils/attendance-session-policy';

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
const describePostgres = pgBin ? describe : describe.skip;

describePostgres('QR-2B persistence on verified disposable PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  let historical: unknown;
  let previousChecks: unknown;
  let previousColumns: unknown;
  const qrEnums = new AttendanceQrEnums1794355200000();
  const qrChecks = new AttendanceQrChecks1794355260000();
  const window = {
    starts_at: '2026-10-25T14:00:00Z',
    ends_at: '2026-10-25T15:00:00Z',
    opened_at: '2026-10-25T13:50:00Z',
  };

  async function rows<T>(sql: string, parameters?: unknown[]): Promise<T[]> {
    const result: unknown = await source.query(sql, parameters);
    if (!Array.isArray(result)) throw new Error('Expected PostgreSQL rows');
    return result as T[];
  }
  async function insert(table: string, values: Record<string, unknown>) {
    const entries = Object.entries(values);
    return rows<{ id: number }>(
      `INSERT INTO "${table}" (${entries.map(([key]) => `"${key}"`).join(', ')})
       VALUES (${entries.map((_, index) => `$${index + 1}`).join(', ')})
       RETURNING ${table === 'attendance_sessions' ? 'id_attendance_session' : 'id_attendance'} AS id`,
      entries.map(([, value]) => value),
    );
  }
  const session = (values: Record<string, unknown> = {}) =>
    insert('attendance_sessions', {
      mode: 'QR',
      date: '2026-10-25',
      id_assistant_enrollment: 1,
      ...values,
    });
  const mark = (values: Record<string, unknown> = {}) =>
    insert('attendances', {
      registration_method: 'QR',
      status: 'PRESENT',
      id_attendance_session: 1,
      id_enrollment: 2,
      id_marked_by: 2,
      marked_at: '2026-10-25T14:10:00Z',
      ...values,
    });
  const checks = () =>
    rows<{ table: string; name: string; definition: string }>(
      `SELECT conrelid::regclass::text AS table, conname AS name,
       pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conrelid IN ('attendance_sessions'::regclass, 'attendances'::regclass)
       ORDER BY conrelid::regclass::text, conname`,
    );
  const columns = () =>
    rows(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = 'public'
       AND table_name IN ('attendance_sessions', 'attendances') ORDER BY table_name, ordinal_position`,
    );
  const history = async () => ({
    sessions: await rows(
      'SELECT * FROM attendance_sessions WHERE id_attendance_session <= 2 ORDER BY id_attendance_session',
    ),
    marks: await rows('SELECT * FROM attendances WHERE id_attendance <= 2 ORDER BY id_attendance'),
  });
  async function cleanupQrFixtures() {
    if (!source?.isInitialized) return;
    await source.query('DELETE FROM attendances WHERE id_attendance > 2');
    await source.query('DELETE FROM attendance_sessions WHERE id_attendance_session > 2');
  }

  beforeAll(async () => {
    // Helper creates and verifies its own data_directory/port. No app URL or seeds.
    database = await createSeedTestDatabase(pgBin!);
    source = database.source;
    // Keep this historical QR-2B fixture before the later COMB migrations.
    const migrations = source.migrations.filter(
      (migration) =>
        !migration.constructor.name.startsWith('AttendanceCombined') &&
        !migration.constructor.name.startsWith('AttendanceMultipleDailySessions'),
    );
    source.migrations.splice(0, source.migrations.length, ...migrations);
    source.migrations.splice(
      0,
      source.migrations.length,
      ...migrations.filter((migration) => !migration.constructor.name.startsWith('AttendanceQr')),
    );
    expect((await source.runMigrations({ transaction: 'each' })).length).toBe(20);
    source.migrations.splice(0, source.migrations.length, ...migrations);
    await source.query(`INSERT INTO users (id_user, email, username, password, name, lastname, ci)
      VALUES (1, 'assistant@test.invalid', 'qr_assistant', 'unused', 'Test', 'Assistant', 'qr1'),
             (2, 'student@test.invalid', 'qr_student', 'unused', 'Test', 'Student', 'qr2'),
             (3, 'student2@test.invalid', 'qr_student2', 'unused', 'Test', 'Student', 'qr3')`);
    await source.query(
      `INSERT INTO courses (id_course, name, code, "group") VALUES (1, 'Test', 'QRTEST', 1)`,
    );
    await source.query(`INSERT INTO semesters (id_semester, year, semester_number, start_date, end_date)
      VALUES (1, 2026, 'II', '2026-07-01', '2026-12-31')`);
    await source.query(`INSERT INTO enrollments (id_enrollment, id_user, id_course, id_semester, role)
      VALUES (1, 1, 1, 1, 'ASSISTANT'), (2, 2, 1, 1, 'STUDENT'), (3, 3, 1, 1, 'STUDENT')`);
    await insert('attendance_sessions', { date: '2026-10-20', id_assistant_enrollment: 1 });
    await insert('attendance_sessions', {
      mode: 'GEOLOCATION',
      date: '2026-10-21',
      id_assistant_enrollment: 1,
      latitude: -19,
      longitude: -65,
      radius_meters: 100,
      maximum_accepted_accuracy: 50,
      starts_at: '2026-10-21T14:00Z',
      ends_at: '2026-10-21T15:00Z',
      opened_at: '2026-10-21T13:50Z',
    });
    await insert('attendances', {
      status: 'EXCUSED',
      id_attendance_session: 2,
      id_enrollment: 2,
      observation: 'Historical exception',
    });
    await insert('attendances', {
      status: 'PRESENT',
      registration_method: 'GEOLOCATION',
      id_attendance_session: 2,
      id_enrollment: 3,
      id_marked_by: 3,
      marked_at: '2026-10-21T14:10Z',
      accuracy: 10,
      distance_meters: 5,
    });
    historical = await history();
    previousChecks = await checks();
    previousColumns = await columns();
  }, 90000);

  afterAll(async () => {
    await database?.close();
  }, 45000);

  it('refuses default global transaction before changing history or enum values', async () => {
    await expect(source.runMigrations()).rejects.toThrow(/transaction mode is "all"/);
    expect(await rows('SELECT * FROM migrations')).toHaveLength(20);
    await expect(session()).rejects.toMatchObject({ driverError: { code: '22P02' } });
  });

  it('uses the real executor with an intermediate commit and preserves all historical data/columns/CHECKs', async () => {
    expect(
      (await source.runMigrations({ transaction: 'each' })).map((migration) => migration.name),
    ).toEqual([qrEnums.constructor.name, qrChecks.constructor.name]);
    expect(await history()).toEqual(historical);
    expect(await columns()).toEqual(previousColumns);
    expect((await checks()).filter((check) => !check.name.includes('_qr_'))).toEqual(
      previousChecks,
    );
    const enums = await rows<{ typname: string; enumlabel: string }>(
      `SELECT typname, enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid
       WHERE typname IN ('attendance_sessions_mode_enum', 'attendances_registration_method_enum') ORDER BY typname, enumsortorder`,
    );
    expect(enums.map((value) => value.enumlabel)).toEqual([
      'MANUAL',
      'GEOLOCATION',
      'QR',
      'MANUAL',
      'GEOLOCATION',
      'QR',
    ]);
    const tableChecks = await checks();
    for (const entity of [AttendanceSession, Attendance]) {
      for (const check of source
        .getMetadata(entity)
        .checks.filter((value) => value.name?.includes('_qr_'))) {
        expect(tableChecks.some((value) => value.name === check.name)).toBe(true);
      }
    }
  });

  describe('QR CHECKs', () => {
    afterEach(cleanupQrFixtures);

    it('matches the entity CHECK expressions to the migrated PostgreSQL expressions', async () => {
      const runner = source.createQueryRunner();
      try {
        for (const entity of [AttendanceSession, Attendance]) {
          const metadata = source.getMetadata(entity);
          const table = metadata.tableName;
          const temporary = `qr_metadata_${table}`;
          await runner.query(`CREATE TEMP TABLE "${temporary}" (LIKE "public"."${table}")`);
          for (const check of metadata.checks.filter((value) => value.name?.includes('_qr_'))) {
            await runner.query(
              `ALTER TABLE "${temporary}" ADD CONSTRAINT "${check.name}" CHECK (${check.expression})`,
            );
            const expressions: unknown = await runner.query(
              `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
               WHERE conname = $1 AND conrelid IN ($2::regclass, $3::regclass)`,
              [check.name, `public.${table}`, temporary],
            );
            if (!Array.isArray(expressions) || expressions.length !== 2)
              throw new Error('Expected both entity and migration CHECKs');
            expect(expressions[0]).toEqual(expressions[1]);
          }
          await runner.query(`DROP TABLE "${temporary}"`);
        }
      } finally {
        await runner.release();
      }
    });

    it.each([
      ['draft', {}],
      ['partial start', { starts_at: window.starts_at }],
      ['partial end', { ends_at: window.ends_at }],
      ['cancelled draft', { cancelled_at: '2026-10-25T13:00Z' }],
      ['scheduled/open', window],
      ['closed', { ...window, closed_at: '2026-10-25T14:30Z' }],
      ['cancelled scheduled', { ...window, cancelled_at: '2026-10-25T13:55Z' }],
      [
        'local date across UTC midnight',
        {
          starts_at: '2026-10-26T02:00Z',
          ends_at: '2026-10-26T03:00Z',
          opened_at: '2026-10-26T01:50Z',
        },
      ],
    ])('allows %s', async (_name, values) => {
      await expect(session(values)).resolves.toHaveLength(1);
    });

    it.each([
      ['latitude', { latitude: 0 }],
      ['longitude', { longitude: 0 }],
      ['radius', { radius_meters: 1 }],
      ['accuracy config', { maximum_accepted_accuracy: 1 }],
      ['missing assistant', { id_assistant_enrollment: null }],
      ['activated without start', { ...window, starts_at: null }],
      ['activated without end', { ...window, ends_at: null }],
      ['inverted window', { ...window, ends_at: window.starts_at }],
      ['opened at end', { ...window, opened_at: window.ends_at }],
      ['wrong local date', { ...window, date: '2026-10-24' }],
      ['cancelled at start', { ...window, cancelled_at: window.starts_at }],
      ['cancelled before activation', { ...window, cancelled_at: '2026-10-25T13:49Z' }],
      [
        'closed and cancelled',
        { ...window, closed_at: '2026-10-25T14:20Z', cancelled_at: '2026-10-25T13:55Z' },
      ],
      ['closed without activation', { closed_at: '2026-10-25T14:20Z' }],
      ['infinite date', { date: 'infinity' }],
      ...['starts_at', 'ends_at', 'opened_at', 'closed_at', 'cancelled_at'].map(
        (key): [string, Record<string, unknown>] => [`infinite ${key}`, { [key]: 'infinity' }],
      ),
    ])('rejects %s without UNKNOWN bypass', async (_name, values) => {
      await expect(session(values)).rejects.toMatchObject({ driverError: { code: '23514' } });
    });

    it.each([
      ['ABSENT', { status: 'ABSENT' }],
      ['EXCUSED', { status: 'EXCUSED' }],
      ['missing actor', { id_marked_by: null }],
      ['missing time', { marked_at: null }],
      ['infinite time', { marked_at: 'infinity' }],
      ['missing session', { id_attendance_session: null }],
      ['missing enrollment', { id_enrollment: null }],
      ['accuracy', { accuracy: 0 }],
      ['distance', { distance_meters: 0 }],
    ])('rejects QR evidence with %s', async (_name, values) => {
      await expect(mark(values)).rejects.toMatchObject({ driverError: { code: '23514' } });
    });

    it('allows QR evidence and a manual exception in a QR session, preserving UNIQUE and actor FK', async () => {
      const [qr] = await session(window);
      await mark({ id_attendance_session: qr.id });
      await expect(mark({ id_attendance_session: qr.id })).rejects.toMatchObject({
        driverError: { code: '23505', constraint: 'UQ_7880aee9d2b1416261167c83e86' },
      });
      await expect(mark({ id_marked_by: 999 })).rejects.toMatchObject({
        driverError: { code: '23503', constraint: 'FK_attendance_marked_by' },
      });
      await expect(source.query('DELETE FROM users WHERE id_user = 2')).rejects.toMatchObject({
        driverError: { code: '23503' },
      });
      await insert('attendances', {
        id_attendance_session: qr.id,
        id_enrollment: 1,
        status: 'EXCUSED',
      });
      const result = await rows<{ registration_method: string }>(
        'SELECT registration_method FROM attendances WHERE id_attendance_session = $1 ORDER BY id_attendance',
        [qr.id],
      );
      expect(result.map((row) => row.registration_method)).toEqual(['QR', 'MANUAL']);
    });

    it('includes closed QR in both academic counts', async () => {
      const [qr] = await session({ ...window, closed_at: '2026-10-25T14:30Z' });
      await mark({ id_attendance_session: qr.id });
      const sql = attendanceSessionComputableSql('s').replaceAll(':attendanceNow', '$1');
      const result = await rows<{ total: number; present: number }>(
        `SELECT count(DISTINCT s.id_attendance_session)::int AS total,
        count(a.id_attendance) FILTER (WHERE a.status = 'PRESENT')::int AS present
        FROM attendance_sessions s LEFT JOIN attendances a USING (id_attendance_session) WHERE ${sql}`,
        [new Date('2026-10-25T16:00Z')],
      );
      expect(result).toEqual([{ total: 3, present: 2 }]);
    });
  });

  it.each(['session', 'evidence'])(
    'blocks both downs before changing any CHECK when QR %s exists',
    async (kind) => {
      if (kind === 'session') await session();
      else await mark();
      const before = await checks();
      try {
        await expect(source.undoLastMigration({ transaction: 'each' })).rejects.toThrow(
          'QR_ROLLBACK_BLOCKED',
        );
        await expect(
          source.transaction((manager) => qrEnums.down(manager.queryRunner!)),
        ).rejects.toThrow('QR_ROLLBACK_BLOCKED');
        expect(await checks()).toEqual(before);
        expect(await source.showMigrations()).toBe(false);
      } finally {
        await cleanupQrFixtures();
      }
    },
  );

  it('rolls back atomically on an unknown dependent object without dropping it', async () => {
    await source.undoLastMigration({ transaction: 'each' });
    await source.query('CREATE VIEW qr_enum_dependency AS SELECT mode FROM attendance_sessions');
    try {
      await expect(source.undoLastMigration({ transaction: 'each' })).rejects.toThrow();
      expect(await history()).toEqual(historical);
      expect(await checks()).toEqual(previousChecks);
      await expect(source.query('SELECT * FROM qr_enum_dependency')).resolves.toHaveLength(2);
    } finally {
      await source.query('DROP VIEW qr_enum_dependency');
    }
    await source.runMigrations({ transaction: 'each' });
  });

  it('executes down/down/up/up preserving historical evidence, defaults, CHECKs and no orphan enum types', async () => {
    await source.undoLastMigration({ transaction: 'each' });
    await source.undoLastMigration({ transaction: 'each' });
    expect(await history()).toEqual(historical);
    expect(await checks()).toEqual(previousChecks);
    expect(await columns()).toEqual(previousColumns);
    await expect(session()).rejects.toMatchObject({ driverError: { code: '22P02' } });
    expect(await rows("SELECT typname FROM pg_type WHERE typname LIKE '%without_qr%'")).toEqual([]);
    // Exercise the actual CLI/datasource behind migration:run, not just the API.
    // The URL is explicitly the verified cluster created above, never the app URL.
    execFileSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        '-r',
        'tsconfig-paths/register',
        'node_modules/typeorm/cli.js',
        'migration:run',
        '-d',
        'src/database/datasource.ts',
        '--transaction',
        'each',
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: `postgresql://seeders_test@127.0.0.1:${database.port}/postgres`,
        },
        stdio: 'pipe',
        windowsHide: true,
        timeout: 60000,
      },
    );
    expect(await source.showMigrations()).toBe(false);
    await expect(session()).resolves.toHaveLength(1);
    await cleanupQrFixtures();
    expect(await history()).toEqual(historical);
  }, 90000);
});
