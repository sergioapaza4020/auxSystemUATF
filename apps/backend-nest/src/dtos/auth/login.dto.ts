import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'super-mushu', description: 'Username' })
  username: string;

  @ApiProperty({ example: 'password', description: 'Password' })
  password: string;
}
