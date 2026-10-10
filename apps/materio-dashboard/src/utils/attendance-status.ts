import { AttendanceStatus } from '@/enums/attendanceStatus';

export const attendanceStatusConfig = {
  [AttendanceStatus.PRESENT]: { color: 'success' },
  [AttendanceStatus.EXCUSED]: { color: 'warning' },
  [AttendanceStatus.ABSENT]: { color: 'error' },
} as const;

export function attendanceStatusColor(status: AttendanceStatus) {
  return `${attendanceStatusConfig[status].color}.main` as const;
}

export function attendanceSelectedSx(status: AttendanceStatus) {
  const color = attendanceStatusConfig[status].color;

  return {
    '&.Mui-selected': {
      color: `${color}.main`,
      bgcolor: `${color}.lighterOpacity`,
      borderColor: `${color}.main`,
      '& .MuiSvgIcon-root': { color: 'inherit' },
      '&:hover': { bgcolor: `${color}.lighterOpacity` },
    },
  };
}
