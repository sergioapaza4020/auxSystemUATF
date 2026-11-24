import { attendanceAcademicDate } from '@common/utils/attendance-session-policy';
import { DataSource } from 'typeorm';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AttendanceMultipleDailySessions1794700800000 } from 'src/database/migrations/1794700800000-AttendanceMultipleDailySessions';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { academicAttendanceCounts } from '@common/utils/attendance-academic-counts';
import { attendanceSummary } from '@common/utils/attendance-summary';
import { AttendancesService } from './attendances.service';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
(pgBin ? describe : describe.skip)('Multiple daily sessions on isolated PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  const migration = new AttendanceMultipleDailySessions1794700800000();
  const rows = () =>
    source.query<unknown[]>('SELECT * FROM attendance_sessions ORDER BY id_attendance_session');
  async function migrate(direction: 'up' | 'down') {
    const runner = source.createQueryRunner();
    try {
      await migration[direction](runner);
    } finally {
      await runner.release();
    }
  }
  beforeAll(async () => {
    database = await createSeedTestDatabase(pgBin!);
    source = database.source;
    const migrations = [...source.migrations];
    source.migrations.splice(
      0,
      source.migrations.length,
      ...migrations.filter((m) => m.constructor.name !== migration.constructor.name),
    );
    await source.runMigrations({ transaction: 'each' });
    await source.query(`INSERT INTO users (id_user,email,username,password,name,lastname,ci)
      VALUES (1,'multi-a@test.invalid','multi-a','unused','Test','Assistant','multi1'),
      (2,'multi-s@test.invalid','multi-s','unused','Test','Student','multi2')`);
    await source.query(
      `INSERT INTO courses (id_course,name,code,"group") VALUES (1,'Test','MULTI',1)`,
    );
    await source.query(`INSERT INTO semesters (id_semester,year,semester_number,start_date,end_date)
      VALUES (1,2026,'II','2026-07-01','2026-12-31')`);
    await source.query(`INSERT INTO enrollments (id_enrollment,id_user,id_course,id_semester,role)
      VALUES (1,1,1,1,'ASSISTANT'),(2,2,1,1,'STUDENT')`);
    await source.query(
      `INSERT INTO attendance_sessions (date,id_assistant_enrollment) VALUES ('2026-11-14',1)`,
    );
    source.migrations.splice(0, source.migrations.length, ...migrations);
  }, 90000);
  afterAll(async () => database?.close(), 45000);

  it('discovers renamed UNIQUE, preserves history and safely runs up/down/up', async () => {
    const historical = await rows();
    await source.query(
      `ALTER TABLE attendance_sessions RENAME CONSTRAINT "UQ_8cd3866ee6beebfc50a0bab1962" TO renamed_daily_unique`,
    );
    await migrate('up');
    expect(await rows()).toEqual(historical);
    expect(
      await source.query(
        `SELECT indexname FROM pg_indexes WHERE tablename='attendance_sessions' AND indexname='renamed_daily_unique'`,
      ),
    ).toEqual([]);
    await migrate('down');
    expect(await rows()).toEqual(historical);
    await migrate('up');
    expect(await rows()).toEqual(historical);
    expect((await source.driver.createSchemaBuilder().log()).upQueries).toEqual([]);
  });

  it('creates independent concurrent sessions in all enabled modes and keeps marks unique per session', async () => {
    const service = new AttendancesService(
      source.getRepository(AttendanceSession),
      source.getRepository(Attendance),
      source.getRepository(Enrollment),
    );
    const sessions = await Promise.all(
      [Mode.MANUAL, Mode.GEOLOCATION, Mode.QR].map((mode) =>
        service.createSession(1, {
          enrollmentId: 1,
          date: attendanceAcademicDate(new Date()),
          mode,
        }),
      ),
    );
    expect(new Set(sessions.map((s) => s.idAttendanceSession)).size).toBe(3);
    expect(await rows()).toHaveLength(4);
    for (const session of sessions)
      await source.query(
        `INSERT INTO attendances (id_attendance_session,id_enrollment,status) VALUES ($1,2,'PRESENT')`,
        [session.idAttendanceSession],
      );
    await expect(
      source.query(
        `INSERT INTO attendances (id_attendance_session,id_enrollment,status) VALUES ($1,2,'ABSENT')`,
        [sessions[0].idAttendanceSession],
      ),
    ).rejects.toMatchObject({
      driverError: { code: '23505', constraint: 'UQ_7880aee9d2b1416261167c83e86' },
    });
    const historical = await rows();
    await expect(migrate('down')).rejects.toThrow('ROLLBACK_BLOCKED');
    expect(await rows()).toEqual(historical);
    expect(await source.query('SELECT * FROM attendances')).toHaveLength(3);
  });

  it('counts each CLOSED session, implicit absences and EXCUSED weight without counting OPEN sessions', async () => {
    // Each enabled self-registration mode contributes its own CLOSED session.
    for (const mode of ['GEOLOCATION', 'QR', 'GEOLOCATION_QR']) {
      await source.query(
        `INSERT INTO attendance_sessions
        (date,id_assistant_enrollment,mode,latitude,longitude,radius_meters,maximum_accepted_accuracy,starts_at,ends_at,opened_at,closed_at)
        VALUES ('2026-11-14',1,$1,$2,$3,$4,$5,'2026-11-14T14:00Z','2026-11-14T16:00Z','2026-11-14T13:50Z','2026-11-14T15:00Z'),
        ('2026-11-14',1,$1,$2,$3,$4,$5,'2026-11-14T14:00Z','2026-11-14T16:00Z','2026-11-14T13:50Z',NULL)`,
        [
          mode,
          mode === 'QR' ? null : -19.57,
          mode === 'QR' ? null : -65.75,
          mode === 'QR' ? null : 100,
          mode === 'QR' ? null : 50,
        ],
      );
    }
    await source.query(
      `UPDATE attendances SET status='EXCUSED' WHERE id_attendance_session=(SELECT min(id_attendance_session) FROM attendances)`,
    );
    const [counts] = await academicAttendanceCounts(
      source.getRepository(Attendance),
      1,
      [2],
      new Date('2026-11-14T15:30Z'),
    );
    // Two MANUAL plus three CLOSED GEO/QR/COMB sessions; no deduplication by date.
    expect(counts).toEqual({ enrollmentId: 2, total: 5, present: 0, excused: 1 });
    expect(attendanceSummary(counts.present, counts.excused, counts.total, 0.5)).toMatchObject({
      absent: 4,
      percentage: 10,
    });
  });
});
