import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString } from 'class-validator';

export class FacultyCreateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  idDean: number;

  @ApiProperty()
  @IsNumber()
  @IsArray()
  idCareers: number[];
}
