import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { AttendanceStatus } from '@/enums/attendanceStatus';

export interface IAttendanceSession {
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
}

export interface IAttendanceSessionSummary {
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
