import type { ImportPreviewPage } from '../bulk-operations/import-preview.dto';
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
  action?: 'CREATE_ACCOUNT' | 'ENROLL' | 'SKIP' | 'ERROR';
  row: number;
  studentId: number | null;
  ru: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  status: 'VALID' | 'INVALID';
  errors: string[];
}

export type EnrollmentImportPreviewDto = ImportPreviewPage<EnrollmentImportRowDto> & {
  newAccounts?: number;
  existingAccounts?: number;
  skipped?: number;
};

export class EnrollmentImportResultDto {
  accountsCreated: number;
  accountsReused: number;
  skipped: number;
  errors: number;
  imported: number;
  total: number;
  courseId: number;
  semesterId: number;
}
