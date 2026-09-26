import { Type } from 'class-transformer';
import { SemesterNumber } from '@common/enums/semesterNumber';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt } from 'class-validator';

export class SemesterCreateDto {
  @ApiProperty()
  @IsInt()
  year: number;

  @ApiProperty()
  @IsEnum(SemesterNumber)
  period: SemesterNumber;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  endDate: Date;
}
