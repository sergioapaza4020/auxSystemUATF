import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModifyEnrollmentEntity1787831378220 implements MigrationInterface {
  name = 'ModifyEnrollmentEntity1787831378220';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "semesters" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_semester" SERIAL NOT NULL, "year" integer NOT NULL, "semester_number" character varying NOT NULL, "start_date" TIMESTAMP NOT NULL, "end_date" TIMESTAMP NOT NULL, CONSTRAINT "PK_baa377fe53b97d910029cd45775" PRIMARY KEY ("id_semester"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."enrollments_role_enum" AS ENUM('STUDENT', 'ASSITANT', 'TEACHER', 'DIRECTOR', 'DEAN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "enrollments" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_enrollment" SERIAL NOT NULL, "role" "public"."enrollments_role_enum" NOT NULL, "id_semester" integer, "id_course" integer, "id_user" integer, CONSTRAINT "UQ_f0c733a26362d184c12a54f9249" UNIQUE ("id_user", "id_course", "id_semester"), CONSTRAINT "PK_a23c202dc4b6864ff1fa99ab5a4" PRIMARY KEY ("id_enrollment"))`,
    );
    await queryRunner.query(`ALTER TABLE "grade_schemes" ALTER COLUMN "description" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_92aea15efb65846379efed3c6d1" FOREIGN KEY ("id_semester") REFERENCES "semesters"("id_semester") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_fcd68d4dc649ba129667e20d081" FOREIGN KEY ("id_course") REFERENCES "courses"("id_course") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_2b1f84c8c2fb4a759c3af77b2d1" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_2b1f84c8c2fb4a759c3af77b2d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_fcd68d4dc649ba129667e20d081"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_92aea15efb65846379efed3c6d1"`,
    );
    await queryRunner.query(`ALTER TABLE "grade_schemes" ALTER COLUMN "description" SET NOT NULL`);
    await queryRunner.query(`DROP TABLE "enrollments"`);
    await queryRunner.query(`DROP TYPE "public"."enrollments_role_enum"`);
    await queryRunner.query(`DROP TABLE "semesters"`);
  }
}
