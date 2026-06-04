import {
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { User } from 'src/entities/users/users.entity';
import { LogoutDto } from 'src/dtos/sessions/logout.dto';

@ApiBearerAuth('access-token')
@Controller('sessions')
@ApiTags('Sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('my-sessions')
  async getMySessions(@CurrentUser() user: User) {
    const sessions = await this.sessionsService.getUserSessions(user.idUser);

    return {
      message: 'Sesiones recuperadas con éxito',
      data: sessions,
    };
  }

  @Post('logout')
  async logout(@Body() logoutDto: LogoutDto, @CurrentUser() user: User) {
    await this.sessionsService.logout(logoutDto.refreshToken, user);

    return { message: 'Logout successful' };
  }

  @Patch('revoke/:idSession')
  async revokeSession(@Param('idSession', ParseIntPipe) idSession: number) {
    const session = await this.sessionsService.revokeSessionById(idSession);

    return {
      message: 'Session revoked successfully',
      data: session,
    };
  }

  @Patch('revoke-all')
  async revokeAllSessions(@CurrentUser() user: User) {
    await this.sessionsService.revokeAllSessions(user.idUser);

    return {
      message: 'All sessions revoked successfully',
    };
  }
}
