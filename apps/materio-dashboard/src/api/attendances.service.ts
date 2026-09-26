import { instance } from './config/config';
import type { AttendanceStatus } from '@/enums/attendanceStatus';

import type {
  IAttendanceSession,
  IAttendance,
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

export const saveAttendances = async (idSession: number, data: IAttendanceSave): Promise<IAttendance[]> => {
  const response = await instance.post(`/attendances/sessions/${idSession}`, data);

  return response.data.data;
};

export const updateAttendanceSession = async (idSession: number, date: string): Promise<IAttendanceSession> => {
  const response = await instance.patch(`/attendances/sessions/${idSession}`, { date });

  return response.data.data;
};

export const deleteAttendanceSession = async (idSession: number): Promise<void> => {
  await instance.delete(`/attendances/sessions/${idSession}`);
};

export const deleteAttendance = async (idSession: number, idEnrollment: number): Promise<void> => {
  await instance.delete(`/attendances/sessions/${idSession}/students/${idEnrollment}`);
};

export const getStudentAttendance = async (idEnrollment: number): Promise<IStudentAttendance> => {
  const response = await instance.get(`/attendances/student/${idEnrollment}`);

  return response.data.data;
};
