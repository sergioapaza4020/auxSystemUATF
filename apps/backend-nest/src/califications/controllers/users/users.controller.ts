import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserCreateDto } from 'src/califications/dtos/users/users.dto';
import { UsersService } from 'src/califications/services/users/users.service';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
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

  @Get('username/:username')
  async getOneByUsername(@Param('username') username: string) {
    return this.usersService.getOneByUsername(username);
  }

  @Get('id/:idUser')
  async getOneById(@Param('idUser') idUser: number) {
    return this.usersService.getOneById(idUser);
  }

  @Delete(':idUser')
  async delete(@Param('idUser') idUser: number) {
    return this.usersService.delete(idUser);
  }

  @Patch('reactivate/:idUser')
  async reactivate(@Param('idUser') idUser: number) {
    return this.usersService.reactivate(idUser);
  }
}
