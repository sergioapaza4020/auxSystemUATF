import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { AttendanceStatus } from '@/enums/attendanceStatus';

export interface IAttendanceSession {
  idAttendanceSession: number;
  date: string;
  attendances?: IAttendance[];
  presentCount: number;
  absentCount: number;
}

export interface IAttendance {
  idAttendance: number;
  status: AttendanceStatus;
  enrollment: IEnrollmentStudent;
}

export interface IAttendanceSessionSummary {
  idAttendanceSession: number;
  date: string;
  presentCount: number;
  absentCount: number;
}

export interface IAttendanceSessionDetail extends IAttendanceSession {
  attendances: IAttendance[];
}

export interface IStudentAttendance {
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  percentage: number;
}
