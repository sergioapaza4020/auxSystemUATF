import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CareerCreateDto } from 'src/dtos/careers/careers.dto';
import { User } from 'src/entities/users/users.entity';
import { CareersService } from 'src/services/careers/careers.service';

@ApiBearerAuth('access-token')
@Controller('careers')
@ApiTags('Careers')
export class CareersController {
  constructor(private readonly careersService: CareersService) {}

  @Permissions('career.get-all')
  @Get()
  async getAll() {
    return this.careersService.getAll();
  }

  @Permissions('career.create')
  @Post()
  async create(@Body() careerCreateDto: CareerCreateDto, @CurrentUser() user: User) {
    return this.careersService.create(careerCreateDto, user.idUser);
  }

  @Permissions('career.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.careersService.getOneByName(name);
  }

  @Permissions('career.get-one-by-id')
  @Get('id/:idCareer')
  async getOneById(@Param('idCareer') idCareer: number) {
    return this.careersService.getOneById(idCareer);
  }

  @Permissions('career.delete')
  @Delete(':idCareer')
  async delete(@Param('idCareer') idCareer: number) {
    return this.careersService.delete(idCareer);
  }

  @Permissions('career.reactivate')
  @Patch('reactivate/:idCareer')
  async reactivate(@Param('idCareer') idCareer: number) {
    return this.careersService.reactivate(idCareer);
  }
}
