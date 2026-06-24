import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Public } from '@core/decorators/public/public.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CareerCreateDto } from 'src/dtos/careers/careers.dto';
import { User } from 'src/entities/users/users.entity';
import { CareersService } from 'src/services/careers/careers.service';

@Public()
@Controller('careers')
export class CareersController {
  constructor(private readonly careersService: CareersService) {}

  @Get()
  async getAll() {
    return this.careersService.getAll();
  }

  @Post()
  async create(@Body() permissionCreateDto: CareerCreateDto, @CurrentUser() user: User) {
    return this.careersService.create(permissionCreateDto, user.idUser);
  }

  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.careersService.getOneByName(name);
  }

  @Get('id/:idFaculty')
  async getOneById(@Param('idFaculty') idFaculty: number) {
    return this.careersService.getOneById(idFaculty);
  }

  @Delete(':idFaculty')
  async delete(@Param('idFaculty') idFaculty: number) {
    return this.careersService.delete(idFaculty);
  }

  @Patch('reactivate/:idFaculty')
  async reactivate(@Param('idFaculty') idFaculty: number) {
    return this.careersService.reactivate(idFaculty);
  }
}
