import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'name_ru', description: 'Username' })
  username: string;

  @ApiProperty({ example: '12345678', description: 'Password' })
  password: string;
}
