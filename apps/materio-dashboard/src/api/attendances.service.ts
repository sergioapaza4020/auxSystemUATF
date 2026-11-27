import type {
  IQrContext,
  IQrCheckInResult,
  IQrOwnMark,
  ICombinedChallenge,
  ICombinedCheckInResult,
} from '@/interfaces/attendances/student-qr.interface';
import type { StudentRosterQuery } from './enrollments.service';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { instance } from './config/config';
import type { AttendanceStatus } from '@/enums/attendanceStatus';
import type { PaginatedApiResponse } from '@/interfaces/apiResponse';
import type {
  AttendanceCheckInPayload,
  AttendanceCheckInResult,
  IMyAttendanceSessionsResponse,
} from '@/interfaces/attendances/student-attendance.interface';

import type {
  IAttendanceSession,
  IAttendance,
  IAttendanceSessionDetail,
  IAttendanceSessionSummary,
  IStudentAttendance,
  AttendanceSessionMode,
  IAttendanceLifecycle,
  IAttendanceQrCode,
  IAttendanceAuditEvent,
} from '@/interfaces/attendances/attendance.interface';

export interface IAttendanceSessionCreate {
  topic?: string | null;
  enrollmentId: number;
  date: string;
  mode?: AttendanceSessionMode;
}

export interface AttendanceGeolocationConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maximumAcceptedAccuracy: number;
  startsAt: string;
  endsAt: string;
}

export interface AttendanceQrConfig {
  startsAt: string;
  endsAt: string;
}

export const configureAttendanceQr = async (id: number, data: AttendanceQrConfig) =>
  (
    await instance.patch<{ data: IAttendanceLifecycle }>(`/attendances/sessions/${id}/qr`, {
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    })
  ).data.data;

export const getAttendanceQrCode = async (id: number, signal?: AbortSignal): Promise<IAttendanceQrCode> =>
  (await instance.get<{ data: IAttendanceQrCode }>(`/attendances/sessions/${id}/qr`, { signal })).data.data;

export const configureGeolocation = async (id: number, data: Partial<AttendanceGeolocationConfig>) =>
  (await instance.patch<{ data: IAttendanceLifecycle }>(`/attendances/sessions/${id}/geolocation`, data)).data.data;

export const activateSession = async (id: number) =>
  (await instance.patch(`/attendances/sessions/${id}/activate`)).data.data;

export const openSessionNow = async (id: number, durationMinutes?: number) => {
  const url = `/attendances/sessions/${id}/open-now`;

  const response =
    durationMinutes === undefined ? await instance.patch(url) : await instance.patch(url, { durationMinutes });

  return response.data.data;
};

export const closeSession = async (id: number) => (await instance.patch(`/attendances/sessions/${id}/close`)).data.data;

export const cancelSession = async (id: number) =>
  (await instance.patch(`/attendances/sessions/${id}/cancel`)).data.data;

export interface IAttendanceRecord {
  enrollmentId: number;
  status: AttendanceStatus;
  observation?: string | null;
}

export interface IAttendanceSave {
  attendances: IAttendanceRecord[];
  markAll?: AttendanceStatus;
}

export const createAttendanceSession = async (data: IAttendanceSessionCreate): Promise<IAttendanceSession> => {
  const response = await instance.post('/attendances/sessions', data);

  return response.data.data;
};

export interface AttendanceHistoryQuery {
  page: number;
  limit: number;
  date?: string;
}

export const getAttendanceSessionsByEnrollment = async (
  idEnrollment: number,
  query: AttendanceHistoryQuery,
  signal?: AbortSignal,
): Promise<PaginatedApiResponse<IAttendanceSessionSummary[]>> => {
  const response = await instance.get<PaginatedApiResponse<IAttendanceSessionSummary[]>>(
    `/attendances/sessions/enrollment/${idEnrollment}`,
    { params: query, signal },
  );

  return response.data;
};

export interface AttendanceSessionPage extends IAttendanceSessionDetail {
  students: IEnrollmentStudent[];
}

export const getAttendanceSession = async (
  idSession: number,
  query?: StudentRosterQuery,
  signal?: AbortSignal,
): Promise<IAttendanceSessionDetail> => {
  const response = await instance.get(`/attendances/sessions/${idSession}`, { params: query, signal });

  return response.data.data;
};

export const getAttendanceSessionPage = async (idSession: number, query: StudentRosterQuery, signal?: AbortSignal) =>
  (
    await instance.get<PaginatedApiResponse<AttendanceSessionPage>>(`/attendances/sessions/${idSession}`, {
      params: query,
      signal,
    })
  ).data;

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

export const getMyStudentAttendance = async (idEnrollment: number): Promise<IStudentAttendance> => {
  const response = await instance.get(`/attendances/student/my/${idEnrollment}`);

  return response.data.data;
};

export const getMyAttendanceSessions = async (
  idEnrollment: number,
  signal?: AbortSignal,
): Promise<IMyAttendanceSessionsResponse> =>
  (await instance.get<IMyAttendanceSessionsResponse>(`/attendances/student/my/${idEnrollment}/sessions`, { signal }))
    .data;

export const checkInAttendance = async (
  idSession: number,
  position: AttendanceCheckInPayload,
  signal?: AbortSignal,
): Promise<AttendanceCheckInResult> =>
  (
    await instance.post<{ data: AttendanceCheckInResult }>(
      `/attendances/sessions/${idSession}/check-in`,
      {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
      },
      { signal },
    )
  ).data.data;

// Student QR contracts never accept identity, status, location or marking metadata.
export const getQrContext = async (id: number, token: string, signal?: AbortSignal) =>
  (await instance.post<{ data: IQrContext }>(`/attendances/sessions/${id}/qr-context`, { token }, { signal })).data
    .data;

export const checkInWithQr = async (id: number, token: string, signal?: AbortSignal) =>
  (await instance.post<{ data: IQrCheckInResult }>(`/attendances/sessions/${id}/qr-check-in`, { token }, { signal }))
    .data.data;

export const getMyQrMark = async (id: number, signal?: AbortSignal) =>
  (await instance.get<{ data: { ownMark: IQrOwnMark | null } }>(`/attendances/sessions/${id}/qr-own-mark`, { signal }))
    .data.data;

export const getAttendanceAudit = async (
  idSession: number,
  query: { page: number; limit: number },
  signal?: AbortSignal,
): Promise<PaginatedApiResponse<IAttendanceAuditEvent[]>> =>
  (
    await instance.get<PaginatedApiResponse<IAttendanceAuditEvent[]>>(`/attendances/sessions/${idSession}/audit`, {
      params: query,
      signal,
    })
  ).data;

export const getCombinedChallenge = async (id: number, token: string, signal?: AbortSignal) =>
  (
    await instance.post<{ data: ICombinedChallenge }>(
      `/attendances/sessions/${id}/combined-challenge`,
      { token },
      { signal },
    )
  ).data.data;

export const checkInCombined = async (
  id: number,
  data: { authorization: string; latitude: number; longitude: number; accuracy: number },
  signal?: AbortSignal,
) =>
  (
    await instance.post<{ data: ICombinedCheckInResult }>(
      `/attendances/sessions/${id}/combined-check-in`,
      {
        authorization: data.authorization,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
      },
      { signal },
    )
  ).data.data;

export const updateAttendanceSessionTopic = async (idSession: number, topic: string | null) =>
  (await instance.patch<{ data: IAttendanceLifecycle }>(`/attendances/sessions/${idSession}/topic`, { topic })).data
    .data;
