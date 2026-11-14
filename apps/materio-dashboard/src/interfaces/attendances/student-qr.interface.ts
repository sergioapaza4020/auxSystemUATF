import type { AttendanceStatus } from '@/enums/attendanceStatus';
import type { AttendanceRegistrationMethod } from './attendance.interface';

export interface IQrOwnMark {
  status: AttendanceStatus;
  registrationMethod: AttendanceRegistrationMethod;
  markedAt: string | null;
}

export interface IQrContext {
  idAttendanceSession: number;
  course: { name: string; group: number | string | null };
  date: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  state: 'OPEN';
  ownMark: IQrOwnMark | null;
}

export interface IQrCheckInResult extends IQrOwnMark {
  code: 'SUCCESS';
  idAttendance: number;
  status: AttendanceStatus.PRESENT;
  registrationMethod: 'QR';
  markedAt: string;
}
