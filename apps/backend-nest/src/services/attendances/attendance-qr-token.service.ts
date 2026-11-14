import { Injectable, HttpStatus } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AttendanceCheckInCode as Code } from '@common/enums/attendanceCheckInCode';
import { AttendanceCheckInException } from '@common/errors/attendance-check-in.exception';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { getAttendanceSessionState } from '@common/utils/attendance-session-policy';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceSessionState as State } from '@common/enums/attendanceSessionState';

export type VerifiedQrToken = Readonly<{ idSession: number; slot: number }>;

@Injectable()
export class AttendanceQrTokenService {
  private readonly keys = new Map<string, Buffer>();
  private readonly activeKid: string;
  private available = false;

  constructor() {
    this.activeKid = process.env.ATTENDANCE_QR_ACTIVE_KID ?? '';
    try {
      const values: unknown = JSON.parse(process.env.ATTENDANCE_QR_KEYS_JSON ?? '{}');
      if (!values || typeof values !== 'object' || Array.isArray(values)) return;
      const entries = Object.entries(values);
      if (entries.length === 0 || entries.length > 8) return;
      for (const [kid, value] of entries) {
        if (!/^[A-Za-z0-9_-]{1,16}$/.test(kid) || typeof value !== 'string') return;
        const key = Buffer.from(value, 'base64');
        if (key.length < 32 || key.length > 128 || key.toString('base64') !== value) return;
        for (const secret of [process.env.JWT_ACCESS_SECRET, process.env.JWT_ACCESS_REFRESH]) {
          if (secret && (secret === value || key.equals(Buffer.from(secret)))) return;
        }
        this.keys.set(kid, key);
      }
      this.available = this.keys.has(this.activeKid);
    } catch {
      // Fail closed only for QR. Never log the configuration or parsing exception.
      this.available = false;
    }
  }

  private requireAvailable() {
    if (!this.available)
      throw new AttendanceCheckInException(Code.QR_NOT_AVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
  }

  private invalid(): never {
    throw new AttendanceCheckInException(Code.QR_TOKEN_INVALID, HttpStatus.BAD_REQUEST);
  }

  verify(token: string, idSession: number): VerifiedQrToken {
    this.requireAvailable();
    if (typeof token !== 'string' || token.length > 128) this.invalid();
    const match =
      /^q1\.([A-Za-z0-9_-]{1,16})\.([1-9]\d{0,9})\.(0|[1-9]\d{0,11})\.([A-Za-z0-9_-]{43})$/.exec(
        token,
      );
    if (!match) this.invalid();
    const [, kid, sid, period, mac] = match;
    const session = Number(sid);
    const slot = Number(period);
    const key = this.keys.get(kid);
    if (!key || session > 2147483647 || session !== idSession) this.invalid();
    const decoded = Buffer.from(mac, 'base64url');
    if (decoded.length !== 32 || decoded.toString('base64url') !== mac) this.invalid();
    const expected = createHmac('sha256', key).update(`q1.${kid}.${sid}.${period}`).digest();
    if (!timingSafeEqual(decoded, expected)) this.invalid();
    return Object.freeze({ idSession: session, slot });
  }

  validatePeriod(token: VerifiedQrToken, session: AttendanceSession, now: Date): Date {
    this.requireAvailable();
    if (token.idSession !== session.idAttendanceSession) this.invalid();
    if (session.mode !== Mode.QR || getAttendanceSessionState(session, now) !== State.OPEN)
      throw new AttendanceCheckInException(Code.QR_NOT_AVAILABLE, HttpStatus.CONFLICT);
    const time = now.getTime();
    const current = Math.floor(time / 30000);
    if (token.slot > current) this.invalid();
    const start = Math.max(session.startsAt!.getTime(), session.openedAt!.getTime());
    if ((token.slot + 1) * 30000 <= start) this.invalid();
    const expires = Math.min((token.slot + 1) * 30000 + 5000, session.endsAt!.getTime());
    if (token.slot < current - 1 || time >= expires)
      throw new AttendanceCheckInException(Code.QR_TOKEN_EXPIRED, HttpStatus.CONFLICT);
    return new Date(expires);
  }

  issue(session: AttendanceSession, now: Date) {
    this.requireAvailable();
    const slot = Math.floor(now.getTime() / 30000);
    const expiresAt = this.validatePeriod(
      { idSession: session.idAttendanceSession, slot },
      session,
      now,
    );
    const body = `q1.${this.activeKid}.${session.idAttendanceSession}.${slot}`;
    const mac = createHmac('sha256', this.keys.get(this.activeKid)!)
      .update(body)
      .digest('base64url');
    return {
      idAttendanceSession: session.idAttendanceSession,
      token: `${body}.${mac}`,
      serverNow: now,
      rotateAt: new Date(Math.min((slot + 1) * 30000, session.endsAt!.getTime())),
      expiresAt,
    };
  }
}
