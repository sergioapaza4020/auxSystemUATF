import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AttendanceAuthorizationMaintenance } from './attendance-authorization-maintenance';
import { AttendancesService } from './attendances.service';
import { AttendanceQrTokenService } from './attendance-qr-token.service';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
const isolated = pgBin ? describe : describe.skip;
isolated('Bounded coordinated authorization maintenance on disposable PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  let id: number;
  let cleaner: AttendanceAuthorizationMaintenance;
  beforeAll(async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      ATTENDANCE_QR_ACTIVE_KID: 'cleanup',
      ATTENDANCE_QR_KEYS_JSON: JSON.stringify({
        cleanup: Buffer.alloc(32, 0x16).toString('base64'),
      }),
    });
    database = await createSeedTestDatabase(pgBin!);
    source = database.source;
    await source.runMigrations({ transaction: 'each' });
    await source.query(
      `INSERT INTO users(id_user,email,username,password,name,lastname,ci) SELECT n,'maintenance-'||n||'@test.invalid','maintenance-'||n,'unused','Synthetic','Fixture','maintenance-'||n FROM generate_series(1,106)n`,
    );
    await source.query(
      `INSERT INTO courses(id_course,name,code,"group") VALUES(1,'Synthetic maintenance','MAINT',1)`,
    );
    const year = new Date().getUTCFullYear();
    await source.query(
      `INSERT INTO semesters(id_semester,year,semester_number,start_date,end_date) VALUES(1,$1,'II',$2,$3)`,
      [year, new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year + 1, 0, 1))],
    );
    await source.query(
      `INSERT INTO enrollments(id_enrollment,id_user,id_course,id_semester,role) SELECT n,n,1,1,CASE WHEN n=1 THEN 'ASSISTANT' ELSE 'STUDENT' END::enrollments_role_enum FROM generate_series(1,106)n`,
    );
    const rows: { id_attendance_session: number }[] =
      await source.query(`INSERT INTO attendance_sessions(id_assistant_enrollment,date,mode,latitude,longitude,radius_meters,maximum_accepted_accuracy,starts_at,ends_at,opened_at)
      VALUES(1,((now()-interval '3 days') AT TIME ZONE 'America/La_Paz')::date,'GEOLOCATION_QR',-19.57,-65.75,100,50,now()-interval '3 days',now()+interval '1 hour',now()-interval '3 days') RETURNING id_attendance_session`);
    id = rows[0].id_attendance_session;
    await source.query(
      `INSERT INTO attendance_combined_authorizations(id_attendance_session,id_student_enrollment,token_hash,qr_validated_at,expires_at)
      SELECT $1,n,decode(repeat(md5(n::text),2),'hex'),now()-interval '2 days',now()-interval '2 days'+interval '90 seconds' FROM generate_series(2,106)n`,
      [id],
    );
    cleaner = new AttendanceAuthorizationMaintenance(source, new ConfigService());
  }, 90000);
  afterAll(async () => {
    await database?.close();
    jest.restoreAllMocks();
  }, 45000);
  it('skips busy sessions and competing workers, caps batches and preserves renewed/consumed evidence', async () => {
    const held = source.createQueryRunner();
    await held.connect();
    await held.startTransaction();
    try {
      await held.query(
        'SELECT 1 FROM attendance_sessions WHERE id_attendance_session=$1 FOR UPDATE',
        [id],
      );
      expect(await cleaner.sweep()).toBe(0);
      await held.query('SELECT pg_advisory_xact_lock(17946144,6)');
      expect(await cleaner.sweep()).toBe(0);
    } finally {
      await held.rollbackTransaction();
      await held.release();
    }
    expect(await cleaner.sweep()).toBe(100);
    const api = new AttendancesService(
      source.getRepository(AttendanceSession),
      source.getRepository(Attendance),
      source.getRepository(Enrollment),
      new AttendanceQrTokenService(),
    );
    const challenge = await api.combinedChallenge(106, id, {
      token: (await api.getQr(1, id)).token,
    });
    expect(challenge.authorization).toBeTruthy();
    await api.combinedCheckIn(106, id, {
      authorization: challenge.authorization!,
      latitude: -19.57,
      longitude: -65.75,
      accuracy: 10,
    });
    expect(await cleaner.sweep()).toBe(4);
    expect(await source.query('SELECT 1 FROM attendance_combined_authorizations')).toHaveLength(1);
    expect(await source.query('SELECT 1 FROM attendances')).toHaveLength(1);
    expect(await source.query('SELECT 1 FROM attendance_audit_events')).toHaveLength(1);
    expect(await cleaner.sweep()).toBe(0);
  }, 30000);
});
