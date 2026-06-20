import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'mushu', description: 'Username' })
  username: string;

  @ApiProperty({ example: 'mushuadmin', description: 'Password' })
  password: string;
}
