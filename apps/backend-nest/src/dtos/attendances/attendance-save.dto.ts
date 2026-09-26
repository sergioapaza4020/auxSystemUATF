import { Type } from 'class-transformer';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, Min, ValidateNested } from 'class-validator';

export class AttendanceRecordDto {
  @ApiProperty({
    example: 25,
    description: 'ID de la matrícula del estudiante',
  })
  @IsInt()
  @Min(1)
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  attendances: AttendanceRecordDto[];
}
