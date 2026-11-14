import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceGeolocationModel1792886400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Defaults classify existing rows as MANUAL without inventing historical evidence.
    await queryRunner.query(
      `CREATE TYPE "public"."attendance_sessions_mode_enum" AS ENUM('MANUAL', 'GEOLOCATION')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attendances_registration_method_enum" AS ENUM('MANUAL', 'GEOLOCATION')`,
    );
    await queryRunner.query(`ALTER TABLE "attendance_sessions"
      ADD "mode" "public"."attendance_sessions_mode_enum" NOT NULL DEFAULT 'MANUAL',
      ADD "latitude" numeric(9,6), ADD "longitude" numeric(10,6),
      ADD "radius_meters" integer, ADD "maximum_accepted_accuracy" integer,
      ADD "starts_at" timestamptz, ADD "ends_at" timestamptz,
      ADD "opened_at" timestamptz, ADD "closed_at" timestamptz, ADD "cancelled_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "attendances"
      ADD "registration_method" "public"."attendances_registration_method_enum" NOT NULL DEFAULT 'MANUAL',
      ADD "marked_at" timestamptz, ADD "id_marked_by" integer,
      ADD "accuracy" numeric(10,2), ADD "distance_meters" numeric(10,2)`);
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendance_marked_by" FOREIGN KEY ("id_marked_by") REFERENCES "users"("id_user") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_latitude" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_longitude" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_radius" CHECK ("radius_meters" IS NULL OR "radius_meters" > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_maximum_accuracy" CHECK ("maximum_accepted_accuracy" IS NULL OR "maximum_accepted_accuracy" > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_window" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_closed_cancelled" CHECK ("closed_at" IS NULL OR "cancelled_at" IS NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_closed_opened" CHECK ("closed_at" IS NULL OR ("opened_at" IS NOT NULL AND "closed_at" >= "opened_at"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_closed_start" CHECK ("closed_at" IS NULL OR "starts_at" IS NULL OR "closed_at" >= "starts_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_closed_end" CHECK ("closed_at" IS NULL OR "ends_at" IS NULL OR "closed_at" < "ends_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_geo_configuration" CHECK ("mode" <> 'GEOLOCATION' OR "opened_at" IS NULL OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "radius_meters" IS NOT NULL AND "maximum_accepted_accuracy" IS NOT NULL AND "starts_at" IS NOT NULL AND "ends_at" IS NOT NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "CHK_attendance_session_manual_fields" CHECK ("mode" <> 'MANUAL' OR ("latitude" IS NULL AND "longitude" IS NULL AND "radius_meters" IS NULL AND "maximum_accepted_accuracy" IS NULL AND "starts_at" IS NULL AND "ends_at" IS NULL AND "opened_at" IS NULL AND "closed_at" IS NULL AND "cancelled_at" IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "CHK_attendance_accuracy" CHECK ("accuracy" IS NULL OR ("accuracy" >= 0 AND "accuracy" < 'Infinity'::numeric))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "CHK_attendance_distance" CHECK ("distance_meters" IS NULL OR ("distance_meters" >= 0 AND "distance_meters" < 'Infinity'::numeric))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "CHK_attendance_geo_evidence" CHECK ("registration_method" <> 'GEOLOCATION' OR ("marked_at" IS NOT NULL AND "id_marked_by" IS NOT NULL AND "accuracy" IS NOT NULL AND "distance_meters" IS NOT NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "CHK_attendance_geo_status" CHECK ("registration_method" <> 'GEOLOCATION' OR "status" = 'PRESENT')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Development rollback only: after GEO is enabled this destroys configuration and evidence.
    await queryRunner.query(`ALTER TABLE "attendances" DROP CONSTRAINT "FK_attendance_marked_by"`);
    await queryRunner.query(`ALTER TABLE "attendances" DROP CONSTRAINT "CHK_attendance_accuracy"`);
    await queryRunner.query(`ALTER TABLE "attendances" DROP CONSTRAINT "CHK_attendance_distance"`);
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "CHK_attendance_geo_evidence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "CHK_attendance_geo_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_latitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_longitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_radius"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_maximum_accuracy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_window"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_closed_cancelled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_closed_opened"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_closed_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_closed_end"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_geo_configuration"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "CHK_attendance_session_manual_fields"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP COLUMN "distance_meters", DROP COLUMN "accuracy", DROP COLUMN "id_marked_by", DROP COLUMN "marked_at", DROP COLUMN "registration_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP COLUMN "cancelled_at", DROP COLUMN "closed_at", DROP COLUMN "opened_at", DROP COLUMN "ends_at", DROP COLUMN "starts_at", DROP COLUMN "maximum_accepted_accuracy", DROP COLUMN "radius_meters", DROP COLUMN "longitude", DROP COLUMN "latitude", DROP COLUMN "mode"`,
    );
    await queryRunner.query(`DROP TYPE "public"."attendances_registration_method_enum"`);
    await queryRunner.query(`DROP TYPE "public"."attendance_sessions_mode_enum"`);
  }
}
