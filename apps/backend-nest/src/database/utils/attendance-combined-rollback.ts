import { QueryRunner } from 'typeorm';

/** Catalog results are untrusted at the query boundary, as in the QR rollback. */
export async function attendanceCombinedCatalogRows(
  runner: QueryRunner,
  sql: string,
  parameters?: unknown[],
): Promise<unknown[]> {
  const result: unknown = await runner.query(sql, parameters);
  if (!Array.isArray(result)) throw new Error('COMBINED_ROLLBACK_BLOCKED: invalid catalog result');
  return result.map((row: unknown) => row);
}

/** Fail before DDL; never clean temporary rows or academic evidence implicitly. */
export async function lockAttendanceCombinedRollback(runner: QueryRunner): Promise<void> {
  if (!runner.isTransactionActive)
    throw new Error('COMBINED_ROLLBACK_BLOCKED: transaction each is required');
  await runner.query(
    'LOCK TABLE public.attendance_sessions, public.attendances IN ACCESS EXCLUSIVE MODE',
  );
  for (const table of ['attendance_combined_authorizations', 'attendance_audit_events']) {
    const exists = await attendanceCombinedCatalogRows(runner, 'SELECT to_regclass($1) AS name', [
      `public.${table}`,
    ]);
    const row = exists[0];
    if (!row || typeof row !== 'object' || !('name' in row))
      throw new Error('COMBINED_ROLLBACK_BLOCKED: invalid table metadata');
    if (row.name) {
      await runner.query(`LOCK TABLE public."${table}" IN ACCESS EXCLUSIVE MODE`);
      const rows = await attendanceCombinedCatalogRows(
        runner,
        `SELECT 1 FROM public."${table}" LIMIT 1`,
      );
      if (rows.length) throw new Error(`COMBINED_ROLLBACK_BLOCKED: ${table} is not empty`);
    }
  }
  await runner.query(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM public.attendance_sessions WHERE mode::text = 'GEOLOCATION_QR')
      OR EXISTS (SELECT 1 FROM public.attendances WHERE registration_method::text = 'GEOLOCATION_QR')
    THEN RAISE EXCEPTION 'COMBINED_ROLLBACK_BLOCKED: combined sessions or evidence exist'; END IF;
  END $$`);
  // Refuse known external dependencies before destructive DDL; restrictive DROP
  // remains the final guard for dependencies not represented by these catalogs.
  const dependencies = await attendanceCombinedCatalogRows(
    runner,
    `
    WITH targets AS (
      SELECT oid FROM pg_class WHERE oid IN (
        to_regclass('public.attendance_sessions'), to_regclass('public.attendances'),
        to_regclass('public.attendance_combined_authorizations'), to_regclass('public.attendance_audit_events'))
    )
    SELECT 1 FROM pg_depend d JOIN pg_rewrite r ON d.classid = 'pg_rewrite'::regclass AND r.oid = d.objid
    WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid IN (SELECT oid FROM targets)
      AND r.ev_class NOT IN (SELECT oid FROM targets)
    UNION ALL
    SELECT 1 FROM pg_constraint WHERE contype = 'f' AND confrelid IN (SELECT oid FROM targets)
      AND conrelid NOT IN (SELECT oid FROM targets)
    LIMIT 1`,
  );
  if (dependencies.length)
    throw new Error('COMBINED_ROLLBACK_BLOCKED: external table dependencies require review');
}
