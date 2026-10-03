import { UserUpdateDto } from 'src/dtos/users/users-update.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiAcceptedResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { UsersAssignRolesDto } from 'src/dtos/users/users-assign-roles.dto';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { UsersService } from 'src/services/users/users.service';
import { UserQueryDto } from 'src/dtos/users/user-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import {
  UserImportPreview,
  UserImportPreviewQueryDto,
  userImportPreviewResponse,
} from 'src/dtos/users/users-import-preview.dto';
import { UserImportJobsService } from 'src/services/users/user-import-jobs.service';
import { UserImportStatusDto } from 'src/dtos/users/user-import-status.dto';

@ApiBearerAuth('access-token')
@Controller('users')
@ApiTags('Users')
@ApiExtraModels(UserImportPreview, UserImportStatusDto)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly imports: UserImportJobsService,
  ) {}

  @Permissions('user.create')
  @Post('import/:operationId/confirm')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: 'Encolado; no espera bcrypt ni inserción',
    schema: {
      type: 'object',
      properties: { data: { $ref: '#/components/schemas/UserImportStatusDto' } },
    },
  })
  async confirmImport(
    @Param('operationId', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.imports.confirm(id, user.idUser);
  }

  @Permissions('user.create')
  @Get('import/:operationId/status')
  @ApiOkResponse({
    description: 'Estado durable',
    schema: {
      type: 'object',
      properties: { data: { $ref: '#/components/schemas/UserImportStatusDto' } },
    },
  })
  async importStatus(
    @Param('operationId', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.imports.status(id, user.idUser);
  }

  @Permissions('user.get-all')
  @Get()
  async getAll(@Query() query: UserQueryDto) {
    return this.usersService.getAll(query);
  }

  @Permissions('user.create')
  @Post('import/preview')
  @ApiCreatedResponse(userImportPreviewResponse)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        roleName: {
          type: 'string',
          example: 'STUDENT',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['roleName', 'file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async previewImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('roleName') roleName: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Keep the complete preview inside the standard response envelope.
    return { data: await this.usersService.previewImport(file, roleName, user.idUser) };
  }

  @Permissions('user.create')
  @Get('import/preview/:operationId')
  @ApiOkResponse(userImportPreviewResponse)
  async getImportPreview(
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Query() query: UserImportPreviewQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return { data: await this.usersService.getImportPreview(operationId, user.idUser, query) };
  }

  @Permissions('user.create')
  @Post('import')
  importUsers() {
    throw new GoneException('Usa el preview y POST /users/import/:operationId/confirm');
  }

  @Permissions('user.create')
  @Get('import/template')
  async downloadImportTemplate(@Query('roleName') roleName: string, @Res() response: Response) {
    const buffer = await this.usersService.generateImportTemplate(roleName);

    const normalizedRoleName = roleName.trim().toUpperCase();

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="plantilla-usuarios-${normalizedRoleName.toLowerCase()}.xlsx"`,
    );

    response.send(buffer);
  }

  @Permissions('user.create')
  @Post()
  async create(@Body() userCreateDto: UserCreateDto) {
    return this.usersService.create(userCreateDto);
  }

  @Permissions('user.get-one-by-email')
  @Get('email/:email')
  async getOneByEmail(@Param('email') email: string) {
    return this.usersService.getOneByEmail(email);
  }

  @Permissions('user.get-one-by-username')
  @Get('username/:username')
  async getOneByUsername(@Param('username') username: string) {
    return this.usersService.getOneByUsername(username);
  }

  @Permissions('user.get-one-by-id')
  @Get('id/:idUser')
  async getOneById(@Param('idUser', ParseIntPipe) idUser: number) {
    return this.usersService.getOneById(idUser);
  }

  @Permissions('user.assign-roles')
  @Patch('assign-roles/:idUser')
  async assignRoles(
    @Param('idUser', ParseIntPipe) idUser: number,
    @Body() usersAssignRolesDto: UsersAssignRolesDto,
  ) {
    return this.usersService.assignRoles(idUser, usersAssignRolesDto.roleNames);
  }

  @Permissions('user.delete')
  @Delete(':idUser')
  async delete(@Param('idUser', ParseIntPipe) idUser: number) {
    return this.usersService.delete(idUser);
  }

  @Permissions('user.reactivate')
  @Patch('reactivate/:idUser')
  async reactivate(@Param('idUser', ParseIntPipe) idUser: number) {
    return this.usersService.reactivate(idUser);
  }

  @Permissions('user.update')
  @Patch(':idUser')
  async update(@Param('idUser', ParseIntPipe) idUser: number, @Body() dto: UserUpdateDto) {
    return this.usersService.update(idUser, dto);
  }
}
