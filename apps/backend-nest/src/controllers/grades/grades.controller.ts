import type { JwtPayload } from '@common/types/jwt-payload.type';
import { CurrentUser } from '@core/decorators/current-user/current-user.decorator';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateGradeDto } from 'src/dtos/grades/create-grade.dto';
import { UpdateGradeDto } from 'src/dtos/grades/update-grade.dto';
import { GradesService } from 'src/services/grades/grades.service';

@ApiBearerAuth('access-token')
@Controller('grades')
@ApiTags('Grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Permissions('grade.create')
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGradeDto) {
    return this.gradesService.create(user.idUser, dto);
  }

  @Permissions('grade.get-by-enrollment')
  @Get('enrollment/:idEnrollment')
  async getByEnrollment(
    @CurrentUser() user: JwtPayload,
    @Param('idEnrollment', ParseIntPipe)
    idEnrollment: number,
  ) {
    return this.gradesService.getByEnrollment(user.idUser, idEnrollment);
  }

  @Permissions('grade.get-one')
  @Get(':idGrade')
  async getOne(@CurrentUser() user: JwtPayload, @Param('idGrade', ParseIntPipe) idGrade: number) {
    return this.gradesService.getOne(user.idUser, idGrade);
  }

  @Permissions('grade.update')
  @Patch(':idGrade')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('idGrade', ParseIntPipe) idGrade: number,
    @Body() dto: UpdateGradeDto,
  ) {
    return this.gradesService.update(user.idUser, idGrade, dto);
  }

  @Permissions('grade.remove')
  @Delete(':idGrade')
  async remove(@CurrentUser() user: JwtPayload, @Param('idGrade', ParseIntPipe) idGrade: number) {
    return this.gradesService.remove(user.idUser, idGrade);
  }
}
