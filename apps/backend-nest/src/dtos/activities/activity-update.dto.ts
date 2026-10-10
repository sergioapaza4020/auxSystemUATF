import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ActivityUpdateDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

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
  @IsOptional()
  @IsNotEmpty()
  @IsDateString()
  dueDate?: string;
}
