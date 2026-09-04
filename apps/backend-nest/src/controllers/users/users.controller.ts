import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { UsersAssignRolesDto } from 'src/dtos/users/users-assign-roles.dto';
import { UserCreateDto } from 'src/dtos/users/users.dto';
import { UsersService } from 'src/services/users/users.service';
import { UserQueryDto } from 'src/dtos/users/user-query.dto';

@ApiBearerAuth('access-token')
@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Permissions('user.get-all')
  @Get()
  async getAll(@Query() query: UserQueryDto) {
    return this.usersService.getAll(query);
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
  async getOneById(@Param('idUser') idUser: number) {
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
}
