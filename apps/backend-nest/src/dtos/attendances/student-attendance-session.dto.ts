import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { AttendanceSessionState } from '@common/enums/attendanceSessionState';

// Student-only allowlist. Never derive this DTO from the owner's session response.
export class StudentAttendanceSessionDto {
  @ApiProperty()
  idAttendanceSession: number;
  @ApiProperty()
  date: Date;
  @ApiProperty()
  startsAt: Date;
  @ApiProperty()
  endsAt: Date;
  @ApiProperty({ enum: AttendanceSessionState })
  state: AttendanceSessionState;
  @ApiProperty()
  isComputable: boolean;
  @ApiProperty()
  alreadyRegistered: boolean;
  @ApiProperty({ enum: AttendanceStatus, nullable: true })
  ownStatus: AttendanceStatus | null;
  @ApiProperty({ type: Date, nullable: true })
  ownMarkedAt: Date | null;
}
