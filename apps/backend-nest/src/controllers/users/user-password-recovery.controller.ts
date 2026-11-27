import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { PasswordRecoveryService } from 'src/services/auth/password-recovery.service';

@Controller('users')
export class UserPasswordRecoveryController {
  constructor(private readonly recovery: PasswordRecoveryService) {}

  @Post(':idUser/password-reset')
  @HttpCode(202)
  @Permissions('user.reset-password')
  async request(
    @CurrentUser() actor: JwtPayload,
    @Param('idUser', ParseIntPipe) idUser: number,
    @Body() body: unknown,
  ) {
    if (
      body !== undefined &&
      (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)
    ) {
      throw new BadRequestException('Esta operación no admite datos adicionales.');
    }
    await this.recovery.requestByAdministrator(actor, idUser);
    return { message: 'Se inició el proceso de recuperación de contraseña.' };
  }
}
