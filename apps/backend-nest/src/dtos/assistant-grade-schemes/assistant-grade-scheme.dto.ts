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
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: 'Porcentaje del elemento dentro del bloque del auxiliar',
  })
  @IsNumber()
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
