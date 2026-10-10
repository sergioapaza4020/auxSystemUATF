import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';

export class GradeItemReferenceDto {
  @ApiProperty()
  @IsNumber()
  idGradeItem: number;
}

export class DetailCreateDto {
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

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;

  @ApiProperty()
  @IsNumber()
  order: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => GradeItemReferenceDto)
  gradeItem: GradeItemReferenceDto;
}

export class GradeSchemeCreateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetailCreateDto)
  details: DetailCreateDto[];
}
