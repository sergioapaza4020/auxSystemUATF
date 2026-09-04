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
import { GradeSchemeUpdateDto } from 'src/dtos/grade-schemes/grade-scheme-update.dto';
import { GradeSchemeCreateDto } from 'src/dtos/grade-schemes/grade-schemes.dto';
import { GradeSchemesService } from 'src/services/grade-schemes/grade-schemes.service';

@ApiBearerAuth('access-token')
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
  async create(@Body() gradeSchemeCreateDto: GradeSchemeCreateDto) {
    return this.gradeSchemesService.create(gradeSchemeCreateDto);
  }

  @Permissions('grade-scheme.create')
  @Post('course/:idCourse')
  async createForAssistant(
    @Param('idCourse', ParseIntPipe) idCourse: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: GradeSchemeCreateDto,
  ) {
    return this.gradeSchemesService.createForAssistant(idCourse, user.idUser, dto);
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

  @Permissions('grade-scheme.update')
  @Put('update/:idGradeScheme')
  async update(
    @Param('idGradeScheme') idGradeScheme: number,
    @Body() gradeSchemeUpdateDto: GradeSchemeUpdateDto,
  ) {
    return this.gradeSchemesService.update(idGradeScheme, gradeSchemeUpdateDto);
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
