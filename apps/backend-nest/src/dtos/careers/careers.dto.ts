import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsInt, IsString, Min } from 'class-validator';

export class CareerCreateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  idFaculty: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  idDirector: number;

  @ApiProperty()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  idMembers: number[];
}
