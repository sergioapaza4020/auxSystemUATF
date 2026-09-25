import { instance } from './config/config';
import type { AttendanceStatus } from '@/enums/attendanceStatus';

import type {
  IAttendanceSession,
  IAttendanceSessionDetail,
  IAttendanceSessionSummary,
  IStudentAttendance,
} from '@/interfaces/attendances/attendance.interface';

export interface IAttendanceSessionCreate {
  enrollmentId: number;
  date: string;
}

export interface IAttendanceRecord {
  enrollmentId: number;
  status: AttendanceStatus;
}

export interface IAttendanceSave {
  attendances: IAttendanceRecord[];
}

export const createAttendanceSession = async (data: IAttendanceSessionCreate): Promise<IAttendanceSession> => {
  const response = await instance.post('/attendances/sessions', data);

  return response.data.data;
};

export const getAttendanceSessionsByEnrollment = async (idEnrollment: number): Promise<IAttendanceSessionSummary[]> => {
  const response = await instance.get(`/attendances/sessions/enrollment/${idEnrollment}`);

  return response.data.data;
};

export const getAttendanceSession = async (idSession: number): Promise<IAttendanceSessionDetail> => {
  const response = await instance.get(`/attendances/sessions/${idSession}`);

  return response.data.data;
};

export const saveAttendances = async (idSession: number, data: IAttendanceSave): Promise<IAttendanceSessionDetail> => {
  const response = await instance.post(`/attendances/sessions/${idSession}`, data);

  return response.data.data;
};

export const getStudentAttendance = async (idEnrollment: number): Promise<IStudentAttendance> => {
  const response = await instance.get(`/attendances/student/${idEnrollment}`);

  return response.data.data;
};
