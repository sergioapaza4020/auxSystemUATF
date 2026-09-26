import { Query } from '@nestjs/common';
import { StatusQueryDto } from 'src/dtos/common/status-query.dto';
import { SemesterUpdateDto } from 'src/dtos/semesters/semesters-update.dto';
import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SemesterCreateDto } from 'src/dtos/semesters/semesters.dto';
import { SemestersService } from 'src/services/semesters/semesters.service';

@ApiBearerAuth('access-token')
@Controller('semesters')
@ApiTags('Semesters')
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Permissions('semester.get-all')
  @Get()
  async getAll(@Query() query: StatusQueryDto) {
    return this.semestersService.getAll(query.status);
  }

  @Permissions('semester.create')
  @Post()
  async create(@Body() semesterCreateDto: SemesterCreateDto) {
    return this.semestersService.create(semesterCreateDto);
  }

  @Permissions('semester.get-current-semester')
  @Get('current')
  async getCurrentSemester() {
    return this.semestersService.getCurrentSemester();
  }

  @Permissions('semester.get-one-by-id')
  @Get('id/:idSemester')
  async getOneById(@Param('idSemester', ParseIntPipe) idSemester: number) {
    return this.semestersService.getOneById(idSemester);
  }

  @Permissions('semester.delete')
  @Delete(':idSemester')
  async delete(@Param('idSemester', ParseIntPipe) idSemester: number) {
    return this.semestersService.delete(idSemester);
  }

  @Permissions('semester.reactivate')
  @Patch('reactivate/:idSemester')
  async reactivate(@Param('idSemester', ParseIntPipe) idSemester: number) {
    return this.semestersService.reactivate(idSemester);
  }

  @Permissions('semester.update')
  @Patch(':idSemester')
  async update(
    @Param('idSemester', ParseIntPipe) idSemester: number,
    @Body() dto: SemesterUpdateDto,
  ) {
    return this.semestersService.update(idSemester, dto);
  }
}
