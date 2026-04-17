import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserCreateDto } from 'src/califications/dtos/users/users.dto';
import { UsersService } from 'src/califications/services/users/users.service';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll() {
    return this.usersService.getAll();
  }

  @Get('email/:email')
  async getOneByEmail(@Param('email') email: string) {
    return this.usersService.getOneByEmail(email);
  }

  @Get('username/:username')
  async getOneByUsername(@Param('username') username: string) {
    return this.usersService.getOneByUsername(username);
  }

  @Get('id/:idUser')
  async getOneById(@Param('idUser') idUser: number) {
    return this.usersService.getOneById(idUser);
  }

  @Post()
  async create(@Body() userCreateDto: UserCreateDto) {
    return this.usersService.create(userCreateDto);
  }

  @Delete(':idUser')
  async delete(@Param('idUser') idUser: number) {
    return this.usersService.delete(idUser);
  }
}
