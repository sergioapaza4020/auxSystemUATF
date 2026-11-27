import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';
import { AuthTransport } from '@core/guards/auth/auth-transport.guard';
import {
  RequestRecoveryDto,
  ResetRecoveryDto,
  VerifyRecoveryDto,
} from 'src/dtos/auth/password-recovery.dto';
import { PasswordRecoveryService } from 'src/services/auth/password-recovery.service';

@Controller('auth/password-recovery')
export class PasswordRecoveryController {
  constructor(
    private readonly recovery: PasswordRecoveryService,
    private readonly config: ConfigService,
  ) {}

  private source(forwarded: string | undefined, peer: string) {
    return this.config.get('PASSWORD_RECOVERY_TRUST_CLIENT_IP') === 'true' &&
      forwarded &&
      isIP(forwarded)
      ? forwarded
      : peer;
  }

  @Post('request')
  @HttpCode(202)
  @AuthTransport('next')
  async request(
    @Body() dto: RequestRecoveryDto,
    @Headers('x-uatf-client-ip') forwarded: string | undefined,
    @Ip() peer: string,
  ) {
    return { data: await this.recovery.request(dto.email, this.source(forwarded, peer)) };
  }

  @Post('verify')
  @HttpCode(200)
  @AuthTransport('next')
  async verify(
    @Body() dto: VerifyRecoveryDto,
    @Headers('x-uatf-client-ip') forwarded: string | undefined,
    @Ip() peer: string,
  ) {
    return { data: await this.recovery.verify(dto, this.source(forwarded, peer)) };
  }

  @Post('reset')
  @HttpCode(200)
  @AuthTransport('next')
  async reset(
    @Body() dto: ResetRecoveryDto,
    @Headers('x-uatf-client-ip') forwarded: string | undefined,
    @Ip() peer: string,
  ) {
    await this.recovery.reset(dto, this.source(forwarded, peer));
    return { message: 'Contraseña restablecida.' };
  }
}
