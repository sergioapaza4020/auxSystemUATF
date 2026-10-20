import { describe, expect, it, vi } from 'vitest';

import { instance } from '@/api/config/config';
import { saveAttendances, getAttendanceSessionsByEnrollment } from './attendances.service';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';

vi.mock('@/api/config/config', () => ({ instance: { post: vi.fn(), get: vi.fn() } }));

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
