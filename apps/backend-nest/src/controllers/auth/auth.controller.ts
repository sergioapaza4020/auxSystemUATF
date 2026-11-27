import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { CheckRegistrationDto } from 'src/dtos/auth/check-registration.dto';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Public } from '@core/decorators/public/public.decorator';
import { LoginDto } from 'src/dtos/auth/login.dto';
import { AuthService } from 'src/services/auth/auth.service';
import { RefreshTokenDto } from 'src/dtos/auth/refresh-token.dto';
import type { Request } from 'express';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { sessionResponse } from 'src/dtos/sessions/session-response.dto';
import { AuthTransport } from '@core/guards/auth/auth-transport.guard';
import { ChangePasswordDto } from 'src/dtos/auth/change-password.dto';
import { assertSameSession } from '@common/utils/assert-same-session';
import { UpdateOwnProfileDto } from 'src/dtos/auth/update-own-profile.dto';

const ownProfileBody = new ValidationPipe({
  expectedType: UpdateOwnProfileDto,
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  validationError: { target: false, value: false },
});

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @AuthTransport('next')
  @Post('session/login')
  async sessionLogin(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.authService.login(dto, req, true);
    return {
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionExpiresAt: result.userSession.expiresAt.toISOString(),
        rememberMe: result.userSession.rememberMe,
      },
    };
  }

  @AuthTransport('next')
  @Post('session/refresh')
  async sessionRefresh(@Body() dto: RefreshTokenDto) {
    return { data: await this.authService.refreshToken(dto.refreshToken, true) };
  }

  @AuthTransport('next')
  @Post('session/logout')
  async sessionLogout(@Body() dto: RefreshTokenDto) {
    await this.authService.logoutSecure(dto.refreshToken);
    return { message: 'La sesión se cerró correctamente.' };
  }

  @Public()
  @Post('check-registration')
  @HttpCode(HttpStatus.OK)
  async checkRegistration(@Body() dto: CheckRegistrationDto) {
    return {
      message: 'La verificación del registro se completó.',
      data: await this.authService.checkRegistration(dto),
    };
  }

  @AuthTransport('legacy')
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const tokens = await this.authService.login(loginDto, req);

    return {
      message: 'Iniciaste sesión correctamente.',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userSession: sessionResponse(tokens.userSession),
      },
    };
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @Header('Cache-Control', 'no-store')
  async getProfile(@CurrentUser() user: JwtPayload) {
    const session = await this.authService.getProfile(user.idUser, user.idSession);

    return {
      message: 'Tu sesión está activa.',
      data: session,
    };
  }

  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateOwnProfileDto })
  @Patch('me')
  @Header('Cache-Control', 'no-store')
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Query('expectedSession') expectedSession: string | undefined,
    // The route pipe must inspect the original keys before global whitelisting.
    @Body(ownProfileBody) body: unknown,
  ) {
    assertSameSession(expectedSession, user.idSession);
    return { data: await this.authService.updateProfile(user.idUser, body as UpdateOwnProfileDto) };
  }

  @ApiBearerAuth('access-token')
  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Query('expectedSession') expectedSession: string | undefined,
    @Body() dto: ChangePasswordDto,
  ) {
    assertSameSession(expectedSession, user.idSession);
    await this.authService.changePassword(user, dto);
    return { message: 'La contraseña se actualizó. Vuelve a iniciar sesión.' };
  }

  @AuthTransport('legacy')
  @Post('refresh-access-token')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const tokens = await this.authService.refreshToken(refreshTokenDto.refreshToken);

    return {
      message: 'Tu sesión se renovó correctamente.',
      data: { accessToken: tokens.accessToken },
    };
  }
}
