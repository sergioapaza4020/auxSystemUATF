import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class CreateGradeDto {
  @ApiProperty()
  @IsInt()
  enrollmentId: number;

  @ApiProperty()
  @IsInt()
  gradeSchemeDetailId: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;
}
