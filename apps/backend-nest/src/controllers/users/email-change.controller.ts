import { Body, Controller, Get, Header, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { assertSameSession } from '@common/utils/assert-same-session';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { ConfirmEmailChangeDto, RequestEmailChangeDto } from 'src/dtos/users/email-change.dto';
import { EmailChangeService } from 'src/services/users/email-change.service';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth('access-token')
export class EmailChangeController {
  constructor(private readonly changes: EmailChangeService) {}

  @Get('me/email-change')
  @Header('Cache-Control', 'no-store')
  async pending(@CurrentUser() actor: JwtPayload, @Query('expectedSession') expected?: string) {
    assertSameSession(expected, actor.idSession);
    return { data: await this.changes.pending(actor) };
  }

  @Post('me/email-change')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  async request(
    @CurrentUser() actor: JwtPayload,
    @Query('expectedSession') expected: string | undefined,
    @Body() dto: RequestEmailChangeDto,
  ) {
    assertSameSession(expected, actor.idSession);
    return { data: await this.changes.request(actor, dto) };
  }

  @Post('email-change/confirm')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  async confirm(
    @CurrentUser() actor: JwtPayload,
    @Query('expectedSession') expected: string | undefined,
    @Body() dto: ConfirmEmailChangeDto,
  ) {
    assertSameSession(expected, actor.idSession);
    await this.changes.confirm(actor, dto.token);
    return {
      message: 'Tu correo electrónico se actualizó correctamente.',
      data: { sessionsRevoked: true },
    };
  }
}
