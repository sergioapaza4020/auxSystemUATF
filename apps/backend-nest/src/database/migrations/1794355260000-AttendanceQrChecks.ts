import { MigrationInterface, QueryRunner } from 'typeorm';
import { lockAttendanceQrRollback } from '../utils/attendance-qr-rollback';

export class AttendanceQrChecks1794355260000 implements MigrationInterface {
  transaction = true;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."attendance_sessions"
      ADD CONSTRAINT "CHK_attendance_session_qr_fields" CHECK (
        "mode" <> 'QR' OR ("id_assistant_enrollment" IS NOT NULL
          AND "latitude" IS NULL AND "longitude" IS NULL
          AND "radius_meters" IS NULL AND "maximum_accepted_accuracy" IS NULL))`);
    await queryRunner.query(`ALTER TABLE "public"."attendance_sessions"
      ADD CONSTRAINT "CHK_attendance_session_qr_window" CHECK (
        "mode" <> 'QR' OR (
          isfinite("date")
          AND ("starts_at" IS NULL OR isfinite("starts_at"))
          AND ("ends_at" IS NULL OR isfinite("ends_at"))
          AND ("opened_at" IS NULL OR isfinite("opened_at"))
          AND ("closed_at" IS NULL OR isfinite("closed_at"))
          AND ("cancelled_at" IS NULL OR isfinite("cancelled_at"))
          AND ("opened_at" IS NULL OR (
            "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL
            AND "starts_at" < "ends_at" AND "opened_at" < "ends_at"
            AND "date" = ("starts_at" AT TIME ZONE 'America/La_Paz')::date
            AND ("cancelled_at" IS NULL OR (
              "cancelled_at" >= "opened_at" AND "cancelled_at" < "starts_at"))
          ))
        ))`);
    await queryRunner.query(`ALTER TABLE "public"."attendances"
      ADD CONSTRAINT "CHK_attendance_qr_evidence" CHECK (
        "registration_method" <> 'QR' OR (
          "status" = 'PRESENT' AND "marked_at" IS NOT NULL AND isfinite("marked_at")
          AND "id_marked_by" IS NOT NULL AND "id_attendance_session" IS NOT NULL
          AND "id_enrollment" IS NOT NULL AND "accuracy" IS NULL AND "distance_meters" IS NULL
        ))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await lockAttendanceQrRollback(queryRunner);
    await queryRunner.query(
      'ALTER TABLE "public"."attendances" DROP CONSTRAINT "CHK_attendance_qr_evidence"',
    );
    await queryRunner.query(
      'ALTER TABLE "public"."attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_qr_window"',
    );
    await queryRunner.query(
      'ALTER TABLE "public"."attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_qr_fields"',
    );
  }
}
