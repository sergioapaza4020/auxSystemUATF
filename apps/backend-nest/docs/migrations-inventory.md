# Inventario completo de migraciones

Estado del árbol auditado; las huellas identifican archivos locales, no demuestran ejecución en otros entornos. Dependencia anterior = prefijo completo conservador del historial. SQL dinámico y validaciones se conservan en los métodos transcritos. El catálogo final exacto está en [migrations-schema.json](migrations-schema.json).

| Timestamp | Nombre / archivo | Dependencia anterior |
|---|---|---|
| 1784156907135 | [1784156907135-MyFirstMigration.ts](../src/database/migrations/1784156907135-MyFirstMigration.ts) | ninguna |
| 1784158316546 | [1784158316546-ChangeNameRelationGradeDetails.ts](../src/database/migrations/1784158316546-ChangeNameRelationGradeDetails.ts) | 1784156907135 |
| 1787831378220 | [1787831378220-ModifyEnrollmentEntity.ts](../src/database/migrations/1787831378220-ModifyEnrollmentEntity.ts) | 1784158316546 |
| 1787831793215 | [1787831793215-NullableRUInUser.ts](../src/database/migrations/1787831793215-NullableRUInUser.ts) | 1787831378220 |
| 1787854574886 | [1787854574886-ModifyCourseRelationsEnum.ts](../src/database/migrations/1787854574886-ModifyCourseRelationsEnum.ts) | 1787831793215 |
| 1788178632710 | [1788178632710-AddGrades.ts](../src/database/migrations/1788178632710-AddGrades.ts) | 1787854574886 |
| 1789015901575 | [1789015901575-AddActivitiesEntity.ts](../src/database/migrations/1789015901575-AddActivitiesEntity.ts) | 1788178632710 |
| 1789074562933 | [1789074562933-RelationsBetweenActivitiesAndGraes.ts](../src/database/migrations/1789074562933-RelationsBetweenActivitiesAndGraes.ts) | 1789015901575 |
| 1789079384425 | [1789079384425-AddRelationsEnrollmentToGradeScheme.ts](../src/database/migrations/1789079384425-AddRelationsEnrollmentToGradeScheme.ts) | 1789074562933 |
| 1789148941792 | [1789148941792-AddAttendance.ts](../src/database/migrations/1789148941792-AddAttendance.ts) | 1789079384425 |
| 1790926042143 | [1790926042143-AddBulkOperations.ts](../src/database/migrations/1790926042143-AddBulkOperations.ts) | 1789148941792 |
| 1790973495493 | [1790973495493-AddCompletedWithErrors.ts](../src/database/migrations/1790973495493-AddCompletedWithErrors.ts) | 1790926042143 |
| 1791223200000 | [1791223200000-ActivityPublicationAndDeadline.ts](../src/database/migrations/1791223200000-ActivityPublicationAndDeadline.ts) | 1790973495493 |
| 1791317489801 | [1791317489801-EditActivityFields.ts](../src/database/migrations/1791317489801-EditActivityFields.ts) | 1791223200000 |
| 1791547200000 | [1791547200000-UniqueActivityGrade.ts](../src/database/migrations/1791547200000-UniqueActivityGrade.ts) | 1791317489801 |
| 1791655200000 | [1791655200000-AttendanceExcusedWeight.ts](../src/database/migrations/1791655200000-AttendanceExcusedWeight.ts) | 1791547200000 |
| 1791662400000 | [1791662400000-AttendanceObservation.ts](../src/database/migrations/1791662400000-AttendanceObservation.ts) | 1791655200000 |
| 1792526400000 | [1792526400000-AddAcademicImportTypes.ts](../src/database/migrations/1792526400000-AddAcademicImportTypes.ts) | 1791662400000 |
| 1792620000000 | [1792620000000-ArchiveAssistantCriteria.ts](../src/database/migrations/1792620000000-ArchiveAssistantCriteria.ts) | 1792526400000 |
| 1792886400000 | [1792886400000-AttendanceGeolocationModel.ts](../src/database/migrations/1792886400000-AttendanceGeolocationModel.ts) | 1792620000000 |
| 1794355200000 | [1794355200000-AttendanceQrEnums.ts](../src/database/migrations/1794355200000-AttendanceQrEnums.ts) | 1792886400000 |
| 1794355260000 | [1794355260000-AttendanceQrChecks.ts](../src/database/migrations/1794355260000-AttendanceQrChecks.ts) | 1794355200000 |

## 1784156907135-MyFirstMigration.ts

SHA256: `bc9981f0735fd323f84622319e3ceb4432388f53256a1db5fcbc41841fe5645c`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | is_active, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at, id_permission, name, description, id_role, id_session, refresh_token, ip_address, user_agent, browser, os, device, expires_at, last_used_at, revoked_at, revoked_reason, id_user, revoked_by, id_user_courses, relationType, id_course, id_grade_item, id_grade_scheme_detail, percentage, order, id_grade_scheme, id_grade_scheme_item, code, group, id_career, id_faculty, id_director, id_user_director, email, password, avatar, username, lastname, ci, ru, rolesIdRole, permissionsIdPermission, careersIdCareer, coursesIdCourse, usersIdUser |
| Tablas | career_courses, careers, courses, faculties, grade_items, grade_scheme_details, grade_schemes, permissions, role_permission, roles, user_courses, user_role, user_sessions, users |
| ENUM | user_courses_relationtype_enum, user_sessions_revoked_reason_enum |
| CHECK | — |
| FK | FK_148156bd773660818c07feea3e1, FK_18233b5b7696c22f6d716fd3b26, FK_4a96135c012d307d3d361f73c7a, FK_4af7dc143bdebf60de76e0e6ca0, FK_4fd3525447b76b02d05ee093f55, FK_8ab96576d233311345b991e1d74, FK_9b9a471054b292c1b6c0bd1e403, FK_9ba522b03b8b7384a07139d64cb, FK_b6d4c082d46fa8fffa09a83cea5, FK_d3c62c2765bb2b2d276a74605a1, FK_dea1c3e861a8b7a8acba6e9c3c5, FK_e7613f4d098d80c2ddc695926fb, FK_ea475ad8fbe80b72a241944e5de, FK_ee584916d91dffd40f870238cb0, FK_ef640ef7aff3f8906cf491d86bb, FK_ef6abd4c8cfc3140661c57120e7, FK_fcc626dfc269ce97b71b4f54303 |
| UNIQUE | REL_b6d4c082d46fa8fffa09a83cea, REL_fcc626dfc269ce97b71b4f5430, UQ_39747c4153c669f1db683e8f231, UQ_48ce552495d14eae9b187bb6716, UQ_538ae37cd7bc77d092bea870084, UQ_648e3f5447f725579d7d4ffdfb7, UQ_8bdde4a313c6092c9a499d034c0, UQ_97672ac88f789774dd47f7c8be3, UQ_e97d83395a8be9593e0da039d8c, UQ_eff3cf686729ac337fe991de64f, UQ_fe0bb3f6520ee0469504521e710 |
| Índices | IDX_4af7dc143bdebf60de76e0e6ca, IDX_4fd3525447b76b02d05ee093f5, IDX_ea475ad8fbe80b72a241944e5d, IDX_ee584916d91dffd40f870238cb, IDX_ef640ef7aff3f8906cf491d86b, IDX_ef6abd4c8cfc3140661c57120e |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
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
```

## 1784158316546-ChangeNameRelationGradeDetails.ts

SHA256: `986cf0844dbbf69c4654077427b1acf044def843f444a74ebc1cf9bc52c3b9b6`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | id_grade_scheme_item, id_grade_item |
| Tablas | grade_items, grade_scheme_details |
| ENUM | — |
| CHECK | — |
| FK | FK_21f8fdab52e6b2ba7c0d74c1c51, FK_e7613f4d098d80c2ddc695926fb |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeNameRelationGradeDetails1784158316546 implements MigrationInterface {
  name = 'ChangeNameRelationGradeDetails1784158316546';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" DROP CONSTRAINT "FK_e7613f4d098d80c2ddc695926fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" RENAME COLUMN "id_grade_scheme_item" TO "id_grade_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD CONSTRAINT "FK_21f8fdab52e6b2ba7c0d74c1c51" FOREIGN KEY ("id_grade_item") REFERENCES "grade_items"("id_grade_item") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" DROP CONSTRAINT "FK_21f8fdab52e6b2ba7c0d74c1c51"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" RENAME COLUMN "id_grade_item" TO "id_grade_scheme_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD CONSTRAINT "FK_e7613f4d098d80c2ddc695926fb" FOREIGN KEY ("id_grade_scheme_item") REFERENCES "grade_items"("id_grade_item") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
```

## 1787831378220-ModifyEnrollmentEntity.ts

SHA256: `4c70853c9dcb00b680de754a5d668174e90354c9985da2e5735bd7d34defd1a0`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | is_active, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at, id_semester, year, semester_number, start_date, end_date, id_enrollment, role, id_course, id_user, description |
| Tablas | courses, enrollments, grade_schemes, semesters, users |
| ENUM | enrollments_role_enum |
| CHECK | — |
| FK | FK_2b1f84c8c2fb4a759c3af77b2d1, FK_92aea15efb65846379efed3c6d1, FK_fcd68d4dc649ba129667e20d081 |
| UNIQUE | UQ_f0c733a26362d184c12a54f9249 |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
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
```

## 1787831793215-NullableRUInUser.ts

SHA256: `0061ec9719bca5de4741a694f6662ed5d3673e08df9f8be7a9367ffa8bd4db31`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | ru |
| Tablas | users |
| ENUM | — |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableRUInUser1787831793215 implements MigrationInterface {
  name = 'NullableRUInUser1787831793215';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "ru" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "ru" SET NOT NULL`);
  }
}
```

## 1787854574886-ModifyCourseRelationsEnum.ts

SHA256: `4b3713c9f0c2b9488465ddada74b2015769e563d826f48e0c7bbb9ef6c648bf9`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | relationType, text, role |
| Tablas | enrollments, user_courses |
| ENUM | enrollments_role_enum, enrollments_role_enum_old, user_courses_relationtype_enum, user_courses_relationtype_enum_old |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModifyCourseRelationsEnum1787854574886 implements MigrationInterface {
  name = 'ModifyCourseRelationsEnum1787854574886';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."user_courses_relationtype_enum" RENAME TO "user_courses_relationtype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_courses_relationtype_enum" AS ENUM('STUDENT', 'ASSISTANT', 'TEACHER', 'DIRECTOR', 'DEAN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_courses" ALTER COLUMN "relationType" TYPE "public"."user_courses_relationtype_enum" USING "relationType"::"text"::"public"."user_courses_relationtype_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_courses_relationtype_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."enrollments_role_enum" RENAME TO "enrollments_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."enrollments_role_enum" AS ENUM('STUDENT', 'ASSISTANT', 'TEACHER', 'DIRECTOR', 'DEAN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ALTER COLUMN "role" TYPE "public"."enrollments_role_enum" USING "role"::"text"::"public"."enrollments_role_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."enrollments_role_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."enrollments_role_enum_old" AS ENUM('STUDENT', 'ASSITANT', 'TEACHER', 'DIRECTOR', 'DEAN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ALTER COLUMN "role" TYPE "public"."enrollments_role_enum_old" USING "role"::"text"::"public"."enrollments_role_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."enrollments_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."enrollments_role_enum_old" RENAME TO "enrollments_role_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_courses_relationtype_enum_old" AS ENUM('STUDENT', 'ASSITANT', 'TEACHER', 'DIRECTOR', 'DEAN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_courses" ALTER COLUMN "relationType" TYPE "public"."user_courses_relationtype_enum_old" USING "relationType"::"text"::"public"."user_courses_relationtype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_courses_relationtype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_courses_relationtype_enum_old" RENAME TO "user_courses_relationtype_enum"`,
    );
  }
}
```

## 1788178632710-AddGrades.ts

SHA256: `12e90222ad1034b804f0727e51d41db1f6147b3805d340c80fe84669e0d6a604`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | id_grade, score, id_enrollment, id_grade_scheme_detail |
| Tablas | enrollments, grade_scheme_details, grades |
| ENUM | — |
| CHECK | — |
| FK | FK_421006c2a31cb43a9b1dc59c14f, FK_44f5853d3d2dfff14ba4baef979 |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGrades1788178632710 implements MigrationInterface {
  name = 'AddGrades1788178632710';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "grades" ("id_grade" SERIAL NOT NULL, "score" numeric(5,2) NOT NULL, "id_enrollment" integer, "id_grade_scheme_detail" integer, CONSTRAINT "PK_5bd2dbb0d11d80321f01c1e5327" PRIMARY KEY ("id_grade"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "grades" ADD CONSTRAINT "FK_421006c2a31cb43a9b1dc59c14f" FOREIGN KEY ("id_enrollment") REFERENCES "enrollments"("id_enrollment") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "grades" ADD CONSTRAINT "FK_44f5853d3d2dfff14ba4baef979" FOREIGN KEY ("id_grade_scheme_detail") REFERENCES "grade_scheme_details"("id_grade_scheme_detail") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grades" DROP CONSTRAINT "FK_44f5853d3d2dfff14ba4baef979"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grades" DROP CONSTRAINT "FK_421006c2a31cb43a9b1dc59c14f"`,
    );
    await queryRunner.query(`DROP TABLE "grades"`);
  }
}
```

## 1789015901575-AddActivitiesEntity.ts

SHA256: `8306e74b6867ea87da64cf087a2ca44b80422b5854c5c1d5418960b45c6b6106`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | is_active, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at, id_activity, name, description, activity_date, order, id_grade_scheme_detail |
| Tablas | activities, grade_scheme_details |
| ENUM | — |
| CHECK | — |
| FK | FK_727ff3b915f5b88d1d0cb15374a |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivitiesEntity1789015901575 implements MigrationInterface {
  name = 'AddActivitiesEntity1789015901575';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "activities" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_activity" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "activity_date" date NOT NULL, "order" integer NOT NULL, "id_grade_scheme_detail" integer, CONSTRAINT "PK_8bd879b3d37dfbed063cdda0a72" PRIMARY KEY ("id_activity"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD CONSTRAINT "FK_727ff3b915f5b88d1d0cb15374a" FOREIGN KEY ("id_grade_scheme_detail") REFERENCES "grade_scheme_details"("id_grade_scheme_detail") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" DROP CONSTRAINT "FK_727ff3b915f5b88d1d0cb15374a"`,
    );
    await queryRunner.query(`DROP TABLE "activities"`);
  }
}
```

## 1789074562933-RelationsBetweenActivitiesAndGraes.ts

SHA256: `d2048473faf9bcecdb57d17867700ea7f950757b2a8c4c3a1838a8e16b9f39dd`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | id_activity |
| Tablas | activities, grades |
| ENUM | — |
| CHECK | — |
| FK | FK_3ee6200681c2e5b481291c1f50c |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelationsBetweenActivitiesAndGraes1789074562933 implements MigrationInterface {
  name = 'RelationsBetweenActivitiesAndGraes1789074562933';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grades" ADD "id_activity" integer`);
    await queryRunner.query(
      `ALTER TABLE "grades" ADD CONSTRAINT "FK_3ee6200681c2e5b481291c1f50c" FOREIGN KEY ("id_activity") REFERENCES "activities"("id_activity") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grades" DROP CONSTRAINT "FK_3ee6200681c2e5b481291c1f50c"`,
    );
    await queryRunner.query(`ALTER TABLE "grades" DROP COLUMN "id_activity"`);
  }
}
```

## 1789079384425-AddRelationsEnrollmentToGradeScheme.ts

SHA256: `81130fdb3d5d1d604f41f2fb1beed82846a7ffa4e02050b72b2c5c474584e9e1`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | assistant_percentage, id_assistant_enrollment, id_enrollment |
| Tablas | enrollments, grade_schemes |
| ENUM | — |
| CHECK | — |
| FK | FK_6dccc4d4f0d1d8d5ba4e210f7da |
| UNIQUE | UQ_6dccc4d4f0d1d8d5ba4e210f7da |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelationsEnrollmentToGradeScheme1789079384425 implements MigrationInterface {
  name = 'AddRelationsEnrollmentToGradeScheme1789079384425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grade_schemes" ADD "assistant_percentage" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "grade_schemes" ADD "id_assistant_enrollment" integer`);
    await queryRunner.query(
      `ALTER TABLE "grade_schemes" ADD CONSTRAINT "UQ_6dccc4d4f0d1d8d5ba4e210f7da" UNIQUE ("id_assistant_enrollment")`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_schemes" ADD CONSTRAINT "FK_6dccc4d4f0d1d8d5ba4e210f7da" FOREIGN KEY ("id_assistant_enrollment") REFERENCES "enrollments"("id_enrollment") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "grade_schemes" DROP CONSTRAINT "FK_6dccc4d4f0d1d8d5ba4e210f7da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_schemes" DROP CONSTRAINT "UQ_6dccc4d4f0d1d8d5ba4e210f7da"`,
    );
    await queryRunner.query(`ALTER TABLE "grade_schemes" DROP COLUMN "id_assistant_enrollment"`);
    await queryRunner.query(`ALTER TABLE "grade_schemes" DROP COLUMN "assistant_percentage"`);
  }
}
```

## 1789148941792-AddAttendance.ts

SHA256: `f92b2a2dd8befb38dd6d32d2076e5e44d676f39ed9d0b8715310e4d56e05f150`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | id_attendance_session, date, id_assistant_enrollment, id_attendance, status, id_enrollment |
| Tablas | attendance_sessions, attendances, enrollments |
| ENUM | attendances_status_enum |
| CHECK | — |
| FK | FK_125f6bff41a7a139d29efe0f8d9, FK_8d240a659136363e9c77c4c8b5d, FK_ae207cbed19a342c7f59944b176 |
| UNIQUE | UQ_7880aee9d2b1416261167c83e86, UQ_8cd3866ee6beebfc50a0bab1962 |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
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
```

## 1790926042143-AddBulkOperations.ts

SHA256: `0f91afd715740bcf9896f1c2c24db8d027704af16af65582e6611e84388c9f24`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | id_bulk_operation, type, status, created_by, total_rows, valid_rows, invalid_rows, processed_rows, failed_rows, metadata, created_at, updated_at, started_at, completed_at, expires_at, id_user, id_bulk_operation_row, row_number, data, valid, errors |
| Tablas | bulk_operation_rows, bulk_operations, users |
| ENUM | bulk_operation_rows_status_enum, bulk_operations_status_enum, bulk_operations_type_enum |
| CHECK | CHK_bulk_operation_rows_row_number, CHK_bulk_operations_counts |
| FK | FK_bulk_operation_rows_operation, FK_bulk_operations_created_by |
| UNIQUE | UQ_bulk_operation_rows_operation_row |
| Índices | IDX_bulk_operation_rows_operation_status, IDX_bulk_operation_rows_operation_valid, IDX_bulk_operations_created_at, IDX_bulk_operations_created_by, IDX_bulk_operations_expires_at, IDX_bulk_operations_status, IDX_bulk_operations_type, UQ_bulk_operation_rows_operation_row |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBulkOperations1790926042143 implements MigrationInterface {
  name = 'AddBulkOperations1790926042143';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum" AS ENUM('USER_IMPORT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_status_enum" AS ENUM('PENDING', 'PROCESSING', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operation_rows_status_enum" AS ENUM('PENDING', 'PROCESSED', 'FAILED')`,
    );
    await queryRunner.query(`CREATE TABLE "bulk_operations" (
        "id_bulk_operation" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."bulk_operations_type_enum" NOT NULL,
        "status" "public"."bulk_operations_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_by" integer NOT NULL,
        "total_rows" integer NOT NULL DEFAULT 0,
        "valid_rows" integer NOT NULL DEFAULT 0,
        "invalid_rows" integer NOT NULL DEFAULT 0,
        "processed_rows" integer NOT NULL DEFAULT 0,
        "failed_rows" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        CONSTRAINT "PK_bulk_operations" PRIMARY KEY ("id_bulk_operation"),
        CONSTRAINT "CHK_bulk_operations_counts" CHECK ("total_rows" >= 0 AND "valid_rows" >= 0 AND "invalid_rows" >= 0 AND "processed_rows" >= 0 AND "failed_rows" >= 0 AND "valid_rows" + "invalid_rows" = "total_rows" AND "processed_rows" + "failed_rows" <= "total_rows"),
        CONSTRAINT "FK_bulk_operations_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`);
    await queryRunner.query(`CREATE TABLE "bulk_operation_rows" (
        "id_bulk_operation_row" SERIAL NOT NULL,
        "id_bulk_operation" uuid NOT NULL,
        "row_number" integer NOT NULL,
        "data" jsonb NOT NULL,
        "valid" boolean NOT NULL,
        "errors" jsonb,
        "status" "public"."bulk_operation_rows_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bulk_operation_rows" PRIMARY KEY ("id_bulk_operation_row"),
        CONSTRAINT "CHK_bulk_operation_rows_row_number" CHECK ("row_number" > 0),
        CONSTRAINT "FK_bulk_operation_rows_operation" FOREIGN KEY ("id_bulk_operation") REFERENCES "bulk_operations"("id_bulk_operation") ON DELETE CASCADE ON UPDATE NO ACTION
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_created_by" ON "bulk_operations" ("created_by")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_type" ON "bulk_operations" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_status" ON "bulk_operations" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_created_at" ON "bulk_operations" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operations_expires_at" ON "bulk_operations" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bulk_operation_rows_operation_row" ON "bulk_operation_rows" ("id_bulk_operation", "row_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operation_rows_operation_valid" ON "bulk_operation_rows" ("id_bulk_operation", "valid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operation_rows_operation_status" ON "bulk_operation_rows" ("id_bulk_operation", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bulk_operation_rows"`);
    await queryRunner.query(`DROP TABLE "bulk_operations"`);
    await queryRunner.query(`DROP TYPE "public"."bulk_operation_rows_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum"`);
    // uuid-ossp may be shared by other tables; deliberately retain the extension.
  }
}
```

## 1790973495493-AddCompletedWithErrors.ts

SHA256: `f17b88f28a8aed0f33f2653df0dd6642925055aa3c5ea48658a4bdf516133bd9`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | status |
| Tablas | bulk_operations |
| ENUM | bulk_operations_status_enum, bulk_operations_status_enum_old |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompletedWithErrors1790973495493 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_status_enum" ADD VALUE IF NOT EXISTS 'COMPLETED_WITH_ERRORS'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bulk_operations" SET "status" = 'FAILED' WHERE "status"::text = 'COMPLETED_WITH_ERRORS'`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_status_enum" RENAME TO "bulk_operations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_status_enum" AS ENUM('PENDING','PROCESSING','READY','IMPORTING','COMPLETED','FAILED','EXPIRED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" TYPE "public"."bulk_operations_status_enum" USING "status"::text::"public"."bulk_operations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_status_enum_old"`);
  }
}
```

## 1791223200000-ActivityPublicationAndDeadline.ts

SHA256: `73bc7d73a107e82a59c6a6cefeb21e6085bbb04be4aa424cacca36c2eab76bea`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | activity_date, due_date, published_at, created_at, order, id_activity, id_grade_scheme_detail |
| Tablas | activities |
| ENUM | — |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityPublicationAndDeadline1791223200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates: unknown = await queryRunner.query(
      `WITH scheme_courses AS (
        SELECT s.id_grade_scheme, e.id_course FROM grade_schemes s
        JOIN enrollments e ON e.id_enrollment = s.id_assistant_enrollment
        UNION
        SELECT id_grade_scheme, id_course FROM courses WHERE id_grade_scheme IS NOT NULL
      ), activity_courses AS (
        SELECT DISTINCT a.id_activity, a.name, scope.id_course
        FROM activities a
        JOIN grade_scheme_details d ON d.id_grade_scheme_detail = a.id_grade_scheme_detail
        JOIN grade_schemes s ON s.id_grade_scheme = d.id_grade_scheme
        JOIN scheme_courses scope ON scope.id_grade_scheme = s.id_grade_scheme
        WHERE a.is_active = true AND a.deleted_at IS NULL
      )
      SELECT id_course, ARRAY_AGG(id_activity ORDER BY id_activity) AS activity_ids
      FROM activity_courses WHERE id_course IS NOT NULL
      GROUP BY id_course, LOWER(BTRIM(name)) HAVING COUNT(*) > 1`,
    );
    if (!Array.isArray(duplicates))
      throw new Error('No se pudo verificar la unicidad de actividades');
    if (duplicates.length) {
      throw new Error(
        `Existen nombres de actividades activas duplicados. Renombrar o desactivar antes de migrar: ${JSON.stringify(duplicates)}`,
      );
    }
    await queryRunner.query(`ALTER TABLE "activities" RENAME COLUMN "activity_date" TO "due_date"`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "published_at" timestamptz`);
    // Legacy timestamps have no zone: retain PostgreSQL's implicit session-zone interpretation.
    await queryRunner.query(
      `UPDATE "activities" SET "published_at" = "created_at" AT TIME ZONE current_setting('TimeZone')`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ALTER COLUMN "published_at" SET NOT NULL, ALTER COLUMN "published_at" SET DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "order"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" ADD "order" integer`);
    // The retired manual order cannot be recovered; reconstruct the deterministic display order.
    await queryRunner.query(
      `UPDATE "activities" AS activity SET "order" = ranked.position FROM (SELECT "id_activity", ROW_NUMBER() OVER (PARTITION BY "id_grade_scheme_detail" ORDER BY "due_date", "created_at", "id_activity") AS position FROM "activities") AS ranked WHERE activity."id_activity" = ranked."id_activity"`,
    );
    await queryRunner.query(`ALTER TABLE "activities" ALTER COLUMN "order" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "published_at"`);
    await queryRunner.query(`ALTER TABLE "activities" RENAME COLUMN "due_date" TO "activity_date"`);
  }
}
```

## 1791317489801-EditActivityFields.ts

SHA256: `b25e136ce9b2bb770824ba61a3d44030fd308658c7be76f4cfa6b1d8ce5a5961`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | published_at, publication_date, type, text, status, id_bulk_operation |
| Tablas | activities, bulk_operation_rows, bulk_operations |
| ENUM | bulk_operation_rows_status_enum, bulk_operation_rows_status_enum_old, bulk_operations_status_enum, bulk_operations_status_enum_old, bulk_operations_type_enum, bulk_operations_type_enum_old |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | IDX_bulk_operation_rows_operation_status |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EditActivityFields1791317489801 implements MigrationInterface {
  name = 'EditActivityFields1791317489801';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" RENAME COLUMN "published_at" TO "publication_date"`,
    );
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "publication_date"`);
    await queryRunner.query(`ALTER TABLE "activities" ADD "publication_date" date`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" RENAME TO "bulk_operations_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum" AS ENUM('USER_IMPORT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "type" TYPE "public"."bulk_operations_type_enum" USING "type"::"text"::"public"."bulk_operations_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_status_enum" RENAME TO "bulk_operations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_status_enum" AS ENUM('PENDING', 'PROCESSING', 'READY', 'IMPORTING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'EXPIRED')`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" TYPE "public"."bulk_operations_status_enum" USING "status"::"text"::"public"."bulk_operations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_status_enum_old"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bulk_operation_rows_operation_status"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operation_rows_status_enum" RENAME TO "bulk_operation_rows_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operation_rows_status_enum" AS ENUM('PENDING', 'PROCESSED', 'FAILED')`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" TYPE "public"."bulk_operation_rows_status_enum" USING "status"::"text"::"public"."bulk_operation_rows_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operation_rows_status_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operation_rows_operation_status" ON "bulk_operation_rows" ("id_bulk_operation", "status") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_bulk_operation_rows_operation_status"`);
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operation_rows_status_enum_old" AS ENUM('PENDING', 'PROCESSED', 'FAILED')`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" TYPE "public"."bulk_operation_rows_status_enum_old" USING "status"::"text"::"public"."bulk_operation_rows_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operation_rows" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operation_rows_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operation_rows_status_enum_old" RENAME TO "bulk_operation_rows_status_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bulk_operation_rows_operation_status" ON "bulk_operation_rows" ("id_bulk_operation", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_status_enum_old" AS ENUM('PENDING', 'PROCESSING', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED', 'EXPIRED', 'COMPLETED_WITH_ERRORS')`,
    );
    await queryRunner.query(`ALTER TABLE "bulk_operations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" TYPE "public"."bulk_operations_status_enum_old" USING "status"::"text"::"public"."bulk_operations_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_status_enum_old" RENAME TO "bulk_operations_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum_old" AS ENUM('USER_IMPORT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "type" TYPE "public"."bulk_operations_type_enum_old" USING "type"::"text"::"public"."bulk_operations_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum_old" RENAME TO "bulk_operations_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "publication_date"`);
    await queryRunner.query(
      `ALTER TABLE "activities" ADD "publication_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" RENAME COLUMN "publication_date" TO "published_at"`,
    );
  }
}
```

## 1791547200000-UniqueActivityGrade.ts

SHA256: `fc945ba49e1422ef91205574e7a276a6464c158117f321c43d10dbe1b651304f`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | id_enrollment, id_activity |
| Tablas | grades |
| ENUM | — |
| CHECK | — |
| FK | — |
| UNIQUE | UQ_grade_enrollment_activity |
| Índices | UQ_grade_enrollment_activity |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueActivityGrade1791547200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing duplicate data must be reviewed, never silently deleted by a migration.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_grade_enrollment_activity" ON "grades" ("id_enrollment", "id_activity") WHERE "id_activity" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_grade_enrollment_activity"`);
  }
}
```

## 1791655200000-AttendanceExcusedWeight.ts

SHA256: `fff416910a8e5bc9a8856a18d1dc71229c02cb0def7eee4bc0dc64b0678df88d`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | permission_weight, status |
| Tablas | attendances, grade_scheme_details |
| ENUM | attendances_status_enum, attendances_status_enum_old |
| CHECK | CHK_attendance_permission_weight |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceExcusedWeight1791655200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."attendances_status_enum" ADD VALUE 'EXCUSED'`);
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD "permission_weight" double precision NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "grade_scheme_details" ADD CONSTRAINT "CHK_attendance_permission_weight" CHECK ("permission_weight" >= 0 AND "permission_weight" <= 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse to discard the distinct academic category when EXCUSED records exist.
    await queryRunner.query(
      `CREATE TYPE "public"."attendances_status_enum_old" AS ENUM ('PRESENT', 'ABSENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ALTER COLUMN "status" TYPE "public"."attendances_status_enum_old" USING "status"::text::"public"."attendances_status_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."attendances_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."attendances_status_enum_old" RENAME TO "attendances_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "grade_scheme_details" DROP COLUMN "permission_weight"`);
  }
}
```

## 1791662400000-AttendanceObservation.ts

SHA256: `c42300077111c23e9d22070958d245114669916a76ffb7a0bf93788277e5336b`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | observation |
| Tablas | attendances |
| ENUM | — |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceObservation1791662400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "attendances" ADD "observation" character varying(500)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "attendances" DROP COLUMN "observation"');
  }
}
```

## 1792526400000-AddAcademicImportTypes.ts

SHA256: `57b365841476a75586c6b4b51ccc7a472dac8979b2ba6dbaff10e10828d86000`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | type |
| Tablas | bulk_operations |
| ENUM | bulk_operations_type_enum, bulk_operations_type_enum_old |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAcademicImportTypes1792526400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" ADD VALUE IF NOT EXISTS 'ENROLLMENT_IMPORT'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" ADD VALUE IF NOT EXISTS 'CAREER_STUDENT_IMPORT'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse a rollback that would discard persisted academic previews or import history.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "bulk_operations" WHERE "type"::text IN ('ENROLLMENT_IMPORT', 'CAREER_STUDENT_IMPORT')) THEN
        RAISE EXCEPTION 'Cannot remove academic import types while operations exist';
      END IF;
    END $$`);
    await queryRunner.query(
      `ALTER TYPE "public"."bulk_operations_type_enum" RENAME TO "bulk_operations_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bulk_operations_type_enum" AS ENUM('USER_IMPORT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bulk_operations" ALTER COLUMN "type" TYPE "public"."bulk_operations_type_enum" USING "type"::text::"public"."bulk_operations_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bulk_operations_type_enum_old"`);
  }
}
```

## 1792620000000-ArchiveAssistantCriteria.ts

SHA256: `0fa8943a8b23f60a5a980d7f576f6de08d27a7c5198999cc49f4c5908501d685`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | is_active, archived_at |
| Tablas | grade_scheme_details |
| ENUM | — |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArchiveAssistantCriteria1792620000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grade_scheme_details"
      ADD COLUMN "is_active" boolean NOT NULL DEFAULT true,
      ADD COLUMN "archived_at" timestamp NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the flag would silently reintroduce archived scores into current totals.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "grade_scheme_details" WHERE NOT "is_active") THEN
        RAISE EXCEPTION 'Cannot revert while archived criteria exist';
      END IF;
    END $$`);
    await queryRunner.query(`ALTER TABLE "grade_scheme_details"
      DROP COLUMN "archived_at", DROP COLUMN "is_active"`);
  }
}
```

## 1792886400000-AttendanceGeolocationModel.ts

SHA256: `4cf266813f2d1e3bdd435b8dc2b6960c97b1cb72efbd6539a2aeccb49dd3eaa6`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | mode, latitude, longitude, radius_meters, maximum_accepted_accuracy, starts_at, ends_at, opened_at, closed_at, cancelled_at, registration_method, marked_at, id_marked_by, accuracy, distance_meters, id_user, status |
| Tablas | attendance_sessions, attendances, users |
| ENUM | attendance_sessions_mode_enum, attendances_registration_method_enum |
| CHECK | CHK_attendance_accuracy, CHK_attendance_distance, CHK_attendance_geo_evidence, CHK_attendance_geo_status, CHK_attendance_session_closed_cancelled, CHK_attendance_session_closed_end, CHK_attendance_session_closed_opened, CHK_attendance_session_closed_start, CHK_attendance_session_geo_configuration, CHK_attendance_session_latitude, CHK_attendance_session_longitude, CHK_attendance_session_manual_fields, CHK_attendance_session_maximum_accuracy, CHK_attendance_session_radius, CHK_attendance_session_window |
| FK | FK_attendance_marked_by |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
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
```

## 1794355200000-AttendanceQrEnums.ts

SHA256: `2a0f072dc96207ae14792799d2ea4e08b82846a7668bb93c865bbcb72e408074`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | — |
| Tablas | public |
| ENUM | attendance_sessions_mode_enum, attendances_registration_method_enum, public |
| CHECK | — |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';
import { lockAttendanceQrRollback } from '../utils/attendance-qr-rollback';

export class AttendanceQrEnums1794355200000 implements MigrationInterface {
  // TypeORM rejects the default "all" mode before running pending migrations.
  // --transaction each commits this migration before the QR CHECKs use the labels.
  transaction = true;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."attendance_sessions_mode_enum" ADD VALUE 'QR'`);
    await queryRunner.query(
      `ALTER TYPE "public"."attendances_registration_method_enum" ADD VALUE 'QR'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await lockAttendanceQrRollback(queryRunner);
    // PostgreSQL has no DROP VALUE. Preserve the actual CHECK definitions while
    // changing their column types, then recreate them against the narrowed enums.
    // Unknown dependencies fail atomically; never use DROP ... CASCADE.
    for (const [table, column, type, checks] of [
      [
        'attendance_sessions',
        'mode',
        'attendance_sessions_mode_enum',
        ['CHK_attendance_session_geo_configuration', 'CHK_attendance_session_manual_fields'],
      ],
      [
        'attendances',
        'registration_method',
        'attendances_registration_method_enum',
        ['CHK_attendance_geo_evidence', 'CHK_attendance_geo_status'],
      ],
    ] as const) {
      const definitions: unknown = await queryRunner.query(
        `SELECT conname AS name, pg_get_constraintdef(oid) AS definition
         FROM pg_constraint WHERE conrelid = $1::regclass AND conname = ANY($2::text[])`,
        [`public.${table}`, checks],
      );
      if (!Array.isArray(definitions) || definitions.length !== checks.length)
        throw new Error('QR rollback requires the existing MANUAL/GEO CHECKs');
      const preserved: { name: string; definition: string }[] = [];
      for (const row of definitions as unknown[]) {
        if (
          !row ||
          typeof row !== 'object' ||
          !('name' in row) ||
          typeof row.name !== 'string' ||
          !('definition' in row) ||
          typeof row.definition !== 'string'
        )
          throw new Error('Unexpected PostgreSQL CHECK metadata');
        preserved.push({ name: row.name, definition: row.definition });
      }
      for (const check of checks)
        await queryRunner.query(`ALTER TABLE "public"."${table}" DROP CONSTRAINT "${check}"`);
      await queryRunner.query(
        `CREATE TYPE "public"."${type}_without_qr" AS ENUM ('MANUAL', 'GEOLOCATION')`,
      );
      await queryRunner.query(
        `ALTER TABLE "public"."${table}" ALTER COLUMN "${column}" DROP DEFAULT`,
      );
      await queryRunner.query(
        `ALTER TABLE "public"."${table}" ALTER COLUMN "${column}" TYPE "public"."${type}_without_qr"
         USING "${column}"::text::"public"."${type}_without_qr"`,
      );
      await queryRunner.query(`DROP TYPE "public"."${type}"`);
      await queryRunner.query(`ALTER TYPE "public"."${type}_without_qr" RENAME TO "${type}"`);
      await queryRunner.query(
        `ALTER TABLE "public"."${table}" ALTER COLUMN "${column}" SET DEFAULT 'MANUAL'`,
      );
      for (const check of preserved)
        await queryRunner.query(
          `ALTER TABLE "public"."${table}" ADD CONSTRAINT "${check.name}" ${check.definition}`,
        );
    }
  }
}
```

## 1794355260000-AttendanceQrChecks.ts

SHA256: `891ceba5d02d1967250a191e21115b305a6218619fe5f9d7e30a824275947e31`

| Elemento | Operaciones mencionadas en up/down |
|---|---|
| Columnas / identificadores SQL (incluye referencias) | mode, id_assistant_enrollment, latitude, longitude, radius_meters, maximum_accepted_accuracy, date, starts_at, ends_at, opened_at, closed_at, cancelled_at, registration_method, status, marked_at, id_marked_by, id_attendance_session, id_enrollment, accuracy, distance_meters |
| Tablas | attendance_sessions, attendances |
| ENUM | — |
| CHECK | CHK_attendance_qr_evidence, CHK_attendance_session_qr_fields, CHK_attendance_session_qr_window |
| FK | — |
| UNIQUE | — |
| Índices | — |

Columnas, defaults, tipos, dependencias concretas y operaciones up/down: definición exacta siguiente (incluye guardas; no ejecutar como script SQL).

```typescript
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
```
