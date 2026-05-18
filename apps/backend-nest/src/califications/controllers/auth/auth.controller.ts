import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/califications/decorators/current-user/current-user.decorator';
import { Public } from 'src/califications/decorators/public/public.decorator';
import { LoginDto } from 'src/califications/dtos/auth/login.dto';
import { User } from 'src/califications/entities/users/users.entity';
import { AuthService } from 'src/califications/services/auth/auth.service';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { accessToken } = await this.authService.login(loginDto);

    return {
      message: 'Login successful',
      accessToken,
    };
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  getProfile(@CurrentUser() user: User) {
    return {
      message: 'User session active',
      user,
    };
  }
}
