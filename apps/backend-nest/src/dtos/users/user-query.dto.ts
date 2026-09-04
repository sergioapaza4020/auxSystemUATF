import { CourseRelations } from '@common/enums/courseRelations';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UserQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  careerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(CourseRelations)
  @IsArray()
  role?: CourseRelations;
}
