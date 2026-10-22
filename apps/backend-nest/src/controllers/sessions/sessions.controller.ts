import { Controller, Get, Patch, Param, ParseIntPipe, Post, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { User } from 'src/entities/users/users.entity';
import { LogoutDto } from 'src/dtos/sessions/logout.dto';
import { SessionQueryDto } from 'src/dtos/sessions/session-query.dto';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';

@ApiBearerAuth('access-token')
@Controller('sessions')
@ApiTags('Sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Permissions('sessions.get-all')
  @Get()
  async getAllSessions(@Query() query: SessionQueryDto) {
    const sessions = await this.sessionsService.getAllSessions(query);

    return {
      message: 'Sesiones recuperadas con éxito',
      ...sessions,
    };
  }

  @Post('logout')
  async logout(@Body() logoutDto: LogoutDto, @CurrentUser() user: JwtPayload) {
    await this.sessionsService.logout(logoutDto.refreshToken, user);

    return { message: 'Logout successful' };
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
      message: 'Session revoked successfully',
      data: session,
    };
  }

  @Permissions('sessions.revoke-all')
  @Patch('revoke-all')
  async revokeAllSessions(@CurrentUser() user: User) {
    await this.sessionsService.revokeAllSessions(user.idUser);

    return {
      message: 'All sessions revoked successfully',
    };
  }
}
