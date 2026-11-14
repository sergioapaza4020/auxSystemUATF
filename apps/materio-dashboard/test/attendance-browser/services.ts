// Visual fixture only. No application database, credentials, requests or real GPS.
import type { AttendanceGeolocationConfig } from '../../src/api/attendances.service';
import type { IAttendanceSession } from '../../src/interfaces/attendances/attendance.interface';
import { AttendanceStatus } from '../../src/enums/attendanceStatus';

export let scenario = 'SUCCESS';
let registered = false;
let unavailable = false;
let notStarted = false;
export let owner: IAttendanceSession;
const date = (value: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date(value));
export function reset(value = 'SUCCESS') {
  scenario = value;
  registered = false;
  unavailable = false;
  notStarted = false;
  const startsAt = new Date(Date.now() + 120000).toISOString();

  owner = {
    idAttendanceSession: 700,
    date: date(startsAt),
    mode: 'GEOLOCATION',
    state: 'DRAFT',
    isComputable: false,
    latitude: null,
    longitude: null,
    radiusMeters: null,
    maximumAcceptedAccuracy: null,
    startsAt,
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    openedAt: null,
    closedAt: null,
    cancelledAt: null,
    attendances: [],
    presentCount: 0,
    excusedCount: 0,
    absentCount: 0,
    totalStudents: 30,
    percentage: 0,
  };
}
reset();
const domainError = (code: string, status = 409) => ({
  isAxiosError: true,
  response: { status, data: { code, message: code } },
});
export async function getMyAttendanceSessions() {
  return {
    data:
      unavailable || scenario === 'EMPTY'
        ? []
        : [
            {
              idAttendanceSession: 700,
              date: date(new Date().toISOString()),
              startsAt: new Date(Date.now() + (scenario === 'SCHEDULED' || notStarted ? 120000 : -60000)).toISOString(),
              endsAt: new Date(Date.now() + 3600000).toISOString(),
              state: scenario === 'SCHEDULED' || notStarted ? ('SCHEDULED' as const) : ('OPEN' as const),
              isComputable: false,
              alreadyRegistered: registered,
              ownStatus: registered ? AttendanceStatus.PRESENT : null,
              ownMarkedAt: registered ? new Date().toISOString() : null,
            },
          ],
    meta: { limit: 20, hasMore: false, upcomingUntil: new Date(Date.now() + 86400000).toISOString() },
  };
}
export async function checkInAttendance() {
  if (scenario === 'SUCCESS') {
    registered = true;
    return {
      code: 'SUCCESS' as const,
      status: AttendanceStatus.PRESENT,
      registrationMethod: 'GEOLOCATION' as const,
      idAttendance: 1,
      markedAt: new Date().toISOString(),
    };
  }
  if (scenario === 'ALREADY_REGISTERED' || scenario === 'NETWORK_CONFIRMED') registered = true;
  if (scenario === 'SESSION_CLOSED' || scenario === 'SESSION_CANCELLED') unavailable = true;
  if (scenario === 'SESSION_NOT_STARTED') notStarted = true;
  if (scenario.startsWith('NETWORK')) throw { isAxiosError: true, code: 'ECONNABORTED' };
  if (['401', '403', '429', '500'].includes(scenario))
    throw { isAxiosError: true, response: { status: Number(scenario), data: {} } };
  throw domainError(scenario);
}
export async function configureGeolocation(_id: number, config: Partial<AttendanceGeolocationConfig>) {
  owner = { ...owner, ...config, date: date(config.startsAt ?? owner.startsAt!) };
  return owner;
}
export async function activateSession() {
  owner = { ...owner, state: 'SCHEDULED', openedAt: new Date().toISOString() };
  return owner;
}
export async function openSessionNow() {
  owner = { ...owner, state: 'OPEN', startsAt: new Date().toISOString(), openedAt: new Date().toISOString() };
  return owner;
}
export async function closeSession() {
  owner = { ...owner, state: 'CLOSED', isComputable: true, closedAt: new Date().toISOString() };
  return owner;
}
export async function cancelSession() {
  owner = { ...owner, state: 'CANCELLED', cancelledAt: new Date().toISOString() };
  return owner;
}
