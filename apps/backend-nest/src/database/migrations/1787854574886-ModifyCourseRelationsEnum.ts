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
