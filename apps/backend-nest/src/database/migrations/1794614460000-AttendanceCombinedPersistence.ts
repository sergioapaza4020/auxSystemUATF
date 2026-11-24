import { MigrationInterface, QueryRunner } from 'typeorm';
import { attendanceCombinedChecksV1 as checks } from '../utils/attendance-combined-schema-v1';
import { lockAttendanceCombinedRollback } from '../utils/attendance-combined-rollback';

export class AttendanceCombinedPersistence1794614460000 implements MigrationInterface {
  transaction = true;

  async up(runner: QueryRunner): Promise<void> {
    for (const name of [
      'CHK_attendance_session_combined_configuration',
      'CHK_attendance_session_combined_window',
    ] as const)
      await runner.query(
        `ALTER TABLE public.attendance_sessions ADD CONSTRAINT "${name}" CHECK (${checks[name]})`,
      );
    await runner.query(
      `ALTER TABLE public.attendances ADD CONSTRAINT "CHK_attendance_combined_evidence" CHECK (${checks.CHK_attendance_combined_evidence})`,
    );
    await runner.query(`CREATE TABLE public.attendance_combined_authorizations (
      id_attendance_combined_authorization SERIAL NOT NULL,
      id_attendance_session integer NOT NULL,
      id_student_enrollment integer NOT NULL,
      token_hash bytea NOT NULL,
      qr_validated_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      CONSTRAINT "PK_attendance_combined_authorization" PRIMARY KEY (id_attendance_combined_authorization),
      CONSTRAINT "UQ_attendance_combined_authorization_pair" UNIQUE (id_attendance_session, id_student_enrollment),
      CONSTRAINT "UQ_attendance_combined_authorization_hash" UNIQUE (token_hash),
      CONSTRAINT "FK_attendance_combined_authorization_session" FOREIGN KEY (id_attendance_session) REFERENCES public.attendance_sessions(id_attendance_session) ON DELETE RESTRICT,
      CONSTRAINT "FK_attendance_combined_authorization_student" FOREIGN KEY (id_student_enrollment) REFERENCES public.enrollments(id_enrollment) ON DELETE RESTRICT,
      CONSTRAINT "CHK_attendance_combined_authorization_hash" CHECK (${checks.CHK_attendance_combined_authorization_hash}),
      CONSTRAINT "CHK_attendance_combined_authorization_time" CHECK (${checks.CHK_attendance_combined_authorization_time})
    )`);
    await runner.query(
      `CREATE INDEX "IDX_attendance_combined_authorization_expiry" ON public.attendance_combined_authorizations (expires_at)`,
    );
    await runner.query(`CREATE TABLE public.attendance_audit_events (
      id_attendance_audit_event SERIAL NOT NULL,
      id_attendance_session integer NOT NULL,
      id_student_enrollment integer NOT NULL,
      id_attendance integer NOT NULL,
      id_actor integer NOT NULL,
      operation varchar(6) NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      previous_status public.attendances_status_enum,
      new_status public.attendances_status_enum NOT NULL,
      previous_registration_method public.attendances_registration_method_enum,
      new_registration_method public.attendances_registration_method_enum NOT NULL,
      previous_observation varchar(500),
      new_observation varchar(500),
      session_state_at_operation varchar(6) NOT NULL,
      CONSTRAINT "PK_attendance_audit_event" PRIMARY KEY (id_attendance_audit_event),
      CONSTRAINT "FK_attendance_audit_session" FOREIGN KEY (id_attendance_session) REFERENCES public.attendance_sessions(id_attendance_session) ON DELETE RESTRICT,
      CONSTRAINT "FK_attendance_audit_student" FOREIGN KEY (id_student_enrollment) REFERENCES public.enrollments(id_enrollment) ON DELETE RESTRICT,
      CONSTRAINT "FK_attendance_audit_mark" FOREIGN KEY (id_attendance) REFERENCES public.attendances(id_attendance) ON DELETE RESTRICT,
      CONSTRAINT "FK_attendance_audit_actor" FOREIGN KEY (id_actor) REFERENCES public.users(id_user) ON DELETE RESTRICT,
      CONSTRAINT "CHK_attendance_audit_operation" CHECK (${checks.CHK_attendance_audit_operation}),
      CONSTRAINT "CHK_attendance_audit_state" CHECK (${checks.CHK_attendance_audit_state}),
      CONSTRAINT "CHK_attendance_audit_time" CHECK (${checks.CHK_attendance_audit_time}),
      CONSTRAINT "CHK_attendance_audit_transition" CHECK (${checks.CHK_attendance_audit_transition})
    )`);
    await runner.query(
      `CREATE INDEX "IDX_attendance_audit_session_time" ON public.attendance_audit_events (id_attendance_session, occurred_at)`,
    );
    await runner.query(
      `CREATE INDEX "IDX_attendance_audit_mark_time" ON public.attendance_audit_events (id_attendance, occurred_at)`,
    );
    await runner.query(`CREATE FUNCTION public.attendance_audit_append_only_v1() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'ATTENDANCE_AUDIT_APPEND_ONLY' USING ERRCODE = '55000';
      END $$`);
    await runner.query(`CREATE TRIGGER attendance_audit_append_only_v1 BEFORE UPDATE OR DELETE OR TRUNCATE
      ON public.attendance_audit_events FOR EACH STATEMENT EXECUTE FUNCTION public.attendance_audit_append_only_v1()`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await lockAttendanceCombinedRollback(runner);
    // DROP RESTRICT makes unknown dependencies fail and rolls back all preceding DDL.
    await runner.query('DROP TABLE public.attendance_audit_events');
    await runner.query('DROP FUNCTION public.attendance_audit_append_only_v1()');
    await runner.query('DROP TABLE public.attendance_combined_authorizations');
    await runner.query(
      'ALTER TABLE public.attendances DROP CONSTRAINT "CHK_attendance_combined_evidence"',
    );
    await runner.query(
      'ALTER TABLE public.attendance_sessions DROP CONSTRAINT "CHK_attendance_session_combined_window"',
    );
    await runner.query(
      'ALTER TABLE public.attendance_sessions DROP CONSTRAINT "CHK_attendance_session_combined_configuration"',
    );
  }
}
