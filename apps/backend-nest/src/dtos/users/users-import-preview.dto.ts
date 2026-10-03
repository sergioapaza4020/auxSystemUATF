import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ApiResponseOptions } from '@nestjs/swagger';

export class UserImportPreviewQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, enum: [25, 50, 100] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsIn([25, 50, 100])
  limit: number = 25;

  @ApiPropertyOptional({ default: 'all', enum: ['all', 'valid', 'invalid'] })
  @IsOptional()
  @IsIn(['all', 'valid', 'invalid'])
  status: 'all' | 'valid' | 'invalid' = 'all';

  @ApiPropertyOptional({ description: 'Nombre, apellido, CI, RU, email o username' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class UserImportPreviewRow {
  @ApiProperty({ description: 'Número original de fila Excel, incluyendo encabezado' })
  row: number;
  @ApiProperty()
  name: string;
  @ApiProperty()
  lastname: string;
  @ApiProperty()
  ci: string;
  @ApiProperty()
  ru: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  username: string;
  @ApiProperty()
  valid: boolean;
  @ApiProperty({ type: [String] })
  errors: string[];
}

export class UserImportPreviewMeta {
  @ApiProperty()
  page: number;
  @ApiProperty({ enum: [25, 50, 100] })
  limit: number;
  @ApiProperty({ description: 'Total filtrado' })
  total: number;
  @ApiProperty()
  totalPages: number;
}

export class UserImportPreview {
  @ApiProperty({ format: 'uuid' })
  operationId: string;
  @ApiProperty({ description: 'Total de filas de todo el archivo' })
  total: number;
  @ApiProperty({ description: 'Filas válidas de todo el archivo' })
  valid: number;
  @ApiProperty({ description: 'Filas inválidas de todo el archivo' })
  invalid: number;
  @ApiProperty({ type: [UserImportPreviewRow] })
  data: UserImportPreviewRow[];
  @ApiProperty({ type: UserImportPreviewMeta })
  meta: UserImportPreviewMeta;
}

export const userImportPreviewResponse: ApiResponseOptions = {
  description: 'Resumen global y página de filas dentro del sobre estándar de la API',
  schema: {
    type: 'object',
    properties: {
      status: { type: 'boolean' },
      statusCode: { type: 'integer' },
      data: { $ref: '#/components/schemas/UserImportPreview' },
    },
    required: ['status', 'statusCode', 'data'],
  },
};
