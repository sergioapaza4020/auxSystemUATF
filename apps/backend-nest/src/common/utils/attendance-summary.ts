import { attendancePercentage, isAttendanceCriterion } from '@repo/grade-calculations';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import type { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';

export function attendanceSummary(
  present: number,
  excused: number,
  total: number,
  permissionWeight = 1,
) {
  return {
    present,
    excused,
    absent: total - present - excused,
    total,
    percentage: attendancePercentage(present + excused * permissionWeight, total),
  };
}

export function summarizeAttendanceStatuses(
  statuses: AttendanceStatus[],
  total: number,
  permissionWeight = 1,
) {
  return attendanceSummary(
    statuses.filter((status) => status === AttendanceStatus.PRESENT).length,
    statuses.filter((status) => status === AttendanceStatus.EXCUSED).length,
    total,
    permissionWeight,
  );
}

export function attendancePermissionWeight(details: GradeSchemeDetail[] = []): number {
  const detail = details.find((item) => isAttendanceCriterion(item.gradeItem.name));
  return Number(detail?.permissionWeight ?? 1);
}
