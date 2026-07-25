import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString, MinLength } from 'class-validator';
import { GradeItem } from 'src/entities/grade-items/grade-items.entity';

class DetailCreateDto {
  @ApiProperty()
  @IsNumber()
  percentage: number;

  @ApiProperty()
  @IsNumber()
  order: number;

  @ApiProperty()
  gradeItem: GradeItem;
}

export class GradeSchemeCreateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsArray()
  @MinLength(1)
  details: DetailCreateDto[];
}
