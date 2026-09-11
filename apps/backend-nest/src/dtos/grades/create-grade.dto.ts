import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateGradeDto {
  @ApiProperty()
  @IsInt()
  enrollmentId: number;

  @ApiProperty()
  @IsInt()
  gradeSchemeDetailId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  activityId?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;
}
