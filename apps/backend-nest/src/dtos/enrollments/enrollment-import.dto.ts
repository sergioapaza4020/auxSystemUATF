import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnrollmentImportTargetDto {
  @ApiProperty({ description: 'Materia y grupo existentes (idCourse)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId: number;

  @ApiProperty({ description: 'Gestión y periodo existentes (idSemester)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  semesterId: number;
}

export class EnrollmentImportRowDto {
  row: number;
  studentId: number | null;
  ru: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  status: 'VALID' | 'INVALID';
  errors: string[];
}

export class EnrollmentImportPreviewDto {
  total: number;
  valid: number;
  invalid: number;
  rows: EnrollmentImportRowDto[];
}

export class EnrollmentImportResultDto {
  imported: number;
  total: number;
  courseId: number;
  semesterId: number;
}
