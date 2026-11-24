import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceMultipleDailySessions1794700800000 implements MigrationInterface {
  transaction = true;

  async up(runner: QueryRunner): Promise<void> {
    // Identify by columns, including installations where the constraint was renamed.
    await runner.query(`DO $$
    DECLARE target record; matches integer := 0;
    BEGIN
      LOCK TABLE public.attendance_sessions IN ACCESS EXCLUSIVE MODE;
      FOR target IN
        SELECT c.conname FROM pg_constraint c
        WHERE c.conrelid = 'public.attendance_sessions'::regclass AND c.contype = 'u'
        AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
          FROM unnest(c.conkey) k(attnum)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
          = ARRAY['date', 'id_assistant_enrollment']::text[]
      LOOP
        matches := matches + 1;
        EXECUTE format('ALTER TABLE public.attendance_sessions DROP CONSTRAINT %I', target.conname);
      END LOOP;
      IF matches <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one assistant/date unique constraint, found %', matches;
      END IF;
      -- DROP CONSTRAINT removes its owned unique index. Preserve history/aggregate lookup access.
      CREATE INDEX "IDX_attendance_session_assistant_date"
        ON public.attendance_sessions (id_assistant_enrollment, date);
    END $$`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DO $$
    BEGIN
      LOCK TABLE public.attendance_sessions IN ACCESS EXCLUSIVE MODE;
      IF EXISTS (SELECT 1 FROM public.attendance_sessions
        WHERE id_assistant_enrollment IS NOT NULL
        GROUP BY id_assistant_enrollment, date HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'ROLLBACK_BLOCKED: multiple attendance sessions per assistant/date; preserve sessions and use a forward correction';
      END IF;
      ALTER TABLE public.attendance_sessions ADD CONSTRAINT "UQ_8cd3866ee6beebfc50a0bab1962"
        UNIQUE (id_assistant_enrollment, date);
      DROP INDEX public."IDX_attendance_session_assistant_date";
    END $$`);
  }
}
