import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GradeSchemeItemCreateDto } from 'src/dtos/grade-scheme-items/grade-scheme-items.dto';
import { User } from 'src/entities/users/users.entity';
import { GradeItemsService } from 'src/services/grade-items/grade-items.service';

@ApiBearerAuth('access-token')
@Controller('grade-items')
@ApiTags('Grade-items')
export class GradeItemsController {
  constructor(private readonly GradeItemsService: GradeItemsService) {}

  @Permissions('grade-item.get-all')
  @Get()
  async getAll() {
    return await this.GradeItemsService.getAll();
  }

  @Permissions('grade-item.create')
  @Post()
  async create(@Body() permissionCreateDto: GradeSchemeItemCreateDto, @CurrentUser() user: User) {
    return await this.GradeItemsService.create(permissionCreateDto, user.idUser);
  }

  @Permissions('grade-item.get-one-by-name')
  @Get('name/:name')
  async getOneByName(@Param('name') name: string) {
    return await this.GradeItemsService.getOneByName(name);
  }

  @Permissions('grade-item.get-one-by-id')
  @Get('id/:idGradeSchemeItem')
  async getOneById(@Param('idGradeSchemeItem') idGradeSchemeItem: number) {
    return await this.GradeItemsService.getOneById(idGradeSchemeItem);
  }

  @Permissions('grade-item.delete')
  @Delete(':idGradeSchemeItem')
  async delete(@Param('idGradeSchemeItem') idGradeSchemeItem: number) {
    return await this.GradeItemsService.delete(idGradeSchemeItem);
  }

  @Permissions('grade-item.reactivate')
  @Patch('reactivate/:idGradeSchemeItem')
  async reactivate(@Param('idGradeSchemeItem') idGradeSchemeItem: number) {
    return await this.GradeItemsService.reactivate(idGradeSchemeItem);
  }
}
