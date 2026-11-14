import type { IQrContext, IQrOwnMark } from '@/interfaces/attendances/student-qr.interface';
import { AttendanceStatus } from '@/enums/attendanceStatus';

export const qrToken = (id = 7) => `q1.fixture.${id}.59800000.${'A'.repeat(43)}`;
export const qrMark: IQrOwnMark = {
  status: AttendanceStatus.PRESENT,
  registrationMethod: 'QR',
  markedAt: '2026-11-12T14:00:00Z',
};
export const qrContext = (id = 7): IQrContext => ({
  idAttendanceSession: id,
  course: { name: 'Materia de prueba', group: 1 },
  date: '2026-11-12',
  startsAt: '2026-11-12T14:00:00Z',
  endsAt: '2026-11-12T15:00:00Z',
  expiresAt: '2026-11-12T14:00:35Z',
  state: 'OPEN',
  ownMark: null,
});

export function memorySessionStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
