import { InternalServerErrorException } from '@nestjs/common';
import { Raw } from 'typeorm';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceSessionState as State } from '@common/enums/attendanceSessionState';
import type { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';

type Session = Pick<
  AttendanceSession,
  | 'mode'
  | 'date'
  | 'latitude'
  | 'longitude'
  | 'radiusMeters'
  | 'maximumAcceptedAccuracy'
  | 'startsAt'
  | 'endsAt'
  | 'openedAt'
  | 'closedAt'
  | 'cancelledAt'
>;

export function attendanceAcademicDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (name: string) => parts.find((value) => value.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function attendanceDateValue(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function invalid(): never {
  throw new InternalServerErrorException('SESSION_STRUCTURE_INVALID');
}

export function isSelfRegistrationMode(mode: Mode): boolean {
  return mode === Mode.GEOLOCATION || mode === Mode.QR;
}

export function getAttendanceSessionState(session: Session, now: Date): State | null {
  if (!Number.isFinite(now.getTime())) invalid();
  if (session.mode === Mode.MANUAL) return null;
  if (!isSelfRegistrationMode(session.mode)) invalid();
  if (
    session.mode === Mode.QR &&
    [
      session.latitude,
      session.longitude,
      session.radiusMeters,
      session.maximumAcceptedAccuracy,
    ].some((value) => value != null)
  )
    invalid();
  for (const time of [
    session.startsAt,
    session.endsAt,
    session.openedAt,
    session.closedAt,
    session.cancelledAt,
  ])
    if (time != null && (!(time instanceof Date) || !Number.isFinite(time.getTime()))) invalid();
  for (const [value, min, max] of [
    [session.latitude, -90, 90],
    [session.longitude, -180, 180],
  ] as const)
    if (
      value != null &&
      (value.trim() === '' ||
        !Number.isFinite(Number(value)) ||
        Number(value) < min ||
        Number(value) > max)
    )
      invalid();
  for (const value of [session.radiusMeters, session.maximumAcceptedAccuracy])
    if (value != null && (!Number.isInteger(value) || value <= 0)) invalid();
  if (session.startsAt && session.endsAt && session.startsAt >= session.endsAt) invalid();
  if (session.closedAt && session.cancelledAt) invalid();
  if (session.openedAt) {
    if (
      [
        ...(session.mode === Mode.GEOLOCATION
          ? [
              session.latitude,
              session.longitude,
              session.radiusMeters,
              session.maximumAcceptedAccuracy,
            ]
          : []),
        session.startsAt,
        session.endsAt,
      ].some((value) => value == null)
    )
      invalid();
    if (session.openedAt > now || session.openedAt >= session.endsAt!) invalid();
  }
  if (
    session.startsAt &&
    attendanceDateValue(session.date) !== attendanceAcademicDate(session.startsAt)
  )
    invalid();
  if (
    session.closedAt &&
    (!session.openedAt ||
      session.closedAt < session.openedAt ||
      (session.startsAt && session.closedAt < session.startsAt) ||
      (session.endsAt && session.closedAt >= session.endsAt) ||
      session.closedAt > now)
  )
    invalid();
  if (
    session.cancelledAt &&
    (session.cancelledAt > now ||
      (session.openedAt &&
        (session.cancelledAt < session.openedAt || session.cancelledAt >= session.startsAt!)))
  )
    invalid();
  if (session.cancelledAt) return State.CANCELLED;
  if (!session.openedAt) return State.DRAFT;
  if (session.closedAt || now >= session.endsAt!) return State.CLOSED;
  if (now < session.startsAt!) return State.SCHEDULED;
  return State.OPEN;
}

export function isAttendanceSessionComputable(session: Session, now: Date): boolean {
  const state = getAttendanceSessionState(session, now);
  return state === null || state === State.CLOSED;
}

// Alias is supplied by our query builders, never by a request. Keep this equivalent
// to the pure policy; academic queries exclude malformed GEO rows rather than count them.
export function attendanceSessionComputableSql(alias: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) throw new Error('Invalid query alias');
  const c = (name: string) => `"${alias}"."${name}"`;
  return `(${c('mode')} = 'MANUAL' OR (
    (${c('mode')} = 'GEOLOCATION' OR ${c('mode')}::text = 'QR')
    AND ${c('opened_at')} IS NOT NULL AND ${c('cancelled_at')} IS NULL
    AND ((${c('mode')} = 'GEOLOCATION'
      AND ${c('latitude')} BETWEEN -90 AND 90 AND ${c('longitude')} BETWEEN -180 AND 180
      AND ${c('radius_meters')} > 0 AND ${c('maximum_accepted_accuracy')} > 0)
      OR (${c('mode')}::text = 'QR' AND ${c('latitude')} IS NULL AND ${c('longitude')} IS NULL
        AND ${c('radius_meters')} IS NULL AND ${c('maximum_accepted_accuracy')} IS NULL))
    AND isfinite(${c('starts_at')}) AND isfinite(${c('ends_at')})
    AND ${c('starts_at')} < ${c('ends_at')}
    AND ${c('date')} = (${c('starts_at')} AT TIME ZONE 'America/La_Paz')::date
    AND isfinite(${c('opened_at')})
    AND ${c('opened_at')} <= :attendanceNow AND ${c('opened_at')} < ${c('ends_at')}
    AND (${c('closed_at')} IS NULL OR (
      isfinite(${c('closed_at')}) AND ${c('closed_at')} >= ${c('opened_at')}
      AND ${c('closed_at')} >= ${c('starts_at')} AND ${c('closed_at')} < ${c('ends_at')}
      AND ${c('closed_at')} <= :attendanceNow))
    AND (${c('closed_at')} IS NOT NULL OR ${c('ends_at')} <= :attendanceNow)
  ))`;
}

export function computableAttendanceMode(now: Date) {
  return Raw<Mode>((path) => attendanceSessionComputableSql(path.slice(0, path.lastIndexOf('.'))), {
    attendanceNow: now,
  });
}
