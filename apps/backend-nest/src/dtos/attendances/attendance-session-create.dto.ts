import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt } from 'class-validator';

export class AttendanceSessionCreateDto {
  @ApiProperty({
    example: 15,
    description: 'ID de la matrícula del auxiliar',
  })
  @IsInt()
  enrollmentId: number;

  @ApiProperty({
    example: '2026-09-11',
    description: 'Fecha de la sesión de asistencia',
  })
  @IsDateString()
  date: string;
}
