import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { AttendanceStatus } from '@/enums/attendanceStatus';

export type AttendanceSessionMode = 'MANUAL' | 'GEOLOCATION' | 'QR';
export type AttendanceRegistrationMethod = 'MANUAL' | 'GEOLOCATION' | 'QR';

export interface IAttendanceQrCode {
  idAttendanceSession: number;
  token: string;
  serverNow: string;
  rotateAt: string;
  expiresAt: string;
}
export type AttendanceSessionState = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELLED';

// Optional for compatibility with cached/manual responses predating lifecycle support.
export interface IAttendanceLifecycle {
  mode?: AttendanceSessionMode;
  state?: AttendanceSessionState | null;
  isComputable?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  maximumAcceptedAccuracy?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  pendingCount?: number;
}

export interface IAttendanceSession extends IAttendanceLifecycle {
  idAttendanceSession: number;
  date: string;
  attendances?: IAttendance[];
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  totalStudents: number;
  percentage: number;
}

export interface IAttendance {
  idAttendance: number;
  status: AttendanceStatus;
  observation?: string | null;
  enrollment: IEnrollmentStudent;
  registrationMethod?: AttendanceRegistrationMethod;
  markedAt?: string | null;
}

export interface IAttendanceSessionSummary extends IAttendanceLifecycle {
  idAttendanceSession: number;
  date: string;
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  totalStudents: number;
  percentage: number;
}

export interface IAttendanceSessionDetail extends IAttendanceSession {
  attendances: IAttendance[];
}

export interface IStudentAttendance {
  totalSessions: number;
  presentSessions: number;
  excusedSessions: number;
  absentSessions: number;
  percentage: number;
}
