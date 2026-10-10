import { describe, expect, it, vi } from 'vitest';

import { instance } from '@/api/config/config';
import { saveAttendances } from './attendances.service';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';

vi.mock('@/api/config/config', () => ({ instance: { post: vi.fn() } }));

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
