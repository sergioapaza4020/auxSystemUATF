import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CheckRegistrationDto {
  @ApiProperty({ description: 'Registro universitario', example: '0012345' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'El RU es obligatorio.' })
  ru: string;
}
