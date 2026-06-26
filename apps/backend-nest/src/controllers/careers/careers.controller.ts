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
  async create(@Body() careerCreateDto: CareerCreateDto, @CurrentUser() user: User) {
    return this.careersService.create(careerCreateDto, user.idUser);
  }

  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.careersService.getOneByName(name);
  }

  @Get('id/:idCareer')
  async getOneById(@Param('idCareer') idCareer: number) {
    return this.careersService.getOneById(idCareer);
  }

  @Delete(':idCareer')
  async delete(@Param('idCareer') idCareer: number) {
    return this.careersService.delete(idCareer);
  }

  @Patch('reactivate/:idCareer')
  async reactivate(@Param('idCareer') idCareer: number) {
    return this.careersService.reactivate(idCareer);
  }
}
