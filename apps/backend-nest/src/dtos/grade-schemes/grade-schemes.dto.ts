import { ApiProperty } from '@nestjs/swagger';
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
  details: DetailCreateDto[];
}
