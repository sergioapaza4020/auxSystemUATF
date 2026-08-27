import { SemesterNumber } from '@common/enums/semesterNumber';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNumber } from 'class-validator';

export class SemesterCreateDto {
  @ApiProperty()
  @IsNumber()
  year: number;

  @ApiProperty()
  @IsNumber()
  period: SemesterNumber;

  @ApiProperty()
  @IsDate()
  startDate: Date;

  @ApiProperty()
  @IsDate()
  endDate: Date;
}
