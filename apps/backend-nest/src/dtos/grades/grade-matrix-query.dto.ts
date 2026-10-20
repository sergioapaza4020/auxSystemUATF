import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StudentRosterQueryDto } from '../enrollments/student-roster-query.dto';
export class GradeMatrixQueryDto extends StudentRosterQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  detailId?: number;
}
