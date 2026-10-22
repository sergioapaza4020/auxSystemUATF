import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssistantGradeItemReferenceDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  idGradeItem: number;
}

export class AssistantGradeSchemeDetailDto {
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 1,
    default: 1,
    description: 'Valor del permiso en el criterio de asistencia',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  permissionWeight?: number;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: 'Porcentaje del elemento dentro del bloque del auxiliar',
  })
  @IsInt()
  @Min(0)
  @Max(100)
  percentage: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => AssistantGradeItemReferenceDto)
  gradeItem: AssistantGradeItemReferenceDto;
}

export class AssistantGradeSchemeCreateDto {
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    example: 10,
    description: 'Porcentaje que representa el auxiliar dentro de la materia',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  assistantPercentage: number;

  @ApiPropertyOptional({
    example: 'Evaluación del auxiliar',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'Distribución de las actividades gestionadas por el auxiliar',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [AssistantGradeSchemeDetailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantGradeSchemeDetailDto)
  details: AssistantGradeSchemeDetailDto[];
}

export class AssistantGradeSchemeUpdateDto {
  @ApiPropertyOptional({ type: [Number], description: 'Criterios a archivar explícitamente' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  deactivateDetailIds?: number[];

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    example: 10,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  assistantPercentage: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [AssistantGradeSchemeDetailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantGradeSchemeDetailDto)
  details: AssistantGradeSchemeDetailDto[];
}
