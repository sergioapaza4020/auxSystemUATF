import { describe, expect, it, vi } from 'vitest';

import {
  updateAttendanceSessionTopic,
  getQrContext,
  checkInWithQr,
  getMyQrMark,
  saveAttendances,
  getAttendanceSessionsByEnrollment,
  createAttendanceSession,
  configureGeolocation,
  activateSession,
  openSessionNow,
  closeSession,
  cancelSession,
  getMyAttendanceSessions,
  checkInAttendance,
  configureAttendanceQr,
  getAttendanceQrCode,
  getAttendanceAudit,
  getCombinedChallenge,
  checkInCombined,
} from './attendances.service';
import { qrContext, qrMark, qrToken } from '@/test-utils/qr-fixtures';

import { instance } from '@/api/config/config';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';

vi.mock('@/api/config/config', () => ({ instance: { post: vi.fn(), get: vi.fn(), patch: vi.fn() } }));

it('configures QR and retrieves the exact envelope through the existing client without persisting or generating it', async () => {
  const config = { startsAt: '2026-11-12T14:00:00Z', endsAt: '2026-11-12T15:00:00Z' };

  vi.mocked(instance.patch).mockResolvedValueOnce({ data: { data: { mode: 'QR', state: 'DRAFT' } } });
  expect(await configureAttendanceQr(7, config)).toEqual({ mode: 'QR', state: 'DRAFT' });
  expect(instance.patch).toHaveBeenLastCalledWith('/attendances/sessions/7/qr', config);

  const result = {
    idAttendanceSession: 7,
    token: 'q1.synthetic',
    serverNow: config.startsAt,
    rotateAt: '2026-11-12T14:00:30Z',
    expiresAt: '2026-11-12T14:00:35Z',
  };

  vi.mocked(instance.get).mockResolvedValueOnce({ data: { data: result } });
  const signal = new AbortController().signal;

  expect(await getAttendanceQrCode(7, signal)).toEqual(result);
  expect(instance.get).toHaveBeenLastCalledWith('/attendances/sessions/7/qr', { signal });
});

it('loads the student-only list preserving its actual non-paginated metadata', async () => {
  const signal = new AbortController().signal;
  const response = { data: [], meta: { limit: 20, hasMore: true, upcomingUntil: '2026-10-28T14:00:00Z' } };

  vi.mocked(instance.get).mockResolvedValueOnce({ data: response });
  expect(await getMyAttendanceSessions(20, signal)).toBe(response);
  expect(instance.get).toHaveBeenLastCalledWith('/attendances/student/my/20/sessions', { signal });
});

it('posts exactly the browser evidence without enrollment, status, timestamp or additional properties', async () => {
  const position = {
    latitude: -19.123456789,
    longitude: -65.123456789,
    accuracy: 18.123,
    userId: 100,
    idEnrollment: 999,
    status: 'PRESENT',
    distance: 0,
  };

  const signal = new AbortController().signal;

  const result = {
    code: 'SUCCESS',
    idAttendance: 8,
    status: 'PRESENT',
    registrationMethod: 'GEOLOCATION',
    markedAt: '2026-10-27T14:00:00Z',
  };

  vi.mocked(instance.post).mockResolvedValueOnce({ data: { data: result } });
  expect(await checkInAttendance(7, position, signal)).toBe(result);
  expect(instance.post).toHaveBeenLastCalledWith(
    '/attendances/sessions/7/check-in',
    { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy },
    { signal },
  );
});

it('keeps the legacy create body and explicitly requests GEO drafts only when selected', async () => {
  vi.mocked(instance.post).mockResolvedValue({ data: { data: { idAttendanceSession: 1 } } });
  await createAttendanceSession({ enrollmentId: 20, date: '2026-10-26' });
  expect(instance.post).toHaveBeenLastCalledWith('/attendances/sessions', { enrollmentId: 20, date: '2026-10-26' });
  await createAttendanceSession({ enrollmentId: 20, date: '2026-10-26', mode: 'GEOLOCATION' });
  expect(instance.post).toHaveBeenLastCalledWith('/attendances/sessions', {
    enrollmentId: 20,
    date: '2026-10-26',
    mode: 'GEOLOCATION',
  });
});

it.each([
  [activateSession, 'activate'],
  [openSessionNow, 'open-now'],
  [closeSession, 'close'],
  [cancelSession, 'cancel'],
] as const)('uses the lifecycle route %s / %s', async (action, path) => {
  vi.mocked(instance.patch).mockResolvedValueOnce({ data: { data: { state: 'OPEN' } } });
  expect(await action(7)).toEqual({ state: 'OPEN' });
  expect(instance.patch).toHaveBeenLastCalledWith(`/attendances/sessions/7/${path}`);
});

it('saves configuration without sending server facts', async () => {
  const data = {
    latitude: -19,
    longitude: -65,
    radiusMeters: 50,
    maximumAcceptedAccuracy: 40,
    startsAt: '2026-10-26T14:00:00Z',
    endsAt: '2026-10-26T15:00:00Z',
  };

  vi.mocked(instance.patch).mockResolvedValueOnce({ data: { data: { state: 'DRAFT' } } });
  await configureGeolocation(7, data);
  expect(instance.patch).toHaveBeenLastCalledWith('/attendances/sessions/7/geolocation', data);
});

it('passes history pagination/date/signal and preserves the interceptor metadata', async () => {
  const signal = new AbortController().signal;
  const query = { page: 2, limit: 5, date: '2026-10-10' };
  const envelope = { status: true, statusCode: 200, data: [], meta: { page: 2, limit: 5, total: 43, totalPages: 9 } };

  vi.mocked(instance.get).mockResolvedValueOnce({ data: envelope });
  expect(await getAttendanceSessionsByEnrollment(20, query, signal)).toBe(envelope);
  expect(instance.get).toHaveBeenCalledWith('/attendances/sessions/enrollment/20', { params: query, signal });
});

describe('Attendance save response envelope', () => {
  it('reads confirmed records from response.data.data', async () => {
    const payload = {
      attendances: [
        { enrollmentId: 10, status: S.PRESENT, observation: null },
        { enrollmentId: 11, status: S.EXCUSED, observation: 'Cita médica' },
        { enrollmentId: 12, status: S.ABSENT, observation: null },
      ],
    };

    const records = payload.attendances.map((record) => ({
      idAttendance: record.enrollmentId,
      enrollment: { idEnrollment: record.enrollmentId },
      status: record.status,
      observation: record.observation,
    }));

    vi.mocked(instance.post).mockResolvedValueOnce({
      status: 201,
      data: { status: true, statusCode: 201, data: records },
    });
    await expect(saveAttendances(1, payload)).resolves.toEqual(records);
    expect(instance.post).toHaveBeenCalledWith('/attendances/sessions/1', payload);
  });
});

it('uses token-only student QR bodies and token-free own-mark URLs', async () => {
  const signal = new AbortController().signal;

  vi.mocked(instance.post).mockResolvedValueOnce({ data: { data: qrContext() } });
  expect(await getQrContext(7, qrToken(), signal)).toEqual(qrContext());
  expect(instance.post).toHaveBeenLastCalledWith(
    '/attendances/sessions/7/qr-context',
    { token: qrToken() },
    { signal },
  );
  vi.mocked(instance.post).mockResolvedValueOnce({ data: { data: { code: 'SUCCESS', ...qrMark } } });
  expect(await checkInWithQr(7, qrToken(), signal)).toMatchObject({ code: 'SUCCESS' });
  expect(instance.post).toHaveBeenLastCalledWith(
    '/attendances/sessions/7/qr-check-in',
    { token: qrToken() },
    { signal },
  );
  vi.mocked(instance.get).mockResolvedValueOnce({ data: { data: { ownMark: qrMark } } });
  expect(await getMyQrMark(7, signal)).toEqual({ ownMark: qrMark });
  expect(instance.get).toHaveBeenLastCalledWith('/attendances/sessions/7/qr-own-mark', { signal });
});

it('creates a combined draft and reads audit pages through the existing client', async () => {
  const body = { enrollmentId: 20, date: '2026-11-20', mode: 'GEOLOCATION_QR' as const };

  vi.mocked(instance.post).mockResolvedValueOnce({ data: { data: { ...body, state: 'DRAFT' } } });
  expect(await createAttendanceSession(body)).toMatchObject({ state: 'DRAFT' });
  expect(instance.post).toHaveBeenLastCalledWith('/attendances/sessions', body);
  const signal = new AbortController().signal;
  const response = { status: true, statusCode: 200, data: [], meta: { page: 2, limit: 10, total: 20, totalPages: 2 } };

  vi.mocked(instance.get).mockResolvedValueOnce({ data: response });
  expect(await getAttendanceAudit(7, { page: 2, limit: 10 }, signal)).toBe(response);
  expect(instance.get).toHaveBeenLastCalledWith('/attendances/sessions/7/audit', {
    params: { page: 2, limit: 10 },
    signal,
  });
});

it('uses exact combined bodies and never sends identity, timestamp or device metadata', async () => {
  const signal = new AbortController().signal;

  vi.mocked(instance.post).mockResolvedValue({ data: { data: {} } });
  await getCombinedChallenge(7, 'q1.synthetic', signal);
  expect(instance.post).toHaveBeenLastCalledWith(
    '/attendances/sessions/7/combined-challenge',
    { token: 'q1.synthetic' },
    { signal },
  );

  const position = {
    authorization: 'B'.repeat(43),
    latitude: -19.57,
    longitude: -65.75,
    accuracy: 25,
    userId: 99,
    timestamp: 123,
    distanceMeters: 0,
  };

  await checkInCombined(7, position, signal);
  expect(instance.post).toHaveBeenLastCalledWith(
    '/attendances/sessions/7/combined-check-in',
    { authorization: position.authorization, latitude: -19.57, longitude: -65.75, accuracy: 25 },
    { signal },
  );
});

it('opens with duration only, preserving the legacy empty-body contract', async () => {
  vi.mocked(instance.patch).mockResolvedValueOnce({ data: { data: { state: 'OPEN' } } });
  await openSessionNow(7, 1);
  expect(instance.patch).toHaveBeenLastCalledWith('/attendances/sessions/7/open-now', { durationMinutes: 1 });
  vi.mocked(instance.patch).mockResolvedValueOnce({ data: { data: { state: 'OPEN' } } });
  await openSessionNow(7);
  expect(instance.patch).toHaveBeenLastCalledWith('/attendances/sessions/7/open-now');
});

it.each(['Introducción a Git', null])(
  'updates only session topic through existing Axios client (%j)',
  async (topic) => {
    const result = { idAttendanceSession: 7, topic };

    vi.mocked(instance.patch).mockResolvedValueOnce({ data: { data: result } });
    expect(await updateAttendanceSessionTopic(7, topic)).toBe(result);
    expect(instance.patch).toHaveBeenLastCalledWith('/attendances/sessions/7/topic', { topic });
  },
);
