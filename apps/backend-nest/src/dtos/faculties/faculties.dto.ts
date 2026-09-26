import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class FacultyCreateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  idDean: number;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  idCareers?: number[];
}
