import { MigrationInterface, QueryRunner } from 'typeorm';

export class MyFirstMigration1784156907135 implements MigrationInterface {
  name = 'MyFirstMigration1784156907135';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "permissions" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_permission" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" UNIQUE ("name"), CONSTRAINT "PK_b2d9f24eee3188e59bd9754951d" PRIMARY KEY ("id_permission"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_role" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_3ebdb96dd6787bda0e3c8f89d66" PRIMARY KEY ("id_role"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_sessions_revoked_reason_enum" AS ENUM('Session closed by user', 'Session closed on all devices', 'Password changed', 'Suspicious activity detected', 'Session revoked by an administrator', 'Session expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id_session" SERIAL NOT NULL, "refresh_token" character varying NOT NULL, "ip_address" character varying, "user_agent" character varying, "browser" character varying, "os" character varying, "device" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP NOT NULL, "last_used_at" TIMESTAMP, "revoked_at" TIMESTAMP, "revoked_reason" "public"."user_sessions_revoked_reason_enum", "is_active" boolean NOT NULL DEFAULT true, "id_user" integer, "revoked_by" integer, CONSTRAINT "PK_f7f3780fd0c0e292f0edb89a8a7" PRIMARY KEY ("id_session"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_courses_relationtype_enum" AS ENUM('STUDENT', 'ASSITANT', 'TEACHER', 'DIRECTOR', 'DEAN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_courses" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_user_courses" SERIAL NOT NULL, "relationType" "public"."user_courses_relationtype_enum" NOT NULL, "id_user" integer, "id_course" integer, CONSTRAINT "PK_1d4cec31bf251f8c4fdd268bf48" PRIMARY KEY ("id_user_courses"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "grade_items" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_grade_item" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_538ae37cd7bc77d092bea870084" UNIQUE ("name"), CONSTRAINT "PK_6fde8ae95f8831da61a2882a596" PRIMARY KEY ("id_grade_item"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "grade_scheme_details" ("id_grade_scheme_detail" SERIAL NOT NULL, "percentage" integer NOT NULL, "order" integer NOT NULL, "id_grade_scheme" integer, "id_grade_scheme_item" integer, CONSTRAINT "PK_7aad0ab7a3844aa8d7830d5f5cc" PRIMARY KEY ("id_grade_scheme_detail"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "grade_schemes" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_grade_scheme" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL, CONSTRAINT "PK_3ab27ed50a3b4a84c281ddadcad" PRIMARY KEY ("id_grade_scheme"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "courses" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_course" SERIAL NOT NULL, "name" character varying NOT NULL, "code" character varying NOT NULL, "group" integer NOT NULL, "id_grade_scheme" integer, CONSTRAINT "PK_d3fdb27e6f581edcc13ade7aaf3" PRIMARY KEY ("id_course"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "careers" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_career" SERIAL NOT NULL, "name" character varying NOT NULL, "id_faculty" integer NOT NULL, "id_director" integer, CONSTRAINT "UQ_8bdde4a313c6092c9a499d034c0" UNIQUE ("name"), CONSTRAINT "REL_b6d4c082d46fa8fffa09a83cea" UNIQUE ("id_director"), CONSTRAINT "PK_b24fbc525cc5655658d3ec8771c" PRIMARY KEY ("id_career"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "faculties" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_faculty" SERIAL NOT NULL, "name" character varying NOT NULL, "id_user_director" integer, CONSTRAINT "UQ_39747c4153c669f1db683e8f231" UNIQUE ("name"), CONSTRAINT "REL_fcc626dfc269ce97b71b4f5430" UNIQUE ("id_user_director"), CONSTRAINT "PK_e62da079fff7c687f9596097f77" PRIMARY KEY ("id_faculty"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_user" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "avatar" character varying, "username" character varying NOT NULL, "name" character varying NOT NULL, "lastname" character varying NOT NULL, "ci" character varying NOT NULL, "ru" character varying NOT NULL, "careers" integer, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_eff3cf686729ac337fe991de64f" UNIQUE ("ci"), CONSTRAINT "UQ_e97d83395a8be9593e0da039d8c" UNIQUE ("ru"), CONSTRAINT "PK_fbb07fa6fbd1d74bee9782fb945" PRIMARY KEY ("id_user"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permission" ("rolesIdRole" integer NOT NULL, "permissionsIdPermission" integer NOT NULL, CONSTRAINT "PK_fe4c7fdc2c72d6a49f3138bf1ef" PRIMARY KEY ("rolesIdRole", "permissionsIdPermission"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4af7dc143bdebf60de76e0e6ca" ON "role_permission" ("rolesIdRole") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fd3525447b76b02d05ee093f5" ON "role_permission" ("permissionsIdPermission") `,
    );
    await queryRunner.query(
      `CREATE TABLE "career_courses" ("careersIdCareer" integer NOT NULL, "coursesIdCourse" integer NOT NULL, CONSTRAINT "PK_4a98e463506a286807ca557168c" PRIMARY KEY ("careersIdCareer", "coursesIdCourse"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef6abd4c8cfc3140661c57120e" ON "career_courses" ("careersIdCareer") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ee584916d91dffd40f870238cb" ON "career_courses" ("coursesIdCourse") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_role" ("usersIdUser" integer NOT NULL, "rolesIdRole" integer NOT NULL, CONSTRAINT "PK_665cecf575bd0f93c35916d8180" PRIMARY KEY ("usersIdUser", "rolesIdRole"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef640ef7aff3f8906cf491d86b" ON "user_role" ("usersIdUser") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ea475ad8fbe80b72a241944e5d" ON "user_role" ("rolesIdRole") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_18233b5b7696c22f6d716fd3b26" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_dea1c3e861a8b7a8acba6e9c3c5" FOREIGN KEY ("revoked_by") REFERENCES "users"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_courses" ADD CONSTRAINT "FK_4a96135c012d307d3d361f73c7a" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_courses" ADD CONSTRAINT "FK_8ab96576d233311345b991e1d74" FOREIGN KEY ("id_course") REFERENCES "courses"("id_course") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD CONSTRAINT "FK_148156bd773660818c07feea3e1" FOREIGN KEY ("id_grade_scheme") REFERENCES "grade_schemes"("id_grade_scheme") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD CONSTRAINT "FK_e7613f4d098d80c2ddc695926fb" FOREIGN KEY ("id_grade_scheme_item") REFERENCES "grade_items"("id_grade_item") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "courses" ADD CONSTRAINT "FK_9b9a471054b292c1b6c0bd1e403" FOREIGN KEY ("id_grade_scheme") REFERENCES "grade_schemes"("id_grade_scheme") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "careers" ADD CONSTRAINT "FK_9ba522b03b8b7384a07139d64cb" FOREIGN KEY ("id_faculty") REFERENCES "faculties"("id_faculty") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "careers" ADD CONSTRAINT "FK_b6d4c082d46fa8fffa09a83cea5" FOREIGN KEY ("id_director") REFERENCES "users"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "faculties" ADD CONSTRAINT "FK_fcc626dfc269ce97b71b4f54303" FOREIGN KEY ("id_user_director") REFERENCES "users"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_d3c62c2765bb2b2d276a74605a1" FOREIGN KEY ("careers") REFERENCES "careers"("id_career") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_4af7dc143bdebf60de76e0e6ca0" FOREIGN KEY ("rolesIdRole") REFERENCES "roles"("id_role") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_4fd3525447b76b02d05ee093f55" FOREIGN KEY ("permissionsIdPermission") REFERENCES "permissions"("id_permission") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_courses" ADD CONSTRAINT "FK_ef6abd4c8cfc3140661c57120e7" FOREIGN KEY ("careersIdCareer") REFERENCES "careers"("id_career") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_courses" ADD CONSTRAINT "FK_ee584916d91dffd40f870238cb0" FOREIGN KEY ("coursesIdCourse") REFERENCES "courses"("id_course") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_ef640ef7aff3f8906cf491d86bb" FOREIGN KEY ("usersIdUser") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_ea475ad8fbe80b72a241944e5de" FOREIGN KEY ("rolesIdRole") REFERENCES "roles"("id_role") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT "FK_ea475ad8fbe80b72a241944e5de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT "FK_ef640ef7aff3f8906cf491d86bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_courses" DROP CONSTRAINT "FK_ee584916d91dffd40f870238cb0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "career_courses" DROP CONSTRAINT "FK_ef6abd4c8cfc3140661c57120e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_4fd3525447b76b02d05ee093f55"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_4af7dc143bdebf60de76e0e6ca0"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_d3c62c2765bb2b2d276a74605a1"`);
    await queryRunner.query(
      `ALTER TABLE "faculties" DROP CONSTRAINT "FK_fcc626dfc269ce97b71b4f54303"`,
    );
    await queryRunner.query(
      `ALTER TABLE "careers" DROP CONSTRAINT "FK_b6d4c082d46fa8fffa09a83cea5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "careers" DROP CONSTRAINT "FK_9ba522b03b8b7384a07139d64cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "courses" DROP CONSTRAINT "FK_9b9a471054b292c1b6c0bd1e403"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" DROP CONSTRAINT "FK_e7613f4d098d80c2ddc695926fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" DROP CONSTRAINT "FK_148156bd773660818c07feea3e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_courses" DROP CONSTRAINT "FK_8ab96576d233311345b991e1d74"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_courses" DROP CONSTRAINT "FK_4a96135c012d307d3d361f73c7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_dea1c3e861a8b7a8acba6e9c3c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_18233b5b7696c22f6d716fd3b26"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ea475ad8fbe80b72a241944e5d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ef640ef7aff3f8906cf491d86b"`);
    await queryRunner.query(`DROP TABLE "user_role"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ee584916d91dffd40f870238cb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ef6abd4c8cfc3140661c57120e"`);
    await queryRunner.query(`DROP TABLE "career_courses"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4fd3525447b76b02d05ee093f5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4af7dc143bdebf60de76e0e6ca"`);
    await queryRunner.query(`DROP TABLE "role_permission"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "faculties"`);
    await queryRunner.query(`DROP TABLE "careers"`);
    await queryRunner.query(`DROP TABLE "courses"`);
    await queryRunner.query(`DROP TABLE "grade_schemes"`);
    await queryRunner.query(`DROP TABLE "grade_scheme_details"`);
    await queryRunner.query(`DROP TABLE "grade_items"`);
    await queryRunner.query(`DROP TABLE "user_courses"`);
    await queryRunner.query(`DROP TYPE "public"."user_courses_relationtype_enum"`);
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`DROP TYPE "public"."user_sessions_revoked_reason_enum"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
  }
}
