import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/califications/decorators/public/public.decorator';
import { Roles } from 'src/califications/decorators/roles/roles.decorator';
import { UsersAssignRolesDto } from 'src/califications/dtos/users/users-assign-roles.dto';
import { UserCreateDto } from 'src/califications/dtos/users/users.dto';
import { UsersService } from 'src/califications/services/users/users.service';

@ApiBearerAuth('access-token')
@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('ADMIN')
  @Get()
  async getAll() {
    return this.usersService.getAll();
  }

  @Post()
  async create(@Body() userCreateDto: UserCreateDto) {
    return this.usersService.create(userCreateDto);
  }

  @Get('email/:email')
  async getOneByEmail(@Param('email') email: string) {
    return this.usersService.getOneByEmail(email);
  }

  @Roles('YUI')
  @Get('username/:username')
  async getOneByUsername(@Param('username') username: string) {
    return this.usersService.getOneByUsername(username);
  }

  @Roles('TEST')
  @Get('id/:idUser')
  async getOneById(@Param('idUser') idUser: number) {
    return this.usersService.getOneById(idUser);
  }

  @Public()
  @Patch('assign-roles/:idUser')
  async assignRoles(
    @Param('idUser', ParseIntPipe) idUser: number,
    @Body() usersAssignRolesDto: UsersAssignRolesDto,
  ) {
    return this.usersService.assignRoles(idUser, usersAssignRolesDto.roleNames);
  }

  @Delete(':idUser')
  async delete(@Param('idUser', ParseIntPipe) idUser: number) {
    return this.usersService.delete(idUser);
  }

  @Patch('reactivate/:idUser')
  async reactivate(@Param('idUser', ParseIntPipe) idUser: number) {
    return this.usersService.reactivate(idUser);
  }
}
