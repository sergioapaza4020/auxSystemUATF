import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CareerStudentImportParamsDto {
  @ApiProperty({ description: 'Carrera destino existente' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  careerId: number;
}

export class CareerStudentImportRowDto {
  row: number;
  studentId: number | null;
  ru: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  currentCareer: { idCareer: number; name: string } | null;
  status: 'VALID' | 'INVALID';
  errors: string[];
}

export class CareerStudentImportPreviewDto {
  total: number;
  valid: number;
  invalid: number;
  rows: CareerStudentImportRowDto[];
}

export class CareerStudentImportResultDto {
  imported: number;
  total: number;
  careerId: number;
}
