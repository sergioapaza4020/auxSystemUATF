import { Type } from 'class-transformer';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string | null;
}

export class AttendanceSaveDto {
  @ApiPropertyOptional({
    enum: AttendanceStatus,
    description: 'Apply to the entire active roster before individual overrides',
  })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  markAll?: AttendanceStatus;

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
