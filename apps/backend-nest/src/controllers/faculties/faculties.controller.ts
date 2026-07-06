import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FacultyCreateDto } from 'src/dtos/faculties/faculties.dto';
import { User } from 'src/entities/users/users.entity';
import { FacultiesService } from 'src/services/faculties/faculties.service';

@ApiBearerAuth('acess-token')
@Controller('faculties')
@ApiTags('Faculties')
export class FacultiesController {
  constructor(private readonly facultiesService: FacultiesService) {}

  @Permissions('faculty.get-all')
  @Get()
  async getAll() {
    return this.facultiesService.getAll();
  }

  @Permissions('faculty.create')
  @Post()
  async create(@Body() facultyCreateDto: FacultyCreateDto, @CurrentUser() user: User) {
    return this.facultiesService.create(facultyCreateDto, user.idUser);
  }

  @Permissions('faculty.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.facultiesService.getOneByName(name);
  }

  @Permissions('faculty.get-one-by-id')
  @Get('id/:idFaculty')
  async getOneById(@Param('idFaculty') idFaculty: number) {
    return this.facultiesService.getOneById(idFaculty);
  }

  @Permissions('faculty.delete')
  @Delete(':idFaculty')
  async delete(@Param('idFaculty') idFaculty: number) {
    return this.facultiesService.delete(idFaculty);
  }

  @Permissions('faculty.reactivate')
  @Patch('reactivate/:idFaculty')
  async reactivate(@Param('idFaculty') idFaculty: number) {
    return this.facultiesService.reactivate(idFaculty);
  }
}
