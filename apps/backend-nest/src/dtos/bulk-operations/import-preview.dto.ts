import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportPreviewQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, enum: [25, 50, 100] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([25, 50, 100])
  limit = 25;

  @ApiPropertyOptional({ default: 'all', enum: ['all', 'valid', 'invalid'] })
  @IsOptional()
  @IsIn(['all', 'valid', 'invalid'])
  status: 'all' | 'valid' | 'invalid' = 'all';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class ExecuteImportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  operationId: string;
}

export interface ImportPreviewPage<Row> {
  operationId: string;
  total: number;
  valid: number;
  invalid: number;
  data: Row[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
