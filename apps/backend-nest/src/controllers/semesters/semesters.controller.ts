import { Permissions } from '@core/decorators/permissions/permissions.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
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
  async getAll() {
    return this.semestersService.getAll();
  }

  @Permissions('semester.create')
  @Post()
  async create(@Body() semesterCreateDto: SemesterCreateDto) {
    return this.semestersService.create(semesterCreateDto);
  }

  @Get('current')
  async getCurrentSemester() {
    return this.semestersService.getCurrentSemester();
  }

  @Permissions('semester.get-one-by-id')
  @Get('id/:idSemester')
  async getOneById(@Param('idSemester') idSemester: number) {
    return this.semestersService.getOneById(idSemester);
  }

  @Permissions('semester.delete')
  @Delete(':idSemester')
  async delete(@Param('idSemester') idSemester: number) {
    return this.semestersService.delete(idSemester);
  }

  @Permissions('semester.reactivate')
  @Patch('reactivate/:idSemester')
  async reactivate(@Param('idSemester') idSemester: number) {
    return this.semestersService.reactivate(idSemester);
  }
}
