import {
  Controller,
  Get,
  Header,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { User } from 'src/entities/users/users.entity';
import { LogoutDto } from 'src/dtos/sessions/logout.dto';
import { SessionQueryDto } from 'src/dtos/sessions/session-query.dto';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { sessionResponse } from 'src/dtos/sessions/session-response.dto';
import { assertSameSession } from '@common/utils/assert-same-session';

@ApiBearerAuth('access-token')
@Controller('sessions')
@ApiTags('Sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  getOwnSessions(
    @CurrentUser() user: JwtPayload,
    @Query('expectedSession') expectedSession: string | undefined,
    @Query() query: SessionQueryDto,
  ) {
    assertSameSession(expectedSession, user.idSession);
    return this.sessionsService.getOwnActiveSessions(user.idUser, user.idSession, query);
  }

  @Patch('me/others')
  async revokeOtherSessions(
    @CurrentUser() user: JwtPayload,
    @Query('expectedSession') expectedSession: string | undefined,
  ) {
    assertSameSession(expectedSession, user.idSession);
    await this.sessionsService.revokeOwnOtherSessions(user.idUser, user.idSession);
    return { message: 'Las demás sesiones se cerraron.' };
  }

  @Patch('me/others/:idSession')
  async revokeOwnSession(
    @CurrentUser() user: JwtPayload,
    @Query('expectedSession') expectedSession: string | undefined,
    @Param('idSession', ParseIntPipe) idSession: number,
  ) {
    assertSameSession(expectedSession, user.idSession);
    await this.sessionsService.revokeOwnOtherSessions(user.idUser, user.idSession, idSession);
    return { message: 'La sesión se cerró.' };
  }

  @Permissions('sessions.get-all')
  @Get()
  async getAllSessions(@Query() query: SessionQueryDto) {
    const sessions = await this.sessionsService.getAllSessions(query);

    return {
      message: 'Las sesiones se consultaron correctamente.',
      ...sessions,
      data: sessions.data.map(sessionResponse),
    };
  }

  @Post('logout')
  async logout(@Body() logoutDto: LogoutDto, @CurrentUser() user: JwtPayload) {
    await this.sessionsService.logout(logoutDto.refreshToken, user);

    return { message: 'Cerraste sesión correctamente.' };
  }

  @Permissions('sessions.revoke-one')
  @Patch('revoke/:idSession')
  async revokeSession(
    @Param('idSession', ParseIntPipe) idSession: number,
    @CurrentUser() user: JwtPayload,
  ) {
    const session = await this.sessionsService.revokeSessionById(idSession, {
      idUser: user.idUser,
    });

    return {
      message: 'La sesión se cerró correctamente.',
      data: sessionResponse(session),
    };
  }

  @Permissions('sessions.revoke-all')
  @Patch('revoke-all')
  async revokeAllSessions(@CurrentUser() user: User) {
    await this.sessionsService.revokeAllSessions(user.idUser);

    return {
      message: 'Se cerraron todas las sesiones.',
    };
  }
}
