import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GradeSchemeCreateDto } from 'src/dtos/grade-schemes/grade-schemes.dto';
import { User } from 'src/entities/users/users.entity';
import { GradeSchemesService } from 'src/services/grade-schemes/grade-schemes.service';

@ApiBearerAuth('acess-token')
@Controller('grade-schemes')
@ApiTags('Grade-schemes')
export class GradeSchemesController {
  constructor(private readonly gradeSchemesService: GradeSchemesService) {}

  @Permissions('grade-scheme.get-all')
  @Get()
  async getAll() {
    return this.gradeSchemesService.getAll();
  }

  @Permissions('grade-scheme.create')
  @Post()
  async create(@Body() gradeSchemeCreateDto: GradeSchemeCreateDto, @CurrentUser() user: User) {
    return this.gradeSchemesService.create(gradeSchemeCreateDto, user.idUser);
  }

  @Permissions('grade-scheme.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.gradeSchemesService.getOneByName(name);
  }

  @Permissions('grade-scheme.get-one-by-id')
  @Get('id/:idGradeScheme')
  async getOneById(@Param('idGradeScheme') idGradeScheme: number) {
    return this.gradeSchemesService.getOneById(idGradeScheme);
  }

  @Permissions('grade-scheme.delete')
  @Delete(':idGradeScheme')
  async delete(@Param('idGradeScheme') idGradeScheme: number) {
    return this.gradeSchemesService.delete(idGradeScheme);
  }

  @Permissions('grade-scheme.reactivate')
  @Patch('reactivate/:idGradeScheme')
  async reactivate(@Param('idGradeScheme') idGradeScheme: number) {
    return this.gradeSchemesService.reactivate(idGradeScheme);
  }
}
