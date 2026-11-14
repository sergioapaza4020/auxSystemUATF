import type { IAttendanceSession, AttendanceSessionState } from '../../src/interfaces/attendances/attendance.interface';
import type { IQrOwnMark } from '../../src/interfaces/attendances/student-qr.interface';
import { AttendanceStatus } from '../../src/enums/attendanceStatus';
export let scenario = 'SUCCESS';
export let writes = 0;
let mark: IQrOwnMark | null = null;
export const syntheticToken = `q1.fixture.7.0.${'A'.repeat(43)}`;
export let session: IAttendanceSession;
export function reset(state: AttendanceSessionState = 'OPEN', next = 'SUCCESS') {
  scenario = next;
  writes = 0;
  mark = null;
  session = {
    idAttendanceSession: 7,
    date: new Date().toISOString().slice(0, 10),
    mode: 'QR',
    state,
    startsAt: new Date(Date.now() - 60000).toISOString(),
    endsAt: new Date(Date.now() + 600000).toISOString(),
    presentCount: 0,
    absentCount: 0,
    excusedCount: 0,
    totalStudents: 30,
    percentage: 0,
  };
}
reset();
const error = (code: string) => ({ isAxiosError: true, response: { status: 409, data: { code } } });
export const useAuth = () => ({
  user: { idUser: 2, roles: ['STUDENT'], permissions: ['attendance.qr.check-in'] },
  loading: false,
  refreshUser: async () => undefined,
});
export const getAccessToken = () => 'synthetic-test-only';
export const getRefreshToken = () => undefined;
export const useRouter = () => ({ replace: () => undefined, push: () => undefined });
export const useSnackbar = () => ({ success: () => undefined, warning: () => undefined });
export async function getQrContext(id: number) {
  if (scenario === 'EXPIRED') throw error('QR_TOKEN_EXPIRED');
  return {
    idAttendanceSession: id,
    course: { name: 'Materia ficticia de prueba', group: 1 },
    date: session.date,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    expiresAt: new Date(Date.now() + 35000).toISOString(),
    state: 'OPEN',
    ownMark: mark,
  };
}
export async function checkInWithQr() {
  writes++;
  window.dispatchEvent(new Event('qr-fixture-write'));
  if (scenario === 'UNCERTAIN') throw new Error('Synthetic lost response');
  mark = { status: AttendanceStatus.PRESENT, registrationMethod: 'QR', markedAt: new Date().toISOString() };
  return { code: 'SUCCESS', idAttendance: 1, ...mark };
}
export const getMyQrMark = async () => ({ ownMark: mark });
export async function getAttendanceQrCode(id: number) {
  const now = Date.now();
  const rotate = (Math.floor(now / 30000) + 1) * 30000;
  return {
    idAttendanceSession: id,
    token: syntheticToken,
    serverNow: new Date(now).toISOString(),
    rotateAt: new Date(rotate).toISOString(),
    expiresAt: new Date(rotate + 5000).toISOString(),
  };
}
export const configureAttendanceQr = async (_id: number, data: { startsAt: string; endsAt: string }) =>
  (session = { ...session, ...data });
export const activateSession = async () => (session = { ...session, state: 'OPEN' });
export const openSessionNow = activateSession;
export const closeSession = async () => (session = { ...session, state: 'CLOSED' });
export const cancelSession = async () => (session = { ...session, state: 'CANCELLED' });
