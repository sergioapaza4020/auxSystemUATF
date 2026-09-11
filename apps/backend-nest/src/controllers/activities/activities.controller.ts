import type { JwtPayload } from '@common/types/jwt-payload.type';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityCreateDto } from 'src/dtos/activities/activity-create.dto';
import { ActivityUpdateDto } from 'src/dtos/activities/activity-update.dto';
import { ActivitiesService } from 'src/services/activities/activities.service';

@ApiBearerAuth('access-token')
@Controller('activities')
@ApiTags('Activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Permissions('activity.get-all')
  @Get()
  async getAll() {
    return this.activitiesService.getAll();
  }

  @Permissions('activity.create')
  @Post('course/:idCourse')
  async create(
    @Param('idCourse', ParseIntPipe) idCourse: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ActivityCreateDto,
  ) {
    return this.activitiesService.create(idCourse, user.idUser, dto);
  }

  @Permissions('activity.get-by-grade-scheme-detail')
  @Get('grade-scheme-detail/:idGradeSchemeDetail')
  async getByGradeSchemeDetail(
    @Param('idGradeSchemeDetail', ParseIntPipe)
    idGradeSchemeDetail: number,
  ) {
    return this.activitiesService.getByGradeSchemeDetail(idGradeSchemeDetail);
  }

  @Permissions('activity.update')
  @Put(':idActivity')
  async update(
    @Param('idActivity', ParseIntPipe)
    idActivity: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ActivityUpdateDto,
  ) {
    return this.activitiesService.update(idActivity, user.idUser, dto);
  }

  @Permissions('activity.delete')
  @Delete(':idActivity')
  async delete(
    @Param('idActivity', ParseIntPipe)
    idActivity: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.activitiesService.delete(idActivity, user.idUser);
  }

  @Permissions('activity.reactivate')
  @Patch('reactivate/:idActivity')
  async reactivate(
    @Param('idActivity', ParseIntPipe)
    idActivity: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.activitiesService.reactivate(idActivity, user.idUser);
  }
}
