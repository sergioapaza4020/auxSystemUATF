import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { CreateGradeDto } from './create-grade.dto';

export class BulkActivityGradeDto extends PickType(CreateGradeDto, [
  'enrollmentId',
  'score',
] as const) {
  @ApiProperty()
  @IsInt()
  @Min(1)
  activityId: number;
}

export class BulkActivityGradesDto {
  @ApiProperty({ type: [BulkActivityGradeDto], maxItems: 1000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkActivityGradeDto)
  grades: BulkActivityGradeDto[];
}
