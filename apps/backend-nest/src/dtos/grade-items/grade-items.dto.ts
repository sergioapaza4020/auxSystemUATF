import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GradeItemCreateDto {
  @ApiProperty()
  @IsString()
  name: string;
}
