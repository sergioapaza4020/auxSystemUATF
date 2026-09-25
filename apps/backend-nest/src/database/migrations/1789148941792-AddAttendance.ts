import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttendance1789148941792 implements MigrationInterface {
  name = 'AddAttendance1789148941792';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "attendance_sessions" ("id_attendance_session" SERIAL NOT NULL, "date" date NOT NULL, "id_assistant_enrollment" integer, CONSTRAINT "UQ_8cd3866ee6beebfc50a0bab1962" UNIQUE ("id_assistant_enrollment", "date"), CONSTRAINT "PK_9b4baae1807f9e42bcdd2702694" PRIMARY KEY ("id_attendance_session"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attendances_status_enum" AS ENUM('PRESENT', 'ABSENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "attendances" ("id_attendance" SERIAL NOT NULL, "status" "public"."attendances_status_enum" NOT NULL, "id_attendance_session" integer, "id_enrollment" integer, CONSTRAINT "UQ_7880aee9d2b1416261167c83e86" UNIQUE ("id_attendance_session", "id_enrollment"), CONSTRAINT "PK_22f2182c3eeb66783acc78cdd83" PRIMARY KEY ("id_attendance"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" ADD CONSTRAINT "FK_8d240a659136363e9c77c4c8b5d" FOREIGN KEY ("id_assistant_enrollment") REFERENCES "enrollments"("id_enrollment") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_ae207cbed19a342c7f59944b176" FOREIGN KEY ("id_attendance_session") REFERENCES "attendance_sessions"("id_attendance_session") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_125f6bff41a7a139d29efe0f8d9" FOREIGN KEY ("id_enrollment") REFERENCES "enrollments"("id_enrollment") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "FK_125f6bff41a7a139d29efe0f8d9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "FK_ae207cbed19a342c7f59944b176"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_sessions" DROP CONSTRAINT "FK_8d240a659136363e9c77c4c8b5d"`,
    );
    await queryRunner.query(`DROP TABLE "attendances"`);
    await queryRunner.query(`DROP TYPE "public"."attendances_status_enum"`);
    await queryRunner.query(`DROP TABLE "attendance_sessions"`);
  }
}
