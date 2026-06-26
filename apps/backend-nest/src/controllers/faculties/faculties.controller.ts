import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Public } from '@core/decorators/public/public.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { FacultyCreateDto } from 'src/dtos/faculties/faculties.dto';
import { User } from 'src/entities/users/users.entity';
import { FacultiesService } from 'src/services/faculties/faculties.service';

@Public()
@Controller('faculties')
export class FacultiesController {
  constructor(private readonly facultiesService: FacultiesService) {}

  @Get()
  async getAll() {
    return this.facultiesService.getAll();
  }

  @Post()
  async create(@Body() facultyCreateDto: FacultyCreateDto, @CurrentUser() user: User) {
    return this.facultiesService.create(facultyCreateDto, user.idUser);
  }

  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.facultiesService.getOneByName(name);
  }

  @Get('id/:idFaculty')
  async getOneById(@Param('idFaculty') idFaculty: number) {
    return this.facultiesService.getOneById(idFaculty);
  }

  @Delete(':idFaculty')
  async delete(@Param('idFaculty') idFaculty: number) {
    return this.facultiesService.delete(idFaculty);
  }

  @Patch('reactivate/:idFaculty')
  async reactivate(@Param('idFaculty') idFaculty: number) {
    return this.facultiesService.reactivate(idFaculty);
  }
}
