import { Repository } from 'typeorm';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { attendanceSessionComputableSql } from './attendance-session-policy';

export interface AcademicAttendanceCount {
  enrollmentId: number;
  total: number;
  present: number;
  excused: number;
}

/** One statement/snapshot and one materialized session set for both counts. */
export async function academicAttendanceCounts(
  repository: Repository<Attendance>,
  assistantId: number,
  studentIds: number[],
  now: Date,
): Promise<AcademicAttendanceCount[]> {
  if (!studentIds.length) return [];
  const policy = attendanceSessionComputableSql('session').replaceAll(':attendanceNow', '$3');
  const result: unknown = await repository.query(
    `WITH computable AS MATERIALIZED (
    SELECT session.id_attendance_session FROM attendance_sessions session
    WHERE session.id_assistant_enrollment = $1 AND ${policy}
  ), totals AS (SELECT count(*)::int AS total FROM computable), marks AS (
    SELECT a.id_enrollment,
      count(*) FILTER (WHERE a.status = 'PRESENT')::int AS present,
      count(*) FILTER (WHERE a.status = 'EXCUSED')::int AS excused
    FROM attendances a INNER JOIN computable c USING (id_attendance_session)
    WHERE a.id_enrollment = ANY($2::int[]) GROUP BY a.id_enrollment
  ) SELECT selected.id AS "enrollmentId", totals.total,
    coalesce(marks.present, 0) AS present, coalesce(marks.excused, 0) AS excused
    FROM unnest($2::int[]) selected(id) CROSS JOIN totals
    LEFT JOIN marks ON marks.id_enrollment = selected.id`,
    [assistantId, studentIds, now],
  );
  if (!Array.isArray(result)) throw new Error('Invalid attendance aggregate');
  return result.map((row: unknown) => {
    if (
      !row ||
      typeof row !== 'object' ||
      !('enrollmentId' in row) ||
      !('total' in row) ||
      !('present' in row) ||
      !('excused' in row)
    )
      throw new Error('Invalid attendance aggregate');
    const value = {
      enrollmentId: Number(row.enrollmentId),
      total: Number(row.total),
      present: Number(row.present),
      excused: Number(row.excused),
    };
    if (Object.values(value).some((item) => !Number.isSafeInteger(item) || item < 0))
      throw new Error('Invalid attendance aggregate');
    return value;
  });
}
