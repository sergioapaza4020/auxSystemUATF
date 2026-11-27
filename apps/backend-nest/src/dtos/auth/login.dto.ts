import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiProperty({ required: false, default: false, type: Boolean })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  rememberMe?: boolean;

  @ApiProperty({ example: 'super-mushu', description: 'Username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password', description: 'Password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
