import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Matches, Min } from 'class-validator';

export class AttendanceSessionCreateDto {
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
