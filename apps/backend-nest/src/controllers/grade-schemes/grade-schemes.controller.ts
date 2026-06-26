import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Public } from '@core/decorators/public/public.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { GradeSchemeCreateDto } from 'src/dtos/grade-schemes/grade-schemes.dto';
import { User } from 'src/entities/users/users.entity';
import { GradeSchemesService } from 'src/services/grade-schemes/grade-schemes.service';

@Public()
@Controller('grade-schemes')
export class GradeSchemesController {
  constructor(private readonly gradeSchemesService: GradeSchemesService) {}

  @Get()
  async getAll() {
    return this.gradeSchemesService.getAll();
  }

  @Post()
  async create(@Body() gradeSchemeCreateDto: GradeSchemeCreateDto, @CurrentUser() user: User) {
    return this.gradeSchemesService.create(gradeSchemeCreateDto, user.idUser);
  }

  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.gradeSchemesService.getOneByName(name);
  }

  @Get('id/:idGradeScheme')
  async getOneById(@Param('idGradeScheme') idGradeScheme: number) {
    return this.gradeSchemesService.getOneById(idGradeScheme);
  }

  @Delete(':idGradeScheme')
  async delete(@Param('idGradeScheme') idGradeScheme: number) {
    return this.gradeSchemesService.delete(idGradeScheme);
  }

  @Patch('reactivate/:idGradeScheme')
  async reactivate(@Param('idGradeScheme') idGradeScheme: number) {
    return this.gradeSchemesService.reactivate(idGradeScheme);
  }
}
