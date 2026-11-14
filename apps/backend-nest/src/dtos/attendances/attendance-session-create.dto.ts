import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, Matches, Min, ValidateIf } from 'class-validator';
import { AttendanceSessionMode } from '@common/enums/attendanceSessionMode';

export class AttendanceSessionCreateDto {
  @ApiPropertyOptional({
    enum: AttendanceSessionMode,
    default: AttendanceSessionMode.MANUAL,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(AttendanceSessionMode)
  mode?: AttendanceSessionMode;

  @ApiProperty({
    example: 15,
    description: 'ID de la matrícula del auxiliar',
  })
  @IsInt()
  @Min(1)
  enrollmentId: number;

  @ApiProperty({
    example: '2026-09-11',
    description: 'Fecha de la sesión de asistencia',
  })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}
