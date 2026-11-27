import { ApiProperty } from '@nestjs/swagger';
import { AttendanceSessionMode } from '@common/enums/attendanceSessionMode';
import { AttendanceSessionState } from '@common/enums/attendanceSessionState';
import {
  getAttendanceSessionState,
  isAttendanceSessionComputable,
} from '@common/utils/attendance-session-policy';
import type { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';

export class AttendanceSessionLifecycleResponseDto {
  @ApiProperty()
  idAttendanceSession: number;
  @ApiProperty({ type: String, nullable: true, maxLength: 255 })
  topic: string | null;
  @ApiProperty()
  date: Date;
  @ApiProperty({ enum: AttendanceSessionMode })
  mode: AttendanceSessionMode;
  @ApiProperty({ type: Number, nullable: true })
  latitude: number | null;
  @ApiProperty({ type: Number, nullable: true })
  longitude: number | null;
  @ApiProperty({ type: Number, nullable: true })
  radiusMeters: number | null;
  @ApiProperty({ type: Number, nullable: true })
  maximumAcceptedAccuracy: number | null;
  @ApiProperty({ type: Date, nullable: true })
  startsAt: Date | null;
  @ApiProperty({ type: Date, nullable: true })
  endsAt: Date | null;
  @ApiProperty({ type: Date, nullable: true })
  openedAt: Date | null;
  @ApiProperty({ type: Date, nullable: true })
  closedAt: Date | null;
  @ApiProperty({ type: Date, nullable: true })
  cancelledAt: Date | null;
  @ApiProperty({ enum: AttendanceSessionState, nullable: true })
  state: AttendanceSessionState | null;
  @ApiProperty()
  isComputable: boolean;
}

// Owner-only projection. Do not reuse for future student endpoints.
export function attendanceSessionResponse(
  session: AttendanceSession,
  now: Date,
): AttendanceSessionLifecycleResponseDto {
  const state = getAttendanceSessionState(session, now);
  return {
    idAttendanceSession: session.idAttendanceSession,
    date: session.date,
    topic: session.topic ?? null,
    mode: session.mode,
    latitude: session.latitude == null ? null : Number(session.latitude),
    longitude: session.longitude == null ? null : Number(session.longitude),
    radiusMeters: session.radiusMeters ?? null,
    maximumAcceptedAccuracy: session.maximumAcceptedAccuracy ?? null,
    startsAt: session.startsAt ?? null,
    endsAt: session.endsAt ?? null,
    openedAt: session.openedAt ?? null,
    closedAt: session.closedAt ?? null,
    cancelledAt: session.cancelledAt ?? null,
    state,
    isComputable: isAttendanceSessionComputable(session, now),
  };
}
