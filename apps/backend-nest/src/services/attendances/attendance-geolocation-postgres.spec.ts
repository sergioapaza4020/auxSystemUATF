import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { DataSource, QueryRunner } from 'typeorm';
import { AddAttendance1789148941792 } from 'src/database/migrations/1789148941792-AddAttendance';
import { AttendanceExcusedWeight1791655200000 } from 'src/database/migrations/1791655200000-AttendanceExcusedWeight';
import { AttendanceObservation1791662400000 } from 'src/database/migrations/1791662400000-AttendanceObservation';
import { AttendanceGeolocationModel1792886400000 } from 'src/database/migrations/1792886400000-AttendanceGeolocationModel';
import { attendancePostgresEntities } from '../../../test/attendance-postgres.entities';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendancesService } from './attendances.service';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceSessionState as State } from '@common/enums/attendanceSessionState';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import {
  attendanceAcademicDate,
  attendanceSessionComputableSql,
  getAttendanceSessionState,
  isAttendanceSessionComputable,
} from '@common/utils/attendance-session-policy';

// Opt in with ATTENDANCE_TEST_PG_BIN. Never connects to the application database:
// initdb creates a fresh disposable cluster, using an ephemeral localhost port.
const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
const describePostgres = pgBin ? describe : describe.skip;

describePostgres('Attendance GEO model on disposable PostgreSQL', () => {
  let directory: string;
  let started = false;
  let source: DataSource;
  let runner: QueryRunner;
  const migration = new AttendanceGeolocationModel1792886400000();
  const complete = {
    mode: 'GEOLOCATION',
    latitude: '-19.572300',
    longitude: '-65.755000',
    radius_meters: 100,
    maximum_accepted_accuracy: 50,
    starts_at: '2026-10-25T14:00:00Z',
    ends_at: '2026-10-25T15:00:00Z',
    opened_at: '2026-10-25T13:50:00Z',
  };
  const evidence = {
    registration_method: 'GEOLOCATION',
    status: 'PRESENT',
    marked_at: '2026-10-25T14:10:00Z',
    id_marked_by: 2,
    accuracy: '12.50',
    distance_meters: '0.00',
  };

  async function queryRows(
    sql: string,
    parameters?: unknown[],
  ): Promise<Record<string, unknown>[]> {
    const result: unknown = await runner.query(sql, parameters);
    if (
      !Array.isArray(result) ||
      result.some((row: unknown) => typeof row !== 'object' || row === null)
    )
      throw new Error('Expected PostgreSQL rows');
    return result as Record<string, unknown>[];
  }

  async function insert(table: string, fields: Record<string, unknown>) {
    const entries = Object.entries(fields);
    return queryRows(
      `INSERT INTO "${table}" (${entries.map(([key]) => `"${key}"`).join(', ')})
       VALUES (${entries.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
      entries.map(([, value]) => value),
    );
  }
  async function session(fields: Record<string, unknown> = {}) {
    return insert('attendance_sessions', { date: '2026-10-25', ...fields });
  }
  async function mark(fields: Record<string, unknown> = {}) {
    return insert('attendances', { status: 'PRESENT', ...fields });
  }

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'attendance-geo-pg-'));
    const port = await new Promise<number>((accept, reject) => {
      const server = createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') return reject(new Error('No test port'));
        server.close((error) => (error ? reject(error) : accept(address.port)));
      });
    });
    execFileSync(
      join(pgBin!, 'initdb.exe'),
      ['-D', directory, '-U', 'attendance_test', '-A', 'trust', '--no-locale', '--encoding=UTF8'],
      { stdio: 'ignore', windowsHide: true, timeout: 30000 },
    );
    execFileSync(
      join(pgBin!, 'pg_ctl.exe'),
      [
        '-D',
        directory,
        '-l',
        join(directory, 'server.log'),
        '-o',
        `-h 127.0.0.1 -p ${port} -F`,
        '-w',
        'start',
      ],
      { stdio: 'ignore', windowsHide: true, timeout: 30000 },
    );
    started = true;
    source = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port,
      username: 'attendance_test',
      database: 'postgres',
      synchronize: false,
      entities: attendancePostgresEntities,
    });
    await source.initialize();
    runner = source.createQueryRunner();
    await runner.query('CREATE TABLE users (id_user integer PRIMARY KEY)');
    await runner.query('INSERT INTO users VALUES (1), (2)');
    await runner.query('CREATE TABLE enrollments (id_enrollment integer PRIMARY KEY)');
    await runner.query('INSERT INTO enrollments VALUES (1), (2)');
    await runner.query('CREATE TABLE grade_scheme_details (id integer PRIMARY KEY)');
    await new AddAttendance1789148941792().up(runner);
    await new AttendanceExcusedWeight1791655200000().up(runner);
    await new AttendanceObservation1791662400000().up(runner);
    await session({ id_assistant_enrollment: 1 });
    await mark({ id_attendance_session: 1, id_enrollment: 2, observation: 'Historical' });
    await migration.up(runner);
    await runner.query(`ALTER TABLE enrollments ADD id_user integer, ADD id_course integer,
      ADD id_semester integer, ADD role varchar, ADD is_active boolean DEFAULT true`);
    await runner.query('INSERT INTO users VALUES (3), (4)');
    await runner.query(
      "ALTER TABLE users ADD name varchar DEFAULT 'Test', ADD lastname varchar DEFAULT 'Student'",
    );
    await runner.query('CREATE TABLE courses (id_course integer PRIMARY KEY)');
    await runner.query('INSERT INTO courses VALUES (3)');
    await runner.query(
      'CREATE TABLE semesters (id_semester integer PRIMARY KEY, start_date timestamp, end_date timestamp)',
    );
    const year = new Date().getUTCFullYear();
    await runner.query('INSERT INTO semesters VALUES (4, $1, $2)', [
      new Date(Date.UTC(year - 1, 0, 1)),
      new Date(Date.UTC(year + 1, 0, 1)),
    ]);
    await runner.query(
      "INSERT INTO enrollments VALUES (11, 3, 3, 4, 'ASSISTANT', true), (12, 4, 3, 4, 'STUDENT', true)",
    );
    await runner.query(
      'CREATE TABLE grade_schemes (id_grade_scheme integer PRIMARY KEY, id_assistant_enrollment integer, is_active boolean)',
    );
    await runner.query(
      'CREATE TABLE grade_items (id_grade_item integer PRIMARY KEY, name varchar)',
    );
    await runner.query(
      'ALTER TABLE grade_scheme_details ADD id_grade_scheme_detail integer, ADD id_grade_scheme integer, ADD id_grade_item integer',
    );
  }, 60000);

  afterAll(async () => {
    if (runner) await runner.release();
    if (source?.isInitialized) await source.destroy();
    if (started)
      execFileSync(join(pgBin!, 'pg_ctl.exe'), ['-D', directory, '-m', 'immediate', '-w', 'stop'], {
        stdio: 'pipe',
        windowsHide: true,
      });
    if (
      directory &&
      resolve(directory).startsWith(resolve(tmpdir()) + '\\') &&
      directory.includes('attendance-geo-pg-')
    )
      rmSync(directory, { recursive: true, force: true });
  }, 30000);

  it('backfills only MANUAL defaults and preserves IDs, status and historical evidence nulls', async () => {
    const [storedSession] = await queryRows(
      'SELECT * FROM attendance_sessions WHERE id_attendance_session = 1',
    );
    expect(storedSession).toMatchObject({
      id_attendance_session: 1,
      mode: 'MANUAL',
      latitude: null,
      longitude: null,
      radius_meters: null,
      maximum_accepted_accuracy: null,
      starts_at: null,
      ends_at: null,
      opened_at: null,
      closed_at: null,
      cancelled_at: null,
    });
    const [storedMark] = await queryRows('SELECT * FROM attendances WHERE id_attendance = 1');
    expect(storedMark).toMatchObject({
      id_attendance: 1,
      registration_method: 'MANUAL',
      status: 'PRESENT',
      observation: 'Historical',
      marked_at: null,
      id_marked_by: null,
      accuracy: null,
      distance_meters: null,
    });
  });

  it('accepts the old session fields and all manual statuses with null evidence', async () => {
    const [created] = await session({ id_assistant_enrollment: 1, date: '2026-10-26' });
    expect(created.mode).toBe('MANUAL');
    for (const status of ['PRESENT', 'EXCUSED', 'ABSENT']) {
      const [createdMark] = await mark({
        status,
        observation: status === 'EXCUSED' ? 'Permiso' : null,
      });
      expect(createdMark).toMatchObject({
        registration_method: 'MANUAL',
        marked_at: null,
        id_marked_by: null,
      });
    }
  });

  it('keeps database types, nullable legacy FKs and the original status enum', async () => {
    const columns = await queryRows(
      "SELECT table_name, column_name, data_type, is_nullable, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('attendance_sessions', 'attendances')",
    );
    const column = (table: string, name: string) =>
      columns.find((row) => row.table_name === table && row.column_name === name);
    expect(column('attendance_sessions', 'date')).toMatchObject({ data_type: 'date' });
    for (const name of ['starts_at', 'ends_at', 'opened_at', 'closed_at', 'cancelled_at'])
      expect(column('attendance_sessions', name)).toMatchObject({
        data_type: 'timestamp with time zone',
        is_nullable: 'YES',
      });
    expect(column('attendance_sessions', 'latitude')).toMatchObject({
      numeric_precision: 9,
      numeric_scale: 6,
    });
    expect(column('attendance_sessions', 'longitude')).toMatchObject({
      numeric_precision: 10,
      numeric_scale: 6,
    });
    for (const name of ['accuracy', 'distance_meters'])
      expect(column('attendances', name)).toMatchObject({
        numeric_precision: 10,
        numeric_scale: 2,
        is_nullable: 'YES',
      });
    for (const [table, name] of [
      ['attendance_sessions', 'id_assistant_enrollment'],
      ['attendances', 'id_attendance_session'],
      ['attendances', 'id_enrollment'],
    ])
      expect(column(table, name)).toMatchObject({ data_type: 'integer', is_nullable: 'YES' });
    const statuses = await queryRows(
      "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = 'attendances_status_enum'",
    );
    expect(statuses.map((row) => row.enumlabel).sort()).toEqual(['ABSENT', 'EXCUSED', 'PRESENT']);
  });

  it('allows incomplete GEO drafts, boundary coordinates and scheduled cancellation', async () => {
    await expect(session({ mode: 'GEOLOCATION' })).resolves.toBeDefined();
    await expect(
      session({ mode: 'GEOLOCATION', latitude: 90, longitude: -180 }),
    ).resolves.toBeDefined();
    await expect(
      session({ ...complete, cancelled_at: '2026-10-25T13:55:00Z' }),
    ).resolves.toBeDefined();
    await expect(
      session({ ...complete, closed_at: '2026-10-25T14:30:00Z' }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['latitude', 91, 'latitude'],
    ['latitude', -91, 'latitude'],
    ['longitude', 181, 'longitude'],
    ['longitude', -181, 'longitude'],
    ['radius_meters', 0, 'radius'],
    ['radius_meters', -1, 'radius'],
    ['maximum_accepted_accuracy', 0, 'maximum_accuracy'],
    ['maximum_accepted_accuracy', -1, 'maximum_accuracy'],
    ['ends_at', '2026-10-25T14:00:00Z', 'window'],
    ['ends_at', '2026-10-25T13:59:00Z', 'window'],
  ])('rejects invalid %s = %s', async (field, value, constraint) => {
    await expect(session({ ...complete, [field]: value })).rejects.toMatchObject({
      code: '23514',
      constraint: `CHK_attendance_session_${constraint}`,
    });
  });

  it.each([
    'latitude',
    'longitude',
    'radius_meters',
    'maximum_accepted_accuracy',
    'starts_at',
    'ends_at',
  ])('requires %s when GEO is activated', async (field) => {
    await expect(session({ ...complete, [field]: null })).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_attendance_session_geo_configuration',
    });
  });

  it.each([
    [{ mode: 'GEOLOCATION', closed_at: '2026-10-25T14:30:00Z' }, 'closed_opened'],
    [
      { ...complete, closed_at: '2026-10-25T14:30:00Z', cancelled_at: '2026-10-25T13:55:00Z' },
      'closed_cancelled',
    ],
    [
      { ...complete, opened_at: '2026-10-25T14:10:00Z', closed_at: '2026-10-25T14:05:00Z' },
      'closed_opened',
    ],
    [{ ...complete, closed_at: '2026-10-25T13:55:00Z' }, 'closed_start'],
    [{ ...complete, closed_at: '2026-10-25T15:00:00Z' }, 'closed_end'],
    [{ latitude: 0 }, 'manual_fields'],
  ])('rejects incompatible lifecycle fields %#', async (fields, constraint) => {
    await expect(session(fields)).rejects.toMatchObject({
      code: '23514',
      constraint: `CHK_attendance_session_${constraint}`,
    });
  });

  it.each(['marked_at', 'id_marked_by', 'accuracy', 'distance_meters'])(
    'requires GEO evidence %s',
    async (field) => {
      await expect(mark({ ...evidence, [field]: null })).rejects.toMatchObject({
        code: '23514',
        constraint: 'CHK_attendance_geo_evidence',
      });
    },
  );

  it.each(['ABSENT', 'EXCUSED'])('rejects GEO status %s', async (status) => {
    await expect(mark({ ...evidence, status })).rejects.toMatchObject({
      code: '23514',
      constraint: 'CHK_attendance_geo_status',
    });
  });

  it.each(['accuracy', 'distance_meters'])('rejects negative and NaN %s', async (field) => {
    for (const value of [-1, 'NaN'])
      await expect(mark({ ...evidence, [field]: value })).rejects.toMatchObject({ code: '23514' });
  });

  it('stores numeric evidence as strings, allows zero accuracy, and preserves actor FK', async () => {
    const [record] = await mark({ ...evidence, accuracy: 0 });
    expect(record.accuracy).toBe('0.00');
    expect(record.distance_meters).toBe('0.00');
    await expect(runner.query('DELETE FROM users WHERE id_user = 2')).rejects.toMatchObject({
      code: '23503',
      constraint: 'FK_attendance_marked_by',
    });
    await expect(mark({ ...evidence, id_marked_by: 999 })).rejects.toMatchObject({ code: '23503' });
  });

  it('preserves unique constraints and historical nullable FKs', async () => {
    await expect(session({ id_assistant_enrollment: 1 })).rejects.toMatchObject({ code: '23505' });
    await expect(mark({ id_attendance_session: 1, id_enrollment: 2 })).rejects.toMatchObject({
      code: '23505',
    });
    await expect(mark()).resolves.toBeDefined();
  });

  function service() {
    return new AttendancesService(
      source.getRepository(AttendanceSession),
      source.getRepository(Attendance),
      source.getRepository(Enrollment),
    );
  }

  async function lifecycleContext(index: number) {
    const id = 100 + index;
    await runner.query('INSERT INTO users(id_user) VALUES ($1)', [id]);
    await runner.query("INSERT INTO enrollments VALUES ($1, $1, 3, 4, 'ASSISTANT', true)", [id]);
    const api = service();
    const draft = await api.createSession(id, {
      enrollmentId: id,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.GEOLOCATION,
    });
    await api.configureGeolocation(id, draft.idAttendanceSession, {
      latitude: -19.5723,
      longitude: -65.755,
      radiusMeters: 100,
      maximumAcceptedAccuracy: 50,
      startsAt: new Date(Date.now() + 300000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
    });
    return { api, id, sessionId: draft.idAttendanceSession };
  }

  it('creates MANUAL through the unchanged service contract and preserves default semantics', async () => {
    await runner.query('INSERT INTO users(id_user) VALUES (106)');
    await runner.query("INSERT INTO enrollments VALUES (106, 106, 3, 4, 'ASSISTANT', true)");
    const created = await service().createSession(106, {
      enrollmentId: 106,
      date: attendanceAcademicDate(new Date()),
    });
    expect(created.mode).toBe(Mode.MANUAL);
    expect(isAttendanceSessionComputable(created, new Date())).toBe(true);
    expect(getAttendanceSessionState(created, new Date())).toBeNull();
  });

  it('serializes concurrent activation and close with real row locks', async () => {
    const f = await lifecycleContext(1);
    const activation = await Promise.allSettled([
      f.api.activateSession(f.id, f.sessionId, true),
      f.api.activateSession(f.id, f.sessionId, true),
    ]);
    expect(activation.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(activation.filter((value) => value.status === 'rejected')).toHaveLength(1);
    const closing = await Promise.allSettled([
      f.api.closeSession(f.id, f.sessionId),
      f.api.closeSession(f.id, f.sessionId),
    ]);
    expect(closing.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    const stored = await source
      .getRepository(AttendanceSession)
      .findOneByOrFail({ idAttendanceSession: f.sessionId });
    expect(getAttendanceSessionState(stored, new Date())).toBe(State.CLOSED);
    expect(stored.closedAt).not.toBeNull();
  });

  it('serializes activation against cancellation without invalidating the schedule', async () => {
    const f = await lifecycleContext(2);
    await Promise.allSettled([
      f.api.activateSession(f.id, f.sessionId),
      f.api.cancelSession(f.id, f.sessionId),
    ]);
    const stored = await source
      .getRepository(AttendanceSession)
      .findOneByOrFail({ idAttendanceSession: f.sessionId });
    expect(getAttendanceSessionState(stored, new Date())).toBe(State.CANCELLED);
    expect(stored.closedAt).toBeNull();
    expect(isAttendanceSessionComputable(stored, new Date())).toBe(false);
  });

  it('serializes configuration against activation and freezes the resulting rules', async () => {
    const f = await lifecycleContext(3);
    await Promise.allSettled([
      f.api.configureGeolocation(f.id, f.sessionId, { radiusMeters: 150 }),
      f.api.activateSession(f.id, f.sessionId),
    ]);
    const stored = await source
      .getRepository(AttendanceSession)
      .findOneByOrFail({ idAttendanceSession: f.sessionId });
    expect(getAttendanceSessionState(stored, new Date())).toBe(State.SCHEDULED);
    expect([100, 150]).toContain(stored.radiusMeters);
    await expect(
      f.api.configureGeolocation(f.id, f.sessionId, { radiusMeters: 200 }),
    ).rejects.toThrow('SESSION_ALREADY_ACTIVATED');
  });

  it('matches SQL to the pure policy and protects both academic numerator and denominator', async () => {
    const now = new Date();
    const day = (offset: number) => new Date(now.getTime() + offset * 86400000);
    const base = {
      ...complete,
      id_assistant_enrollment: 11,
      starts_at: day(-5),
      ends_at: new Date(day(-5).getTime() + 3600000),
      opened_at: new Date(day(-5).getTime() - 1000),
      date: attendanceAcademicDate(day(-5)),
    };
    const cases = [
      { date: attendanceAcademicDate(day(-6)), id_assistant_enrollment: 11 },
      {
        ...base,
        date: attendanceAcademicDate(day(-4)),
        starts_at: day(-4),
        ends_at: new Date(day(-4).getTime() + 3600000),
        opened_at: null,
      },
      {
        ...base,
        date: attendanceAcademicDate(day(1)),
        starts_at: day(1),
        ends_at: day(2),
        opened_at: now,
      },
      {
        ...base,
        date: attendanceAcademicDate(new Date(now.getTime() - 3600000)),
        starts_at: new Date(now.getTime() - 3600000),
        ends_at: day(1),
        opened_at: new Date(now.getTime() - 7200000),
      },
      base,
      {
        ...base,
        date: attendanceAcademicDate(day(-3)),
        starts_at: day(-3),
        ends_at: day(-2),
        opened_at: day(-4),
        cancelled_at: new Date(day(-4).getTime() + 1000),
      },
    ];
    const ids: number[] = [];
    for (const fields of cases) {
      const [created] = await session(fields);
      ids.push(Number(created.id_attendance_session));
    }
    for (const index of [0, 2, 3, 5])
      await mark({
        id_attendance_session: ids[index],
        id_enrollment: 12,
        status: index === 2 ? 'EXCUSED' : 'PRESENT',
      });
    const rows = await source.getRepository(AttendanceSession).find({
      where: { assistantEnrollment: { idEnrollment: 11 } },
    });
    const [sql, parameters] = source
      .getRepository(AttendanceSession)
      .createQueryBuilder('session')
      .where('session.id_assistant_enrollment = :id', { id: 11 })
      .andWhere(attendanceSessionComputableSql('session'), { attendanceNow: now })
      .getQueryAndParameters();
    const sqlRows = await queryRows(sql, parameters);
    expect(sqlRows.map((row) => Number(row.session_id_attendance_session)).sort()).toEqual(
      rows
        .filter((row) => isAttendanceSessionComputable(row, now))
        .map((row) => row.idAttendanceSession)
        .sort(),
    );
    expect(await service().getStudentAttendance(3, 12)).toMatchObject({
      totalSessions: 2,
      presentSessions: 1,
      excusedSessions: 0,
      absentSessions: 1,
      percentage: 50,
    });
    // Closing the ongoing session makes its pre-existing manual mark count.
    await service().closeSession(3, ids[3]);
    expect(await service().getStudentAttendance(3, 12)).toMatchObject({
      totalSessions: 3,
      presentSessions: 2,
      excusedSessions: 0,
      absentSessions: 1,
    });
    const open = await service().getSessionPage(3, ids[2], { page: 1, limit: 10 });
    expect(open.data).toMatchObject({
      state: State.SCHEDULED,
      absentCount: 0,
      isComputable: false,
    });
  });

  it('rejects manual markAll over GEO evidence and preserves its actor and values', async () => {
    const f = await lifecycleContext(4);
    await f.api.activateSession(f.id, f.sessionId, true);
    await mark({ ...evidence, id_attendance_session: f.sessionId, id_enrollment: 12 });
    await expect(
      f.api.saveAttendances(f.id, f.sessionId, {
        markAll: AttendanceStatus.PRESENT,
        attendances: [],
      }),
    ).rejects.toThrow('SESSION_HAS_GEO_EVIDENCE');
    await expect(
      f.api.saveAttendances(f.id, f.sessionId, {
        attendances: [{ enrollmentId: 12, status: AttendanceStatus.ABSENT }],
      }),
    ).rejects.toThrow('No se puede sobrescribir evidencia');
    const [stored] = await queryRows(
      'SELECT registration_method, id_marked_by FROM attendances WHERE id_attendance_session = $1',
      [f.sessionId],
    );
    expect(stored).toEqual({ registration_method: 'GEOLOCATION', id_marked_by: 2 });
  });

  it('shows pending rather than absent while OPEN and consolidates EXCUSED only after closure', async () => {
    const f = await lifecycleContext(5);
    await f.api.activateSession(f.id, f.sessionId, true);
    expect(
      (await f.api.getSessionPage(f.id, f.sessionId, { page: 1, limit: 10 })).data,
    ).toMatchObject({
      state: State.OPEN,
      totalStudents: 1,
      presentCount: 0,
      excusedCount: 0,
      pendingCount: 1,
      absentCount: 0,
      percentage: 0,
    });
    await f.api.saveAttendances(f.id, f.sessionId, {
      attendances: [
        { enrollmentId: 12, status: AttendanceStatus.EXCUSED, observation: 'Manual exception' },
      ],
    });
    expect(await f.api.getStudentAttendance(f.id, 12)).toMatchObject({
      totalSessions: 0,
      presentSessions: 0,
      excusedSessions: 0,
      absentSessions: 0,
      percentage: 0,
    });
    await f.api.closeSession(f.id, f.sessionId);
    expect(await f.api.getStudentAttendance(f.id, 12)).toMatchObject({
      totalSessions: 1,
      presentSessions: 0,
      excusedSessions: 1,
      absentSessions: 0,
      percentage: 100,
    });
    await expect(f.api.getMyStudentAttendance(4, 12)).rejects.toThrow('único auxiliar');
  });

  const studentLocation = { latitude: -19.5723, longitude: -65.755, accuracy: 20 };
  async function studentContext(index: number) {
    const value = await lifecycleContext(index);
    await value.api.activateSession(value.id, value.sessionId, true);
    return value;
  }

  it('inserts private GEO evidence and counts it academically only after CLOSED', async () => {
    const f = await studentContext(10);
    const result = await f.api.checkIn(4, f.sessionId, studentLocation);
    expect(result).toMatchObject({
      code: 'SUCCESS',
      status: 'PRESENT',
      registrationMethod: 'GEOLOCATION',
    });
    expect(Object.keys(result).sort()).toEqual([
      'code',
      'idAttendance',
      'markedAt',
      'registrationMethod',
      'status',
    ]);
    const [stored] = await queryRows('SELECT * FROM attendances WHERE id_attendance = $1', [
      result.idAttendance,
    ]);
    expect(stored).toMatchObject({
      id_attendance_session: f.sessionId,
      id_enrollment: 12,
      status: 'PRESENT',
      registration_method: 'GEOLOCATION',
      id_marked_by: 4,
      accuracy: '20.00',
      distance_meters: '0.00',
      marked_at: result.markedAt,
    });
    expect(stored).not.toHaveProperty('latitude');
    expect(stored).not.toHaveProperty('longitude');
    expect(await f.api.getStudentAttendance(f.id, 12)).toMatchObject({
      totalSessions: 0,
      presentSessions: 0,
      percentage: 0,
    });
    await f.api.closeSession(f.id, f.sessionId);
    expect(await f.api.getStudentAttendance(f.id, 12)).toMatchObject({
      totalSessions: 1,
      presentSessions: 1,
      percentage: 100,
    });
    await expect(f.api.checkIn(4, f.sessionId, studentLocation)).rejects.toMatchObject({
      response: { code: 'SESSION_CLOSED' },
      status: 409,
    });
  });

  it('rejects outside area and insufficient accuracy, accepting the exact accuracy limit', async () => {
    const f = await studentContext(11);
    await expect(
      f.api.checkIn(4, f.sessionId, { ...studentLocation, longitude: -65 }),
    ).rejects.toMatchObject({ response: { code: 'OUTSIDE_AREA' }, status: 422 });
    await expect(
      f.api.checkIn(4, f.sessionId, { ...studentLocation, accuracy: 50.01 }),
    ).rejects.toMatchObject({ response: { code: 'LOW_ACCURACY' }, status: 422 });
    expect(
      await source
        .getRepository(Attendance)
        .countBy({ attendanceSession: { idAttendanceSession: f.sessionId } }),
    ).toBe(0);
    await f.api.checkIn(4, f.sessionId, { ...studentLocation, accuracy: 50 });
    await expect(f.api.checkIn(4, f.sessionId, studentLocation)).rejects.toMatchObject({
      response: { code: 'ALREADY_REGISTERED' },
      status: 409,
    });
  });

  it.each(['PRESENT', 'EXCUSED', 'ABSENT'])(
    'preserves a prior MANUAL %s as a write-once boundary',
    async (status) => {
      const f = await studentContext(12 + ['PRESENT', 'EXCUSED', 'ABSENT'].indexOf(status));
      await mark({ id_attendance_session: f.sessionId, id_enrollment: 12, status });
      await expect(f.api.checkIn(4, f.sessionId, studentLocation)).rejects.toMatchObject({
        response: { code: 'ALREADY_REGISTERED' },
        status: 409,
      });
      const [stored] = await queryRows(
        'SELECT status, registration_method, marked_at FROM attendances WHERE id_attendance_session = $1',
        [f.sessionId],
      );
      expect(stored).toEqual({ status, registration_method: 'MANUAL', marked_at: null });
    },
  );

  it('serializes two simultaneous check-ins into exactly one insert', async () => {
    const f = await studentContext(15);
    const results = await Promise.allSettled([
      f.api.checkIn(4, f.sessionId, studentLocation),
      f.api.checkIn(4, f.sessionId, studentLocation),
    ]);
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((value) => value.status === 'rejected')).toMatchObject({
      reason: { response: { code: 'ALREADY_REGISTERED' }, status: 409 },
    });
    expect(
      await source
        .getRepository(Attendance)
        .countBy({ attendanceSession: { idAttendanceSession: f.sessionId } }),
    ).toBe(1);
  });

  it('serializes check-in against close without creating a mark after closure', async () => {
    const f = await studentContext(16);
    const results = await Promise.allSettled([
      f.api.checkIn(4, f.sessionId, studentLocation),
      f.api.closeSession(f.id, f.sessionId),
    ]);
    expect(results[1].status).toBe('fulfilled');
    const count = await source
      .getRepository(Attendance)
      .countBy({ attendanceSession: { idAttendanceSession: f.sessionId } });
    if (results[0].status === 'fulfilled') expect(count).toBe(1);
    else {
      expect(results[0]).toMatchObject({ reason: { response: { code: 'SESSION_CLOSED' } } });
      expect(count).toBe(0);
    }
    const stored = await source
      .getRepository(AttendanceSession)
      .findOneByOrFail({ idAttendanceSession: f.sessionId });
    expect(getAttendanceSessionState(stored, new Date())).toBe(State.CLOSED);
  });

  it('serializes check-in against markAll without overwriting either decision', async () => {
    const f = await studentContext(17);
    const results = await Promise.allSettled([
      f.api.checkIn(4, f.sessionId, studentLocation),
      f.api.saveAttendances(f.id, f.sessionId, {
        markAll: AttendanceStatus.PRESENT,
        attendances: [],
      }),
    ]);
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    const [stored] = await queryRows(
      'SELECT registration_method, id_marked_by FROM attendances WHERE id_attendance_session = $1',
      [f.sessionId],
    );
    if (results[0].status === 'fulfilled') {
      expect(results[1]).toMatchObject({ reason: { message: 'SESSION_HAS_GEO_EVIDENCE' } });
      expect(stored).toEqual({ registration_method: 'GEOLOCATION', id_marked_by: 4 });
    } else {
      expect(results[0]).toMatchObject({ reason: { response: { code: 'ALREADY_REGISTERED' } } });
      expect(stored).toEqual({ registration_method: 'MANUAL', id_marked_by: f.id });
    }
  });

  it('serializes check-in against an individual manual correction without overwriting either origin', async () => {
    const f = await studentContext(25);
    const results = await Promise.allSettled([
      f.api.checkIn(4, f.sessionId, studentLocation),
      f.api.saveAttendances(f.id, f.sessionId, {
        attendances: [
          { enrollmentId: 12, status: AttendanceStatus.EXCUSED, observation: 'Test exception' },
        ],
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const stored = await source.getRepository(Attendance).find({
      where: {
        attendanceSession: { idAttendanceSession: f.sessionId },
        enrollment: { idEnrollment: 12 },
      },
    });
    expect(stored).toHaveLength(1);
    if (results[0].status === 'fulfilled') {
      expect(stored[0]).toMatchObject({ status: 'PRESENT', registrationMethod: 'GEOLOCATION' });
      expect(results[1]).toMatchObject({ status: 'rejected' });
    } else {
      expect(stored[0]).toMatchObject({ status: 'EXCUSED', registrationMethod: 'MANUAL' });
      expect(results[0]).toMatchObject({ reason: { response: { code: 'ALREADY_REGISTERED' } } });
    }
  });

  it('uses unrounded real Haversine metres on both sides of the geofence boundary', async () => {
    const f = await lifecycleContext(26);
    await f.api.configureGeolocation(f.id, f.sessionId, { latitude: 0, longitude: 0 });
    await f.api.activateSession(f.id, f.sessionId, true);
    // On the equator, arc length = R * angle. These two distances round to 100.00.
    const longitude = (metres: number) => (metres / 6_371_000) * (180 / Math.PI);
    await expect(
      f.api.checkIn(4, f.sessionId, { latitude: 0, longitude: longitude(100.004), accuracy: 50 }),
    ).rejects.toMatchObject({ response: { code: 'OUTSIDE_AREA' } });
    expect(
      await source
        .getRepository(Attendance)
        .countBy({ attendanceSession: { idAttendanceSession: f.sessionId } }),
    ).toBe(0);
    await f.api.checkIn(4, f.sessionId, {
      latitude: 0,
      longitude: longitude(99.996),
      accuracy: 50,
    });
    const stored = await source
      .getRepository(Attendance)
      .findOneByOrFail({ attendanceSession: { idAttendanceSession: f.sessionId } });
    expect(stored.distanceMeters).toBe('100.00');
    expect(stored.accuracy).toBe('50.00');
  });

  it('rechecks server time after a real lock wait that crosses endsAt', async () => {
    const f = await studentContext(27);
    const blocker = source.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    let operation: Promise<unknown> | undefined;
    try {
      const now = Date.now();
      const end = new Date(now + 400);
      await blocker.query(
        `UPDATE attendance_sessions SET starts_at = $1, opened_at = $1, ends_at = $2, date = $3 WHERE id_attendance_session = $4`,
        [new Date(now - 60000), end, attendanceAcademicDate(new Date(now - 60000)), f.sessionId],
      );
      // UPDATE retains the same row lock used by lifecycle and check-in.
      operation = f.api.checkIn(4, f.sessionId, studentLocation);
      const outcome = operation.then(
        (value) => ({ value }),
        (reason: unknown) => ({ reason }),
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, end.getTime() - Date.now() + 100)),
      );
      await blocker.commitTransaction();
      expect(await outcome).toMatchObject({ reason: { response: { code: 'SESSION_CLOSED' } } });
      expect(
        await source
          .getRepository(Attendance)
          .countBy({ attendanceSession: { idAttendanceSession: f.sessionId } }),
      ).toBe(0);
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      await blocker.release();
      if (operation) await operation.catch(() => undefined);
    }
  });

  it('rejects users without an active STUDENT enrollment in this exact course and semester', async () => {
    const f = await studentContext(18);
    await runner.query('INSERT INTO courses VALUES (4)');
    await runner.query(
      'INSERT INTO semesters SELECT 5, start_date, end_date FROM semesters WHERE id_semester = 4',
    );
    for (const [id, course, semester, active, role] of [
      [300, 4, 4, true, 'STUDENT'],
      [301, 3, 5, true, 'STUDENT'],
      [302, 3, 4, false, 'STUDENT'],
      [303, 3, 4, true, 'ASSISTANT'],
    ]) {
      await runner.query('INSERT INTO users(id_user) VALUES ($1)', [id]);
      await runner.query('INSERT INTO enrollments VALUES ($1, $1, $2, $3, $4, $5)', [
        id,
        course,
        semester,
        role,
        active,
      ]);
      await expect(f.api.checkIn(Number(id), f.sessionId, studentLocation)).rejects.toMatchObject({
        response: { code: 'NOT_ENROLLED' },
        status: 403,
      });
    }
    await expect(f.api.checkIn(9999, f.sessionId, studentLocation)).rejects.toMatchObject({
      response: { code: 'NOT_ENROLLED' },
      status: 403,
    });
    // Multiple assistant enrollments exist in this database; an explicit session
    // still resolves the student's course/semester without choosing an assistant.
    await expect(f.api.checkIn(4, f.sessionId, studentLocation)).resolves.toMatchObject({
      code: 'SUCCESS',
    });
  });

  it('returns only relevant own sessions and own marks, never the auxiliary projection', async () => {
    const open = await studentContext(19);
    const scheduled = await lifecycleContext(20);
    await scheduled.api.activateSession(scheduled.id, scheduled.sessionId);
    const draft = await lifecycleContext(21);
    const cancelled = await lifecycleContext(22);
    await cancelled.api.cancelSession(cancelled.id, cancelled.sessionId);
    const distant = await lifecycleContext(23);
    await distant.api.configureGeolocation(distant.id, distant.sessionId, {
      startsAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      endsAt: new Date(Date.now() + 49 * 3600000).toISOString(),
    });
    await distant.api.activateSession(distant.id, distant.sessionId);
    await runner.query('INSERT INTO users(id_user) VALUES (500)');
    await runner.query("INSERT INTO enrollments VALUES (500, 500, 3, 4, 'STUDENT', true)");
    await mark({ id_attendance_session: open.sessionId, id_enrollment: 500, status: 'EXCUSED' });
    const own = await open.api.getOwnEligibleSessions(4, 12);
    expect(own.data.find((row) => row.idAttendanceSession === open.sessionId)).toMatchObject({
      state: State.OPEN,
      alreadyRegistered: false,
      ownStatus: null,
      ownMarkedAt: null,
    });
    expect(own.data.some((row) => row.idAttendanceSession === scheduled.sessionId)).toBe(true);
    for (const id of [draft.sessionId, cancelled.sessionId, distant.sessionId])
      expect(own.data.some((row) => row.idAttendanceSession === id)).toBe(false);
    expect(JSON.stringify(own)).not.toMatch(
      /latitude|longitude|radiusMeters|maximumAcceptedAccuracy|assistantEnrollment|permissions|roles/,
    );
    await open.api.checkIn(4, open.sessionId, studentLocation);
    expect(
      (await open.api.getOwnEligibleSessions(4, 12)).data.find(
        (row) => row.idAttendanceSession === open.sessionId,
      ),
    ).toMatchObject({ alreadyRegistered: true, ownStatus: 'PRESENT' });
    await expect(open.api.getOwnEligibleSessions(4, 500)).rejects.toMatchObject({
      response: { code: 'NOT_ENROLLED' },
      status: 403,
    });
    expect((await open.api.getOwnEligibleSessions(300, 300)).data).toEqual([]);
    expect((await open.api.getOwnEligibleSessions(301, 301)).data).toEqual([]);
  });

  it('rejects inactive auxiliary context and does not list its sessions', async () => {
    const f = await studentContext(24);
    await runner.query('UPDATE enrollments SET is_active = false WHERE id_enrollment = $1', [f.id]);
    await expect(f.api.checkIn(4, f.sessionId, studentLocation)).rejects.toMatchObject({
      response: { code: 'SESSION_CONTEXT_INVALID' },
      status: 409,
    });
    expect(
      (await f.api.getOwnEligibleSessions(4, 12)).data.some(
        (row) => row.idAttendanceSession === f.sessionId,
      ),
    ).toBe(false);
  });

  it('supports up/down/up without orphan enum types or changes to old columns', async () => {
    await migration.down(runner);
    const removed = await queryRows(
      "SELECT typname FROM pg_type WHERE typname IN ('attendance_sessions_mode_enum', 'attendances_registration_method_enum')",
    );
    expect(removed).toEqual([]);
    const [historical] = await queryRows('SELECT * FROM attendances WHERE id_attendance = 1');
    expect(historical).toMatchObject({ status: 'PRESENT', observation: 'Historical' });
    expect(historical).not.toHaveProperty('registration_method');
    await migration.up(runner);
    const [restored] = await queryRows('SELECT * FROM attendances WHERE id_attendance = 1');
    expect(restored).toMatchObject({
      registration_method: 'MANUAL',
      marked_at: null,
      id_marked_by: null,
    });
  });
});
