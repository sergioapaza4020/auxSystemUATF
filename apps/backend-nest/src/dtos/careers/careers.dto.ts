import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString } from 'class-validator';

export class CareerCreateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  idFaculty: number;

  @ApiProperty()
  @IsNumber()
  idDirector: number;

  @ApiProperty()
  @IsNumber()
  @IsArray()
  idMembers: number[];
}
