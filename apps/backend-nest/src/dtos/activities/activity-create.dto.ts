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
    required: false,
    example: '2026-09-10',
    description: 'Fecha de publicación de la actividad',
  })
  @IsOptional()
  @IsDateString()
  publicationDate?: string;

  @ApiProperty({
    example: '2026-09-15',
    description: 'Fecha límite de entrega de la actividad',
  })
  @IsNotEmpty()
  @IsDateString()
  dueDate: string;
}
