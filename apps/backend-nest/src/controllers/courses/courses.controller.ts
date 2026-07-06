import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CourseCreateDto } from 'src/dtos/courses/courses.dto';
import { User } from 'src/entities/users/users.entity';
import { CoursesService } from 'src/services/courses/courses.service';

@ApiBearerAuth('acess-token')
@Controller('courses')
@ApiTags('Courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Permissions('course.get-all')
  @Get()
  async getAll() {
    return this.coursesService.getAll();
  }

  @Permissions('course.create')
  @Post()
  async create(@Body() permissionCreateDto: CourseCreateDto, @CurrentUser() user: User) {
    return this.coursesService.create(permissionCreateDto, user.idUser);
  }

  @Permissions('course.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.coursesService.getOneByName(name);
  }

  @Permissions('course.get-one-by-id')
  @Get('id/:idCourse')
  async getOneById(@Param('idCourse') idCourse: number) {
    return this.coursesService.getOneById(idCourse);
  }

  @Permissions('course.delete')
  @Delete(':idCourse')
  async delete(@Param('idCourse') idCourse: number) {
    return this.coursesService.delete(idCourse);
  }

  @Permissions('course.reactivate')
  @Patch('reactivate/:idCourse')
  async reactivate(@Param('idCourse') idCourse: number) {
    return this.coursesService.reactivate(idCourse);
  }
}
