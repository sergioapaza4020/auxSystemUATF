import { AttendanceStatus } from '@/enums/attendanceStatus';
import type { IAttendance } from '@/interfaces/attendances/attendance.interface';

export function normalizeAttendanceObservation(status: AttendanceStatus, value?: string | null): string | null {
  return status === AttendanceStatus.EXCUSED ? value?.trim() || null : null;
}

export function attendanceSnapshot(
  ids: number[],
  records: Pick<IAttendance, 'status' | 'observation' | 'enrollment'>[],
) {
  const attendance: Record<number, AttendanceStatus> = {};
  const observations: Record<number, string | null> = {};

  for (const id of ids) {
    attendance[id] = AttendanceStatus.ABSENT;
    observations[id] = null;
  }

  for (const record of records) {
    const id = record.enrollment.idEnrollment;

    if (!(id in attendance)) continue;
    attendance[id] = record.status;
    observations[id] = normalizeAttendanceObservation(record.status, record.observation);
  }

  return { attendance, observations };
}
