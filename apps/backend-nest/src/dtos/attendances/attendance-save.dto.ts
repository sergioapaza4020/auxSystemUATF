import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt } from 'class-validator';

export class AttendanceRecordDto {
  @ApiProperty({
    example: 25,
    description: 'ID de la matrícula del estudiante',
  })
  @IsInt()
  enrollmentId: number;

  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
  })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}

export class AttendanceSaveDto {
  @ApiProperty({
    type: [AttendanceRecordDto],
    example: [
      {
        enrollmentId: 25,
        status: AttendanceStatus.PRESENT,
      },
      {
        enrollmentId: 26,
        status: AttendanceStatus.ABSENT,
      },
    ],
  })
  attendances: AttendanceRecordDto[];
}
