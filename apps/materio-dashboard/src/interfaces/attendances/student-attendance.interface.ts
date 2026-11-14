import type { AttendanceStatus } from '@/enums/attendanceStatus';
import type { AttendanceSessionState } from './attendance.interface';

// Separate from the owner's contract: no center, radius or other students' data.
export interface IMyAttendanceSession {
  idAttendanceSession: number;
  date: string;
  startsAt: string;
  endsAt: string;
  state: AttendanceSessionState;
  isComputable: boolean;
  alreadyRegistered: boolean;
  ownStatus: AttendanceStatus | null;
  ownMarkedAt: string | null;
}

export interface IMyAttendanceSessionsResponse {
  data: IMyAttendanceSession[];
  meta: { limit: number; hasMore: boolean; upcomingUntil: string };
}

export interface AttendanceCheckInPayload {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface AttendanceCheckInResult {
  code: 'SUCCESS';
  idAttendance: number;
  status: AttendanceStatus.PRESENT;
  registrationMethod: 'GEOLOCATION';
  markedAt: string;
}
