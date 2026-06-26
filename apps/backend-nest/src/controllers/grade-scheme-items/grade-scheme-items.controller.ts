import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Public } from '@core/decorators/public/public.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { GradeSchemeItemCreateDto } from 'src/dtos/grade-scheme-items/grade-scheme-items.dto';
import { User } from 'src/entities/users/users.entity';
import { GradeSchemeItemsService } from 'src/services/grade-scheme-items/grade-scheme-items.service';

@Public()
@Controller('grade-scheme-items')
export class GradeSchemeItemsController {
  constructor(private readonly gradeSchemeItemsService: GradeSchemeItemsService) {}

  @Get()
  async getAll() {
    return this.gradeSchemeItemsService.getAll();
  }

  @Post()
  async create(@Body() permissionCreateDto: GradeSchemeItemCreateDto, @CurrentUser() user: User) {
    return this.gradeSchemeItemsService.create(permissionCreateDto, user.idUser);
  }

  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return this.gradeSchemeItemsService.getOneByName(name);
  }

  @Get('id/:idGradeSchemeItem')
  async getOneById(@Param('idGradeSchemeItem') idGradeSchemeItem: number) {
    return this.gradeSchemeItemsService.getOneById(idGradeSchemeItem);
  }

  @Delete(':idGradeSchemeItem')
  async delete(@Param('idGradeSchemeItem') idGradeSchemeItem: number) {
    return this.gradeSchemeItemsService.delete(idGradeSchemeItem);
  }

  @Patch('reactivate/:idGradeSchemeItem')
  async reactivate(@Param('idGradeSchemeItem') idGradeSchemeItem: number) {
    return this.gradeSchemeItemsService.reactivate(idGradeSchemeItem);
  }
}
