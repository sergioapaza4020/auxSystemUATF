import { execFileSync } from 'node:child_process';
import { DataSource, QueryRunner } from 'typeorm';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AttendanceCombinedEnums1794614400000 } from 'src/database/migrations/1794614400000-AttendanceCombinedEnums';
import { AttendanceCombinedPersistence1794614460000 } from 'src/database/migrations/1794614460000-AttendanceCombinedPersistence';
import {
  attendanceSessionComputableSql,
  attendanceAcademicDate,
  isAttendanceSessionComputable,
} from '@common/utils/attendance-session-policy';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceRegistrationMethod as Method } from '@common/enums/attendanceRegistrationMethod';
import { AttendanceStatus as Status } from '@common/enums/attendanceStatus';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendanceCombinedAuthorization } from 'src/entities/attendance/attendance-combined-authorization.entity';
import { AttendancesService } from './attendances.service';
import { AttendanceQrTokenService } from './attendance-qr-token.service';

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
const describePostgres = pgBin ? describe : describe.skip;
const enums = new AttendanceCombinedEnums1794614400000();
const persistence = new AttendanceCombinedPersistence1794614460000();

describePostgres('COMB-2 verified disposable PostgreSQL persistence', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  let runner: QueryRunner | undefined;
  let historical: unknown;
  const window = {
    latitude: -19.57,
    longitude: -65.75,
    radius_meters: 100,
    maximum_accepted_accuracy: 50,
    starts_at: '2026-11-14T14:00Z',
    ends_at: '2026-11-14T15:00Z',
    opened_at: '2026-11-14T13:50Z',
  };
  const query = <T = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<T[]> =>
    (runner ?? source).query(sql, parameters) as Promise<T[]>;
  const history = async () => ({
    sessions: await query('SELECT * FROM attendance_sessions ORDER BY id_attendance_session'),
    marks: await query('SELECT * FROM attendances ORDER BY id_attendance'),
  });
  async function insert(table: string, pk: string, values: Record<string, unknown>) {
    const entries = Object.entries(values);
    const [row] = await query<{ id: number }>(
      `INSERT INTO ${table} (${entries.map(([key]) => `"${key}"`).join(',')})
      VALUES (${entries.map((_, i) => `$${i + 1}`).join(',')}) RETURNING ${pk} AS id`,
      entries.map(([, value]) => value),
    );
    return row.id;
  }
  const session = (values: Record<string, unknown> = {}) =>
    insert('attendance_sessions', 'id_attendance_session', {
      mode: 'GEOLOCATION_QR',
      id_assistant_enrollment: 1,
      date: '2026-11-14',
      ...values,
    });
  const mark = (id: number, values: Record<string, unknown> = {}) =>
    insert('attendances', 'id_attendance', {
      id_attendance_session: id,
      id_enrollment: 2,
      status: 'PRESENT',
      registration_method: 'GEOLOCATION_QR',
      id_marked_by: 2,
      marked_at: '2026-11-14T14:01Z',
      accuracy: 10,
      distance_meters: 5,
      ...values,
    });
  const authorization = (id: number, values: Record<string, unknown> = {}) =>
    insert('attendance_combined_authorizations', 'id_attendance_combined_authorization', {
      id_attendance_session: id,
      id_student_enrollment: 2,
      token_hash: Buffer.alloc(32, 1),
      qr_validated_at: '2026-11-14T14:00Z',
      expires_at: '2026-11-14T14:01:30Z',
      consumed_at: null,
      ...values,
    });
  const event = (id: number, attendance: number, values: Record<string, unknown> = {}) =>
    insert('attendance_audit_events', 'id_attendance_audit_event', {
      id_attendance_session: id,
      id_student_enrollment: 2,
      id_attendance: attendance,
      id_actor: 1,
      operation: 'CREATE',
      new_status: 'PRESENT',
      new_registration_method: 'GEOLOCATION_QR',
      session_state_at_operation: 'OPEN',
      ...values,
    });
  async function rejects(operation: () => Promise<unknown>, code: string) {
    await runner!.query('SAVEPOINT invalid_case');
    try {
      await expect(operation()).rejects.toMatchObject({ driverError: { code } });
    } finally {
      await runner!.query('ROLLBACK TO SAVEPOINT invalid_case');
      await runner!.query('RELEASE SAVEPOINT invalid_case');
    }
  }
  beforeAll(async () => {
    database = await createSeedTestDatabase(pgBin!);
    source = database.source;
    expect(
      await source.query('SELECT current_database() AS database, host(inet_server_addr()) AS host'),
    ).toEqual([{ database: 'postgres', host: '127.0.0.1' }]);
    const migrations = [...source.migrations];
    source.migrations.splice(
      0,
      source.migrations.length,
      ...migrations.filter(
        (m) =>
          !m.constructor.name.startsWith('AttendanceCombined') &&
          !m.constructor.name.startsWith('AttendanceMultipleDailySessions'),
      ),
    );
    expect(await source.runMigrations({ transaction: 'each' })).toHaveLength(22);
    await source.query(`INSERT INTO users (id_user, email, username, password, name, lastname, ci)
      VALUES (1,'comb-a@test.invalid','comb-a','unused','Test','Assistant','comb1'),
      (2,'comb-s@test.invalid','comb-s','unused','Test','Student','comb2'),
      (3,'comb-s2@test.invalid','comb-s2','unused','Test','Student','comb3')`);
    await source.query(
      `INSERT INTO courses (id_course,name,code,"group") VALUES (1,'Test','COMB',1)`,
    );
    await source.query(`INSERT INTO semesters (id_semester,year,semester_number,start_date,end_date)
      VALUES (1,2026,'II','2026-07-01','2026-12-31')`);
    await source.query(`INSERT INTO enrollments (id_enrollment,id_user,id_course,id_semester,role)
      VALUES (1,1,1,1,'ASSISTANT'),(2,2,1,1,'STUDENT'),(3,3,1,1,'STUDENT')`);
    const manual = await session({ mode: 'MANUAL', date: '2026-11-11' });
    const geo = await session({ ...window, mode: 'GEOLOCATION', date: '2026-11-14' });
    const qr = await session({
      mode: 'QR',
      date: '2026-11-13',
      starts_at: '2026-11-13T14:00Z',
      ends_at: '2026-11-13T15:00Z',
      opened_at: '2026-11-13T13:50Z',
    });
    await mark(manual, {
      registration_method: 'MANUAL',
      status: 'EXCUSED',
      marked_at: null,
      id_marked_by: null,
      accuracy: null,
      distance_meters: null,
      observation: 'Historical',
    });
    await mark(geo, { registration_method: 'GEOLOCATION' });
    await mark(qr, { registration_method: 'QR', accuracy: null, distance_meters: null });
    // Leave the test date available, retaining all historical evidence.
    await source.query(
      `UPDATE attendance_sessions SET date='2026-11-12', starts_at='2026-11-12T14:00Z', ends_at='2026-11-12T15:00Z', opened_at='2026-11-12T13:50Z' WHERE id_attendance_session=$1`,
      [geo],
    );
    historical = await history();
    source.migrations.splice(0, source.migrations.length, ...migrations);
  }, 90000);
  afterAll(async () => {
    await database?.close();
  }, 45000);

  it('rejects transaction all before changing the enums', async () => {
    await expect(source.runMigrations()).rejects.toThrow(/transaction mode is "all"/);
    expect(await source.query('SELECT name FROM migrations')).toHaveLength(22);
  });
  it('uses the actual package runner for incremental up, repeat, down/up and preserves historical rows', async () => {
    const options = {
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://seeders_test@127.0.0.1:${database.port}/postgres`,
      },
      windowsHide: true,
      timeout: 60000,
    };
    const run = (file: string) =>
      execFileSync(
        process.execPath,
        [require.resolve('ts-node/dist/bin.js'), '-r', 'tsconfig-paths/register', file],
        options,
      ).toString();
    expect(run('src/database/run-migrations.ts')).toContain('Applied migrations: 3');
    expect(run('src/database/run-migrations.ts')).toContain('Applied migrations: 0');
    expect(await history()).toEqual(historical);
    run('src/database/revert.ts');
    run('src/database/revert.ts');
    run('src/database/revert.ts');
    expect(await history()).toEqual(historical);
    expect(run('src/database/run-migrations.ts')).toContain('Applied migrations: 3');
    const difference = await source.driver.createSchemaBuilder().log();
    expect(difference.upQueries.map((q) => q.query)).toEqual([]);
    expect(
      await query(`SELECT enumlabel FROM pg_enum JOIN pg_type t ON t.oid=enumtypid
      WHERE t.typname='attendance_sessions_mode_enum' ORDER BY enumsortorder`),
    ).toEqual(
      ['MANUAL', 'GEOLOCATION', 'QR', 'GEOLOCATION_QR'].map((enumlabel) => ({ enumlabel })),
    );
    expect(await history()).toEqual(historical);
  }, 180000);

  describe('transactionally rolled back synthetic fixtures', () => {
    beforeEach(async () => {
      runner = source.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
    });
    afterEach(async () => {
      await runner?.rollbackTransaction();
      await runner?.release();
      runner = undefined;
    });

    it.each([
      ['incomplete draft', {}],
      ['configured draft', { ...window, opened_at: null }],
      ['cancelled draft', { cancelled_at: '2026-11-14T13:00Z' }],
      ['scheduled/open', window],
      ['closed', { ...window, closed_at: '2026-11-14T14:30Z' }],
      ['cancelled scheduled', { ...window, cancelled_at: '2026-11-14T13:55Z' }],
    ])('accepts %s', async (_label, values) => {
      expect(await session(values)).toBeGreaterThan(0);
    });
    it.each([
      ['owner', { id_assistant_enrollment: null }],
      ['latitude', { ...window, latitude: null }],
      ['longitude', { ...window, longitude: null }],
      ['radius', { ...window, radius_meters: null }],
      ['accuracy', { ...window, maximum_accepted_accuracy: null }],
      ['start', { ...window, starts_at: null }],
      ['end', { ...window, ends_at: null }],
      ['zero radius', { ...window, radius_meters: 0 }],
      ['zero accuracy', { ...window, maximum_accepted_accuracy: 0 }],
      ['range', { latitude: 91 }],
      ['NaN latitude', { latitude: 'NaN' }],
      ['infinite longitude', { longitude: 'Infinity' }],
      ['infinite start', { starts_at: 'infinity' }],
      ['infinite date', { date: 'infinity' }],
      ['infinite opened', { ...window, opened_at: 'infinity' }],
      ['infinite closed', { ...window, closed_at: 'infinity' }],
      ['infinite cancelled', { cancelled_at: 'infinity' }],
      ['reversed window', { ...window, ends_at: '2026-11-14T13:00Z' }],
      ['wrong local date', { ...window, date: '2026-11-15' }],
      ['late activation', { ...window, opened_at: '2026-11-14T15:00Z' }],
      ['invalid cancellation', { ...window, cancelled_at: '2026-11-14T14:01Z' }],
      ['close without activation', { closed_at: '2026-11-14T14:30Z' }],
    ])('rejects session %s', async (_label, values) => {
      await rejects(() => session(values), _label === 'infinite longitude' ? '22003' : '23514');
    });
    it('enforces responsible FK and allows distinct sessions on the same date', async () => {
      await rejects(() => session({ id_assistant_enrollment: 999 }), '23503');
      const first = await session();
      expect(await session()).not.toBe(first);
    });
    it.each([
      { status: 'ABSENT' },
      { status: 'EXCUSED' },
      { id_attendance_session: null },
      { id_enrollment: null },
      { id_marked_by: null },
      { marked_at: null },
      { marked_at: 'infinity' },
      { accuracy: null },
      { distance_meters: null },
      { accuracy: -1 },
      { distance_meters: -1 },
      { accuracy: 'NaN' },
      { distance_meters: 'NaN' },
      { accuracy: 'Infinity' },
      { distance_meters: '-Infinity' },
    ])('rejects incomplete/nonfinite evidence %j', async (values) => {
      const id = await session(window);
      await rejects(
        () => mark(id, values),
        Object.values(values).some((value) => value === 'Infinity' || value === '-Infinity')
          ? '22003'
          : '23514',
      );
    });
    it('accepts complete evidence, preserves UNIQUE and actor FK', async () => {
      const id = await session(window);
      await mark(id);
      await rejects(() => mark(id), '23505');
      await rejects(() => mark(id, { id_enrollment: 3, id_marked_by: 999 }), '23503');
    });
    it.each(['PRESENT', 'EXCUSED', 'ABSENT'])(
      'allows manual %s without a global reason constraint',
      async (status) => {
        const id = await session(window);
        await mark(id, {
          status,
          registration_method: 'MANUAL',
          observation: null,
          marked_at: null,
          id_marked_by: null,
          accuracy: null,
          distance_meters: null,
        });
      },
    );
    it.each([
      [{ token_hash: null }, '23502'],
      [{ token_hash: Buffer.alloc(0) }, '23514'],
      [{ token_hash: Buffer.alloc(31) }, '23514'],
      [{ expires_at: '2026-11-14T14:00Z' }, '23514'],
      [{ expires_at: '2026-11-14T14:02Z' }, '23514'],
      [{ qr_validated_at: '-infinity' }, '23514'],
      [{ expires_at: 'infinity' }, '23514'],
      [{ consumed_at: 'infinity' }, '23514'],
      [{ consumed_at: '2026-11-14T13:59Z' }, '23514'],
      [{ consumed_at: '2026-11-14T14:01:30Z' }, '23514'],
      [{ id_student_enrollment: 999 }, '23503'],
    ])('rejects authorization %j', async (values, code) => {
      const id = await session(window);
      await rejects(() => authorization(id, values), code);
    });
    it('enforces both authorization UNIQUEs; renewal replaces the hash without creating attendance', async () => {
      const id = await session(window);
      await authorization(id);
      await rejects(() => authorization(id, { token_hash: Buffer.alloc(32, 2) }), '23505');
      await rejects(() => authorization(id, { id_student_enrollment: 3 }), '23505');
      await query(
        'UPDATE attendance_combined_authorizations SET token_hash=$1, qr_validated_at=$2, expires_at=$3 WHERE id_attendance_session=$4',
        [Buffer.alloc(32, 2), '2026-11-14T14:01Z', '2026-11-14T14:02:30Z', id],
      );
      expect(
        await query('SELECT 1 FROM attendance_combined_authorizations WHERE token_hash=$1', [
          Buffer.alloc(32, 1),
        ]),
      ).toHaveLength(0);
      expect(
        await query('SELECT 1 FROM attendances WHERE id_attendance_session=$1', [id]),
      ).toHaveLength(0);
      const auth = await runner!.manager
        .getRepository(AttendanceCombinedAuthorization)
        .findOneByOrFail({ attendanceSession: { idAttendanceSession: id } });
      expect(auth.tokenHash).toBeUndefined();
      await rejects(
        () => query('DELETE FROM attendance_sessions WHERE id_attendance_session=$1', [id]),
        '23503',
      );
    });
    it('accepts consumed authorization and leaves cleanup independent of academic evidence', async () => {
      const id = await session(window);
      await authorization(id, { consumed_at: '2026-11-14T14:01Z' });
      const attendance = await mark(id);
      await event(id, attendance);
      await query('DELETE FROM attendance_combined_authorizations WHERE id_attendance_session=$1', [
        id,
      ]);
      expect(
        await query('SELECT 1 FROM attendances WHERE id_attendance=$1', [attendance]),
      ).toHaveLength(1);
      expect(
        await query('SELECT 1 FROM attendance_audit_events WHERE id_attendance=$1', [attendance]),
      ).toHaveLength(1);
    });
    it('accepts CREATE and UPDATE events without imposing one event per mark', async () => {
      const id = await session(window);
      const attendance = await mark(id);
      await event(id, attendance);
      await event(id, attendance, {
        operation: 'UPDATE',
        previous_status: 'PRESENT',
        previous_registration_method: 'MANUAL',
        new_status: 'EXCUSED',
        new_registration_method: 'MANUAL',
        previous_observation: 'Previous',
        new_observation: 'Correction',
      });
      expect(
        await query('SELECT 1 FROM attendance_audit_events WHERE id_attendance=$1', [attendance]),
      ).toHaveLength(2);
    });
    it.each([
      [{ operation: 'DELETE' }, '23514'],
      [{ operation: 'UPDATE' }, '23514'],
      [{ previous_status: 'PRESENT' }, '23514'],
      [{ previous_observation: 'not empty' }, '23514'],
      [{ new_status: null }, '23502'],
      [{ id_actor: 999 }, '23503'],
      [{ occurred_at: 'infinity' }, '23514'],
      [{ session_state_at_operation: 'DRAFT' }, '23514'],
    ])('rejects audit %j', async (values, code) => {
      const id = await session(window);
      const attendance = await mark(id);
      await rejects(() => event(id, attendance, values), code);
    });
    it.each([
      "UPDATE attendance_audit_events SET new_observation='changed'",
      'DELETE FROM attendance_audit_events',
      'TRUNCATE attendance_audit_events',
    ])('blocks direct mutation: %s', async (sql) => {
      const id = await session(window);
      await event(id, await mark(id));
      await rejects(() => query(sql), '55000');
    });
    it.each([
      'DELETE FROM attendances WHERE id_attendance=$1',
      'DELETE FROM attendance_sessions WHERE id_attendance_session=$1',
      'DELETE FROM enrollments WHERE id_enrollment=$1',
      'DELETE FROM users WHERE id_user=$1',
      'DELETE FROM courses WHERE id_course=$1',
      'DELETE FROM semesters WHERE id_semester=$1',
    ])('blocks parent deletion and historical cascades: %s', async (sql) => {
      const id = await session(window);
      const attendance = await mark(id);
      await event(id, attendance);
      const key = sql.includes('WHERE id_attendance=')
        ? attendance
        : sql.includes('WHERE id_attendance_session=')
          ? id
          : 1;
      await rejects(() => query(sql, [key]), '23503');
      expect(await query('SELECT 1 FROM attendance_audit_events')).toHaveLength(1);
    });
    it.each(['session', 'mark', 'authorization', 'audit'])(
      'blocks both downs before DDL with %s',
      async (kind) => {
        const id = await session(kind === 'session' ? {} : window);
        if (kind === 'mark') await mark(id);
        if (kind === 'authorization') await authorization(id);
        if (kind === 'audit') await event(id, await mark(id));
        for (const migration of [persistence, enums]) {
          await runner!.query('SAVEPOINT down_probe');
          await expect(migration.down(runner!)).rejects.toThrow('COMBINED_ROLLBACK_BLOCKED');
          await runner!.query('ROLLBACK TO SAVEPOINT down_probe');
        }
        expect(await query("SELECT to_regclass('attendance_audit_events') AS name")).toEqual([
          { name: 'attendance_audit_events' },
        ]);
      },
    );
    it('blocks rollback for temporal artifacts and audit even without any combined mode row', async () => {
      await authorization(1);
      await expect(persistence.down(runner!)).rejects.toThrow('COMBINED_ROLLBACK_BLOCKED');
      await query('DELETE FROM attendance_combined_authorizations');
      await event(1, 1, { new_registration_method: 'MANUAL', new_status: 'EXCUSED' });
      await expect(persistence.down(runner!)).rejects.toThrow('COMBINED_ROLLBACK_BLOCKED');
    });
    it('fails safely on unknown external table dependency', async () => {
      await query('CREATE VIEW combined_external_probe AS SELECT * FROM attendance_audit_events');
      await expect(persistence.down(runner!)).rejects.toThrow('COMBINED_ROLLBACK_BLOCKED');
      expect(
        await query("SELECT to_regclass('attendance_combined_authorizations') AS name"),
      ).toEqual([{ name: 'attendance_combined_authorizations' }]);
    });
    it('blocks enum rollback on unknown typed columns and restores all schema changes', async () => {
      await persistence.down(runner!);
      await query(
        'CREATE TABLE combined_external_enum_probe (mode public.attendance_sessions_mode_enum)',
      );
      await expect(enums.down(runner!)).rejects.toThrow('COMBINED_ROLLBACK_BLOCKED');
      expect(
        await query(
          "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname='attendance_sessions_mode_enum' AND enumlabel='GEOLOCATION_QR'",
        ),
      ).toHaveLength(1);
    });
    it('includes closed COMB consistently in both academic policies', async () => {
      const id = await session({ ...window, closed_at: '2026-11-14T14:30Z' });
      await mark(id);
      const loaded = await runner!.manager
        .getRepository(AttendanceSession)
        .findOneByOrFail({ idAttendanceSession: id });
      expect(isAttendanceSessionComputable(loaded, new Date('2026-11-14T16:00Z'))).toBe(true);
      expect(
        await query(
          `SELECT id_attendance_session FROM attendance_sessions session WHERE id_attendance_session=$1 AND ${attendanceSessionComputableSql('session').replaceAll(':attendanceNow', '$2')}`,
          [id, new Date('2026-11-14T16:00Z')],
        ),
      ).toEqual([{ id_attendance_session: id }]);
    });
    it('enables COMB lifecycle and preserves protected evidence in legacy sessions', async () => {
      const api = new AttendancesService(
        runner!.manager.getRepository(AttendanceSession),
        runner!.manager.getRepository(Attendance),
        runner!.manager.getRepository(Enrollment),
      );
      const id = await session();
      await expect(
        api.createSession(1, {
          enrollmentId: 1,
          date: attendanceAcademicDate(new Date()),
          mode: Mode.GEOLOCATION_QR,
        }),
      ).resolves.toMatchObject({ mode: Mode.GEOLOCATION_QR });
      await expect(api.configureGeolocation(1, id, { radiusMeters: 100 })).resolves.toMatchObject({
        state: 'DRAFT',
      });
      await expect(api.activateSession(1, id)).rejects.toThrow('GEO_CONFIGURATION_INCOMPLETE');
      await expect(
        api.checkIn(2, id, { latitude: -19, longitude: -65, accuracy: 1 }),
      ).rejects.toThrow();
      expect(() =>
        new AttendanceQrTokenService().issue(
          Object.assign(new AttendanceSession(), {
            idAttendanceSession: id,
            mode: Mode.GEOLOCATION_QR,
          }),
          new Date(),
        ),
      ).toThrow();
      await mark(1, { id_enrollment: 3 });
      await expect(
        api.saveAttendances(1, 1, { attendances: [{ enrollmentId: 3, status: Status.EXCUSED }] }),
      ).rejects.toThrow();
      await expect(
        api.saveAttendances(1, 1, { markAll: Status.PRESENT, attendances: [] }),
      ).rejects.toThrow();
      await expect(api.deleteSession(1, 1)).rejects.toThrow();
      await expect(api.deleteAttendance(1, 1, 3)).rejects.toThrow();
      expect(
        await query(
          'SELECT registration_method FROM attendances WHERE id_attendance_session=1 AND id_enrollment=3',
        ),
      ).toEqual([{ registration_method: Method.GEOLOCATION_QR }]);
    });
  });
});
