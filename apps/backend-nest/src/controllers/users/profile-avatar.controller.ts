import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { assertSameSession } from '@common/utils/assert-same-session';
import { ProfileAvatarService } from 'src/services/users/profile-avatar.service';
import { AVATAR_MAX_BYTES } from 'src/services/users/avatar-storage.service';
import { memoryStorage } from 'multer';

@Controller('users')
@ApiBearerAuth('access-token')
@ApiTags('Users')
export class ProfileAvatarController {
  constructor(private readonly avatars: ProfileAvatarService) {}

  @Get('me/avatar')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getOwn(@CurrentUser() user: JwtPayload, @Query('expectedSession') expected?: string) {
    if (expected !== undefined) assertSameSession(expected, user.idSession);
    return this.stream(user.idUser);
  }

  @Permissions('user.get-one-by-id')
  @Get('id/:idUser/avatar')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getOther(
    @Param('idUser', ParseIntPipe) idUser: number,
    @CurrentUser() user: JwtPayload,
    @Query('expectedSession') expected?: string,
  ) {
    if (expected !== undefined) assertSameSession(expected, user.idSession);
    return this.stream(idUser);
  }

  @Put('me/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AVATAR_MAX_BYTES + 1, files: 1, fields: 0 },
    }),
  )
  @Header('Cache-Control', 'no-store')
  async replace(
    @CurrentUser() user: JwtPayload,
    @Query('expectedSession') expected: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    assertSameSession(expected, user.idSession);
    return { data: await this.avatars.replace(user.idUser, user.idSession, file) };
  }

  @Delete('me/avatar')
  @Header('Cache-Control', 'no-store')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Query('expectedSession') expected: string | undefined,
  ) {
    assertSameSession(expected, user.idSession);
    return { data: await this.avatars.remove(user.idUser, user.idSession) };
  }

  private async stream(idUser: number) {
    return new StreamableFile(await this.avatars.get(idUser), { type: 'image/webp' })
      .setErrorHandler((_error, response) => {
        if (response.destroyed) return;
        if (response.headersSent) {
          response.end();
          return;
        }
        response.statusCode = 503;
        response.send('No pudimos entregar la fotografía.');
      })
      .setErrorLogger(() => undefined);
  }
}
