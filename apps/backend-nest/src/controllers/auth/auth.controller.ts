import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Public } from '@core/decorators/public/public.decorator';
import { LoginDto } from 'src/dtos/auth/login.dto';
import { User } from 'src/entities/users/users.entity';
import { AuthService } from 'src/services/auth/auth.service';
import { RefreshTokenDto } from 'src/dtos/auth/refresh-token.dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { accessToken, refreshToken, session } =
      await this.authService.login(loginDto);

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      session,
    };
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  async getProfile(@CurrentUser() user: User) {
    const session = await this.authService.getSession(user.idUser);

    return {
      message: 'User session active',
      data: session,
    };
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const tokens = await this.authService.refreshToken(
      refreshTokenDto.refreshToken,
    );

    return {
      message: 'Token refreshed successfully',
      data: tokens,
    };
  }
}
