import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Public } from '@core/decorators/public/public.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CourseCreateDto } from 'src/dtos/courses/courses.dto';
import { User } from 'src/entities/users/users.entity';
import { CoursesService } from 'src/services/courses/courses.service';

@Public()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async getAll() {
    return this.coursesService.getAll();
  }

  @Post()
  async create(@Body() permissionCreateDto: CourseCreateDto, @CurrentUser() user: User) {
    return this.coursesService.create(permissionCreateDto, user.idUser);
  }

  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.coursesService.getOneByName(name);
  }

  @Get('id/:idCourse')
  async getOneById(@Param('idCourse') idCourse: number) {
    return this.coursesService.getOneById(idCourse);
  }

  @Delete(':idCourse')
  async delete(@Param('idCourse') idCourse: number) {
    return this.coursesService.delete(idCourse);
  }

  @Patch('reactivate/:idCourse')
  async reactivate(@Param('idCourse') idCourse: number) {
    return this.coursesService.reactivate(idCourse);
  }
}
