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
