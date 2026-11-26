import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @IsNotEmpty({ message: 'Ingresa tu contraseña actual.' })
  @MaxLength(1024)
  currentPassword: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @IsNotEmpty({ message: 'Ingresa una nueva contraseña.' })
  newPassword: string;
}
