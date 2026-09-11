import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ActivityCreateDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  gradeSchemeDetailId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '2026-09-15',
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  order: number;
}
